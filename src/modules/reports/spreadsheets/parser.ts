import { XMLParser, XMLValidator } from "fast-xml-parser";
import { MAX_SPREADSHEET_BYTES, readSpreadsheetArchive } from "./archive";
import { fromCents, parseAmount, toCents } from "./money";
import type { ImportedSheet, ImportedWorkbook, ImportIssue, ProjectRow, TitleRow } from "./types";

type XmlNode = Record<string, unknown>;
type Cell = { value: string; numeric: boolean; formula: boolean; unavailable: boolean; zeroPadding: number };
type WorksheetRow = { sourceRow: number; cells: Map<number, Cell> };
type Header = { kind: "titles" | "projects"; row: number; columns: number[] };

const TITLE_HEADERS = ["Nº Documento", "Tipo", "Categoria", "Favorecido / Pagador", "Data Emissão", "Data Vencimento", "Valor Nominal", "Juros / Multa", "Valor Total", "Data Pagamento", "Status", "Forma de Pagamento", "Observações"];
const PROJECT_HEADERS = ["Nº da Obra", "Nome da obra", "Cliente", "CNPJ do cliente", "Cidade/UF", "Endereço da obra", "Responsável comercial", "Responsável técnico", "Tipo de piso", "Área total (m²)", "Valor do contrato (R$)", "Data do orçamento", "Data de aprovação", "Início previsto", "Término previsto", "Status da obra", "Observações"];
const MAX_ROWS = 10000;
const MAX_COLUMNS = 100;
const MAX_CELLS = 200000;
const MAX_SHEETS = 20;
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, trimValues: false });

function node(value: unknown): XmlNode {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as XmlNode : {};
}

function nodes(value: unknown): XmlNode[] {
  return value === undefined ? [] : (Array.isArray(value) ? value : [value]).map(node);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : textValue(node(value)["#text"]);
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function richText(value: unknown): string {
  const item = node(value);
  return text(item.t) + nodes(item.r).map((run) => text(run.t)).join("");
}

function parseXml(entries: Map<string, string>, path: string, optional = false): XmlNode {
  const xml = entries.get(path);
  if (xml === undefined && optional) return {};
  if (!xml || XMLValidator.validate(xml) !== true) throw new Error("WORKBOOK_INVALID");
  return node(parser.parse(xml));
}

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function integer(value: unknown): number {
  const raw = text(value);
  if (!/^\d{1,7}$/.test(raw)) throw new Error("WORKBOOK_INVALID");
  return Number(raw);
}

function zeroPaddingStyles(entries: Map<string, string>): number[] {
  const styles = node(parseXml(entries, "xl/styles.xml", true).styleSheet);
  const formats = new Map(nodes(node(styles.numFmts).numFmt).map((format) => [text(format["@_numFmtId"]), text(format["@_formatCode"])]));
  return nodes(node(styles.cellXfs).xf).map((style) => {
    const format = (formats.get(text(style["@_numFmtId"])) ?? "").replace(/"([^"]*)"/g, "$1").replace(/\\/g, "");
    const identifierFormat = /^0+$/.test(format) || (/^[0./ -]+$/.test(format) && /[/-]/.test(format));
    return identifierFormat ? Math.min(32, format.replace(/[^0]/g, "").length) : 0;
  });
}

function readRows(sheet: XmlNode, sharedStrings: string[], zeroPadding: number[]): WorksheetRow[] {
  const source = nodes(node(node(sheet.worksheet).sheetData).row);
  if (source.length > MAX_ROWS) throw new Error("WORKBOOK_LIMIT_EXCEEDED");
  let lastRow = 0;
  let totalCells = 0;
  return source.map((row) => {
    const sourceRow = row["@_r"] === undefined ? lastRow + 1 : integer(row["@_r"]);
    if (sourceRow > MAX_ROWS) throw new Error("WORKBOOK_LIMIT_EXCEEDED");
    if (sourceRow <= lastRow) throw new Error("WORKBOOK_INVALID");
    lastRow = sourceRow;
    const cells = new Map<number, Cell>();
    for (const raw of nodes(row.c)) {
      totalCells++;
      if (totalCells > MAX_CELLS) throw new Error("WORKBOOK_LIMIT_EXCEEDED");
      const address = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(text(raw["@_r"]));
      if (!address || Number(address[2]) !== sourceRow) throw new Error("WORKBOOK_INVALID");
      const column = [...address[1]].reduce((result, char) => result * 26 + char.charCodeAt(0) - 64, 0) - 1;
      if (column >= MAX_COLUMNS) throw new Error("WORKBOOK_LIMIT_EXCEEDED");
      if (cells.has(column)) throw new Error("WORKBOOK_INVALID");
      const type = text(raw["@_t"]) || "n";
      const formula = raw.f !== undefined;
      let value = text(raw.v);
      let unavailable = type === "e" || (formula && !value.trim());
      if (type === "s") {
        const index = /^\d+$/.test(value) ? Number(value) : -1;
        unavailable ||= sharedStrings[index] === undefined;
        value = sharedStrings[index] ?? "";
      } else if (type === "inlineStr") {
        value = richText(raw.is);
      } else if (!["n", "str", "d", "e"].includes(type)) {
        unavailable = true;
      }
      if (value.length > 32767) throw new Error("WORKBOOK_LIMIT_EXCEEDED");
      const styleIndex = raw["@_s"] === undefined ? 0 : integer(raw["@_s"]);
      cells.set(column, { value: value.trim(), numeric: type === "n", formula, unavailable, zeroPadding: zeroPadding[styleIndex] ?? 0 });
    }
    return { sourceRow, cells };
  });
}

function findHeader(rows: WorksheetRow[]): Header | undefined {
  for (const row of rows.slice(0, 50)) {
    const values = new Map([...row.cells].map(([column, cell]) => [normalize(cell.value), column]));
    for (const [kind, headers] of [["titles", TITLE_HEADERS], ["projects", PROJECT_HEADERS]] as const) {
      const columns = headers.map((header) => values.get(normalize(header)));
      if (columns.every((column) => column !== undefined)) return { kind, row: row.sourceRow, columns: columns as number[] };
    }
  }
}

function decimal(value: string): string {
  const match = /^(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d{1,3}))?$/.exec(value);
  if (!match) throw new Error("INVALID_AMOUNT");
  const fraction = match[2] ?? "";
  const exponent = Number(match[3] ?? 0);
  if (Math.abs(exponent) > 30 || match[1].length + fraction.length > 64) throw new Error("INVALID_AMOUNT");
  const digits = match[1] + fraction;
  const point = match[1].length + exponent;
  if (point <= 0) return `0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

function identifier(cell: Cell): string {
  if (!cell.numeric || !cell.value) return cell.value;
  const value = decimal(cell.value).replace(/\.0+$/, "");
  return /^\d+$/.test(value) ? value.padStart(cell.zeroPadding, "0") : value;
}

function amount(cell: Cell, blankIsZero = false): string {
  if (!cell.value && blankIsZero) return "0.00";
  try {
    return parseAmount(cell.numeric ? decimal(cell.value) : cell.value);
  } catch {
    throw new Error("INVALID_AMOUNT");
  }
}

function date(cell: Cell, epoch1904: boolean, required = false): string {
  if (!cell.value && !required) return "";
  if (cell.numeric) {
    if (!/^\d+(?:\.\d+)?$/.test(cell.value)) throw new Error("INVALID_DATE");
    const serial = Math.floor(Number(cell.value));
    if (!Number.isSafeInteger(serial) || serial < (epoch1904 ? 0 : 1) || serial > 2958465 || (!epoch1904 && serial === 60)) throw new Error("INVALID_DATE");
    const baseline = Date.UTC(epoch1904 ? 1904 : 1899, epoch1904 ? 0 : 11, epoch1904 ? 1 : 31);
    const parsed = new Date(baseline + (serial - (!epoch1904 && serial > 60 ? 1 : 0)) * 86400000);
    const result = parsed.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error("INVALID_DATE");
    return result;
  }
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cell.value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?Z?)?$/.exec(cell.value);
  if (!local && !iso) throw new Error("INVALID_DATE");
  const value = local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : `${iso![1]}-${iso![2]}-${iso![3]}`;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value || value < "1900-01-01") throw new Error("INVALID_DATE");
  return value;
}

function required(value: string): string {
  if (!value) throw new Error("MISSING_REQUIRED_VALUE");
  return value;
}

function parseTitle(cells: Cell[], sourceRow: number, sheetId: string, epoch1904: boolean): TitleRow {
  const direction = normalize(cells[1].value);
  if (direction !== "apagar" && direction !== "areceber") throw new Error("INVALID_DIRECTION");
  const nominalAmount = amount(cells[6]);
  const interestAmount = amount(cells[7], true);
  const totalAmount = fromCents(toCents(nominalAmount) + toCents(interestAmount));
  if (cells[8].value && amount(cells[8]) !== totalAmount) throw new Error("TOTAL_MISMATCH");
  return {
    id: `${sheetId}:${sourceRow}`, sourceRow,
    documentNumber: required(identifier(cells[0])), direction: direction === "apagar" ? "payable" : "receivable",
    category: cells[2].value, party: required(cells[3].value), issuedAt: date(cells[4], epoch1904), dueDate: date(cells[5], epoch1904, true),
    nominalAmount, interestAmount, totalAmount, paidAt: date(cells[9], epoch1904), status: required(cells[10].value), paymentMethod: cells[11].value, notes: cells[12].value,
  };
}

function parseProject(cells: Cell[], sourceRow: number, sheetId: string, epoch1904: boolean): ProjectRow {
  let area = "";
  if (cells[9].value) {
    try { area = amount(cells[9]); } catch { throw new Error("INVALID_AREA"); }
  }
  return {
    id: `${sheetId}:${sourceRow}`, sourceRow, projectNumber: required(identifier(cells[0])), name: required(cells[1].value), party: required(cells[2].value),
    taxId: identifier(cells[3]), city: cells[4].value, address: cells[5].value, salesContact: cells[6].value, technicalContact: cells[7].value, floorType: cells[8].value,
    area, totalAmount: amount(cells[10]), quotedAt: date(cells[11], epoch1904), approvedAt: date(cells[12], epoch1904), startsAt: date(cells[13], epoch1904),
    endsAt: date(cells[14], epoch1904), status: required(cells[15].value), notes: cells[16].value,
  };
}

function importSheet(rows: WorksheetRow[], header: Header, id: string, name: string, epoch1904: boolean): ImportedSheet {
  const issues: ImportIssue[] = [];
  const titles: TitleRow[] = [];
  const projects: ProjectRow[] = [];
  const empty: Cell = { value: "", numeric: false, formula: false, unavailable: false, zeroPadding: 0 };
  for (const row of rows) {
    if (row.sourceRow <= header.row) continue;
    const cells = header.columns.map((column) => row.cells.get(column) ?? empty);
    if (!cells.some((cell) => cell.value || cell.formula || cell.unavailable)) continue;
    try {
      if (cells.some((cell) => cell.unavailable)) throw new Error("FORMULA_VALUE_UNAVAILABLE");
      if (header.kind === "titles") titles.push(parseTitle(cells, row.sourceRow, id, epoch1904));
      else projects.push(parseProject(cells, row.sourceRow, id, epoch1904));
    } catch (error) {
      issues.push({ row: row.sourceRow, message: error instanceof Error ? error.message : "INVALID_AMOUNT" });
    }
  }
  return header.kind === "titles" ? { id, name, kind: "titles", rows: titles, issues } : { id, name, kind: "projects", rows: projects, issues };
}

export function parseSpreadsheetBuffer(buffer: ArrayBuffer | Uint8Array, fileName = "spreadsheet.xlsx"): ImportedWorkbook {
  if (!/\.xlsx$/i.test(fileName)) throw new Error("FILE_EXTENSION_INVALID");
  const entries = readSpreadsheetArchive(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
  const workbook = node(parseXml(entries, "xl/workbook.xml").workbook);
  const epoch = text(node(workbook.workbookPr)["@_date1904"]);
  const epoch1904 = epoch === "1" || epoch === "true";
  const sourceSheets = nodes(node(workbook.sheets).sheet);
  if (sourceSheets.length > MAX_SHEETS) throw new Error("WORKBOOK_LIMIT_EXCEEDED");
  const relationships = nodes(node(parseXml(entries, "xl/_rels/workbook.xml.rels").Relationships).Relationship);
  const sharedStrings = nodes(node(parseXml(entries, "xl/sharedStrings.xml", true).sst).si).map(richText);
  const styles = zeroPaddingStyles(entries);
  const sheets: ImportedSheet[] = [];
  const skippedSheets: string[] = [];
  const sheetNames = new Set<string>();
  for (let index = 0; index < sourceSheets.length; index++) {
    const source = sourceSheets[index];
    const name = text(source["@_name"]);
    if (!name || sheetNames.has(name)) throw new Error("WORKBOOK_INVALID");
    sheetNames.add(name);
    const relationship = relationships.find((item) => text(item["@_Id"]) === text(source["@_id"]));
    if (!relationship || text(relationship["@_TargetMode"]) === "External") throw new Error("WORKBOOK_INVALID");
    const target = text(relationship["@_Target"]);
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path)) {
      skippedSheets.push(name);
      continue;
    }
    const rows = readRows(parseXml(entries, path), sharedStrings, styles);
    const header = findHeader(rows);
    if (!header) skippedSheets.push(name);
    else sheets.push(importSheet(rows, header, `sheet-${index + 1}`, name, epoch1904));
  }
  if (!sheets.length) throw new Error("NO_SUPPORTED_SHEETS");
  return { fileName, sheets, skippedSheets };
}

export async function parseSpreadsheet(file: File): Promise<ImportedWorkbook> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("FILE_EXTENSION_INVALID");
  if (file.size > MAX_SPREADSHEET_BYTES) throw new Error("FILE_TOO_LARGE");
  if (!file.size) throw new Error("FILE_EMPTY");
  return parseSpreadsheetBuffer(await file.arrayBuffer(), file.name);
}
