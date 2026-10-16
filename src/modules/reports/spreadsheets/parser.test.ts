import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { parseSpreadsheet, parseSpreadsheetBuffer } from "./parser";

const titleHeaders = ["Nº Documento", "Tipo", "Categoria", "Favorecido / Pagador", "Data Emissão", "Data Vencimento", "Valor Nominal", "Juros / Multa", "Valor Total", "Data Pagamento", "Status", "Forma de Pagamento", "Observações"];
const projectHeaders = ["Nº da Obra", "Nome da obra", "Cliente", "CNPJ do cliente", "Cidade/UF", "Endereço da obra", "Responsável comercial", "Responsável técnico", "Tipo de piso", "Área total (m²)", "Valor do contrato (R$)", "Data do orçamento", "Data de aprovação", "Início previsto", "Término previsto", "Status da obra", "Observações"];
type TestCell = string | { value?: string; type?: string; formula?: string; style?: string };

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function row(number: number, values: TestCell[]): string {
  const cells = values.map((cell, index) => {
    const reference = `${String.fromCharCode(66 + index)}${number}`;
    if (typeof cell === "string") return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
    return `<c r="${reference}"${cell.type ? ` t="${cell.type}"` : ""}${cell.style ? ` s="${cell.style}"` : ""}>${cell.formula !== undefined ? `<f>${escapeXml(cell.formula)}</f>` : ""}${cell.value !== undefined ? `<v>${escapeXml(cell.value)}</v>` : ""}</c>`;
  });
  return `<row r="${number}">${cells.join("")}</row>`;
}

function titleRow(overrides: Record<number, TestCell> = {}): TestCell[] {
  const values: TestCell[] = ["000123", "A Pagar", "Serviços", "Supplier Example", "14/10/2026", "2026-10-20", { value: "1234.56" }, { value: "0.44" }, { value: "1235", formula: "H7+I7" }, "", "Pendente", "Boleto", "Sample"];
  for (const [key, value] of Object.entries(overrides)) values[Number(key)] = value;
  return values;
}

function workbook(sheets: { name: string; rows: string }[], options: { epoch1904?: string; entries?: Record<string, string>; level?: 0 | 6 } = {}): Uint8Array {
  const contents: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "xl/workbook.xml": strToU8(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="${options.epoch1904 ?? "0"}"/><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Target="worksheets/sheet${index + 1}.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>`).join("")}</Relationships>`),
  };
  for (let index = 0; index < sheets.length; index++) contents[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheets[index].rows}</sheetData></worksheet>`);
  for (const [path, xml] of Object.entries(options.entries ?? {})) contents[path] = strToU8(xml);
  return zipSync(contents, { level: options.level ?? 6 });
}

function titleWorkbook(rows = row(7, titleRow()), options: Parameters<typeof workbook>[1] = {}): Uint8Array {
  return workbook([{ name: "Títulos", rows: row(2, ["Overview"]) + row(6, titleHeaders) + rows }], options);
}

test("imports header offset, exact money, identifiers, formula totals, and genuine blank rows", () => {
  const result = parseSpreadsheetBuffer(titleWorkbook(row(7, titleRow()) + row(8, Array.from({ length: 13 }, () => ({})))), "Boletos.xlsx");
  assert.equal(result.sheets.length, 1);
  const sheet = result.sheets[0];
  assert.equal(sheet.kind, "titles");
  if (sheet.kind !== "titles") return;
  assert.equal(sheet.rows.length, 1);
  assert.equal(sheet.rows[0].sourceRow, 7);
  assert.equal(sheet.rows[0].documentNumber, "000123");
  assert.equal(sheet.rows[0].nominalAmount, "1234.56");
  assert.equal(sheet.rows[0].interestAmount, "0.44");
  assert.equal(sheet.rows[0].totalAmount, "1235.00");
  assert.equal(sheet.rows[0].dueDate, "2026-10-20");
  assert.deepEqual(sheet.issues, []);
});

test("keeps invalid nonblank rows visible with their exact source row", () => {
  const rows = [
    row(7, titleRow({ 6: "1.234,567" })),
    row(9, titleRow({ 5: "31/02/2026" })),
    row(10, titleRow({ 1: "Unknown" })),
    row(11, titleRow({ 3: "" })),
    row(12, titleRow({ 8: { formula: "H12+I12" } })),
    row(13, titleRow({ 8: { formula: "H13+I13", value: "999" } })),
    row(14, titleRow()),
  ].join("");
  const sheet = parseSpreadsheetBuffer(titleWorkbook(rows)).sheets[0];
  assert.equal(sheet.rows.length, 1);
  assert.deepEqual(sheet.issues, [
    { row: 7, message: "INVALID_AMOUNT" },
    { row: 9, message: "INVALID_DATE" },
    { row: 10, message: "INVALID_DIRECTION" },
    { row: 11, message: "MISSING_REQUIRED_VALUE" },
    { row: 12, message: "FORMULA_VALUE_UNAVAILABLE" },
    { row: 13, message: "TOTAL_MISMATCH" },
  ]);
});

test("preserves Brazilian amounts, scientific numeric notation, and large exact decimals", () => {
  const rows = row(7, titleRow({ 6: "1.234,56", 7: { value: "4.4E-1" }, 8: "1.235,00" })) + row(8, titleRow({ 6: { value: "88259496234518.57" }, 7: "0", 8: "" }));
  const sheet = parseSpreadsheetBuffer(titleWorkbook(rows)).sheets[0];
  assert.equal(sheet.rows[0].totalAmount, "1235.00");
  assert.equal(sheet.rows[1].totalAmount, "88259496234518.57");
});

test("reads both Excel date systems without local timezone shifts and rejects fictitious leap day", () => {
  const rows = row(7, titleRow({ 4: { value: "1" }, 5: { value: "61.75" } })) + row(8, titleRow({ 5: { value: "60" } }));
  const sheet = parseSpreadsheetBuffer(titleWorkbook(rows)).sheets[0];
  if (sheet.kind !== "titles") return;
  assert.equal(sheet.rows[0].issuedAt, "1900-01-01");
  assert.equal(sheet.rows[0].dueDate, "1900-03-01");
  assert.deepEqual(sheet.issues, [{ row: 8, message: "INVALID_DATE" }]);
  for (const epoch1904 of ["1", "true"]) {
    const modern = parseSpreadsheetBuffer(titleWorkbook(row(7, titleRow({ 4: { value: "0" }, 5: { value: "1" } })), { epoch1904 })).sheets[0];
    if (modern.kind !== "titles") return;
    assert.equal(modern.rows[0].issuedAt, "1904-01-01");
    assert.equal(modern.rows[0].dueDate, "1904-01-02");
  }
});

test("imports projects, shared rich strings, and zero-padded numeric identifiers", () => {
  const project: TestCell[] = [{ value: "17", style: "1" }, { type: "s", value: "0" }, "Client Example", { value: "12345678000100", style: "2" }, "São Paulo/SP", "Example Street", "Sales", "Engineer", "Concrete", "200,50", "6.000,00", "14/10/2026", "", "20/10/2026", "21/10/2026", "Aprovada", ""];
  const result = parseSpreadsheetBuffer(workbook([{ name: "Obras", rows: row(6, projectHeaders) + row(7, project) }, { name: "Notes", rows: row(1, ["Other data"]) }], { entries: {
    "xl/sharedStrings.xml": '<sst><si><r><t>Example </t></r><r><t>Project</t></r></si></sst>',
    "xl/styles.xml": '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="000000"/><numFmt numFmtId="165" formatCode="000000000000000"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/></cellXfs></styleSheet>',
  } }));
  const sheet = result.sheets[0];
  if (sheet.kind !== "projects") return;
  assert.equal(sheet.rows[0].projectNumber, "000017");
  assert.equal(sheet.rows[0].name, "Example Project");
  assert.equal(sheet.rows[0].taxId, "012345678000100");
  assert.equal(sheet.rows[0].area, "200.50");
  assert.equal(sheet.rows[0].totalAmount, "6000.00");
  assert.deepEqual(result.skippedSheets, ["Notes"]);
});

test("distinguishes identifier masks from decimal number formatting", () => {
  const rows = row(7, titleRow({ 0: { value: "17", style: "1" } })) + row(8, titleRow({ 0: { value: "12345678000100", style: "2" } }));
  const sheet = parseSpreadsheetBuffer(titleWorkbook(rows, { entries: {
    "xl/styles.xml": '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="0.00"/><numFmt numFmtId="165" formatCode="00.000.000/0000-00"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/></cellXfs></styleSheet>',
  } })).sheets[0];
  if (sheet.kind !== "titles") return;
  assert.equal(sheet.rows[0].documentNumber, "17");
  assert.equal(sheet.rows[1].documentNumber, "12345678000100");
});

test("reports spreadsheet error cells and missing shared strings instead of dropping rows", () => {
  const rows = row(7, titleRow({ 8: { type: "e", value: "#VALUE!", formula: "H7+I7" } })) + row(8, titleRow({ 3: { type: "s", value: "999" } }));
  const sheet = parseSpreadsheetBuffer(titleWorkbook(rows)).sheets[0];
  assert.equal(sheet.rows.length, 0);
  assert.deepEqual(sheet.issues, [{ row: 7, message: "FORMULA_VALUE_UNAVAILABLE" }, { row: 8, message: "FORMULA_VALUE_UNAVAILABLE" }]);
});

test("rejects archive traversal, external sheets, and duplicate cell references", () => {
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook(undefined, { entries: { "../outside.xml": "<x/>" } })), /WORKBOOK_INVALID/);
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook(undefined, { entries: {
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="https://example.com/sheet.xml" TargetMode="External"/></Relationships>',
  } })), /WORKBOOK_INVALID/);
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook('<row r="7"><c r="B7"><v>1</v></c><c r="B7"><v>2</v></c></row>')), /WORKBOOK_INVALID/);
});

test("rejects unsafe XML, embedded macros, and malformed archives", () => {
  assert.throws(() => parseSpreadsheetBuffer(new Uint8Array()), /FILE_EMPTY/);
  assert.throws(() => parseSpreadsheetBuffer(strToU8("fake zip")), /WORKBOOK_INVALID/);
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook(), "Boletos.xls"), /FILE_EXTENSION_INVALID/);
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook(undefined, { entries: { "xl/evil.xml": '<!DOCTYPE x [<!ENTITY attack "unsafe">]><x>&attack;</x>' } })), /WORKBOOK_UNSAFE/);
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook(undefined, { entries: { "xl/vbaProject.bin": "macro" } })), /WORKBOOK_UNSAFE/);
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook().slice(0, -10)), /WORKBOOK_INVALID/);
});

test("bounds compression, expanded archive size, worksheet dimensions, and number of sheets", () => {
  assert.throws(() => parseSpreadsheetBuffer(new Uint8Array(5 * 1024 * 1024 + 1)), /FILE_TOO_LARGE/);
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook(undefined, { entries: { "xl/oversized.xml": "a".repeat(8 * 1024 * 1024 + 1) } })), /WORKBOOK_TOO_LARGE/);
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook(row(10001, titleRow()))), /WORKBOOK_LIMIT_EXCEEDED/);
  assert.throws(() => parseSpreadsheetBuffer(titleWorkbook('<row r="7"><c r="CW7"><v>1</v></c></row>')), /WORKBOOK_LIMIT_EXCEEDED/);
  assert.throws(() => parseSpreadsheetBuffer(workbook(Array.from({ length: 21 }, (_, index) => ({ name: `Sheet ${index}`, rows: row(6, titleHeaders) })))), /WORKBOOK_LIMIT_EXCEEDED/);
});

test("accepts a browser File through the public import API", async () => {
  const bytes = titleWorkbook();
  const file = new File([Uint8Array.from(bytes).buffer], "Boletos.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const result = await parseSpreadsheet(file);
  assert.equal(result.fileName, "Boletos.xlsx");
  assert.equal(result.sheets[0].rows.length, 1);
});
