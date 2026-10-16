import { fromCents, parseAmount, toCents } from "./money";
import type { ImportedSheet, ImportedWorkbook, ReportFilters, ReportGroup, ReportRow, SpreadsheetReport, TitleRow } from "./types";

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function defaultFilters(kind: ImportedSheet["kind"]): ReportFilters {
  const asOf = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return {
    search: "", direction: "all", status: "", category: "", party: "", paymentMethod: "", city: "",
    dateField: kind === "titles" ? "dueDate" : "startsAt", from: "", to: "", minAmount: "", maxAmount: "",
    dueStatus: "all", asOf, groupBy: "none", sortBy: "date", sortDirection: "asc", showNotes: false,
  };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateFilters(filters: ReportFilters): string | null {
  if (!validDate(filters.asOf)) return "Invalid reference date";
  if ((filters.from && !validDate(filters.from)) || (filters.to && !validDate(filters.to))) return "Invalid date range";
  if (filters.from && filters.to && filters.from > filters.to) return "End date must not precede start date";
  try {
    const minimum = filters.minAmount.trim() ? toCents(parseAmount(filters.minAmount)) : null;
    const maximum = filters.maxAmount.trim() ? toCents(parseAmount(filters.maxAmount)) : null;
    if (minimum !== null && maximum !== null && minimum > maximum) return "Maximum amount must not be less than minimum amount";
  } catch { return "Invalid amount range"; }
  return null;
}

function isCancelled(row: TitleRow): boolean {
  return /^(cancelad[oa]s?|anulad[oa]s?|cancelled|canceled)$/.test(normalizeText(row.status));
}

export function isSettled(row: TitleRow): boolean {
  return !isCancelled(row) && Boolean(row.paidAt || /^(pag[oa]s?|recebid[oa]s?|quitad[oa]s?|liquidad[oa]s?|paid|settled)$/.test(normalizeText(row.status)));
}

function isOpen(row: TitleRow): boolean {
  return !isCancelled(row) && !isSettled(row);
}

function rowDate(row: ReportRow, field: ReportFilters["dateField"]): string {
  return field in row ? String(row[field as keyof typeof row]) : "";
}

function matchesFilters(row: ReportRow, filters: ReportFilters): boolean {
  if (filters.search && !normalizeText(Object.values(row).join(" ")).includes(normalizeText(filters.search))) return false;
  if (filters.status && row.status !== filters.status) return false;
  if (filters.party && row.party !== filters.party) return false;
  const date = rowDate(row, filters.dateField);
  if ((filters.from || filters.to) && !date) return false;
  if (filters.from && date < filters.from) return false;
  if (filters.to && date > filters.to) return false;
  const amount = toCents(row.totalAmount);
  if (filters.minAmount.trim() && amount < toCents(parseAmount(filters.minAmount))) return false;
  if (filters.maxAmount.trim() && amount > toCents(parseAmount(filters.maxAmount))) return false;
  if ("direction" in row) {
    if (filters.direction !== "all" && row.direction !== filters.direction) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (filters.paymentMethod && row.paymentMethod !== filters.paymentMethod) return false;
    if (filters.dueStatus !== "all") {
      if (!isOpen(row) || !row.dueDate) return false;
      if (filters.dueStatus === "overdue" && row.dueDate >= filters.asOf) return false;
      if (filters.dueStatus === "today" && row.dueDate !== filters.asOf) return false;
      if (filters.dueStatus === "upcoming" && row.dueDate <= filters.asOf) return false;
    }
  } else if (filters.city && row.city !== filters.city) return false;
  return true;
}

function sumRows(rows: ReportRow[]): string {
  return fromCents(rows.reduce((total, row) => total + toCents(row.totalAmount), BigInt(0)));
}

function groupRows(rows: ReportRow[], filters: ReportFilters): ReportGroup[] {
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const key = filters.groupBy === "none" ? "" : filters.groupBy === "month" ? rowDate(row, filters.dateField).slice(0, 7) :
      filters.groupBy in row ? String(row[filters.groupBy as keyof typeof row]) : "";
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups].sort(([left], [right]) => left.localeCompare(right, "pt-BR")).map(([key, group]) => ({ key, rows: group, totalAmount: sumRows(group) }));
}

export function buildSpreadsheetReport(workbook: ImportedWorkbook, sheetId: string, filters: ReportFilters): SpreadsheetReport {
  const error = validateFilters(filters);
  if (error) throw new Error(error);
  const sheet = workbook.sheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw new Error("Worksheet not found");
  const rows: ReportRow[] = sheet.rows.filter((row) => matchesFilters(row, filters));
  rows.sort((left, right) => {
    let comparison: number;
    if (filters.sortBy === "amount") {
      const difference = toCents(left.totalAmount) - toCents(right.totalAmount);
      comparison = difference < BigInt(0) ? -1 : difference > BigInt(0) ? 1 : 0;
    } else {
      const leftValue = filters.sortBy === "party" ? left.party : rowDate(left, filters.dateField);
      const rightValue = filters.sortBy === "party" ? right.party : rowDate(right, filters.dateField);
      comparison = leftValue.localeCompare(rightValue, "pt-BR");
    }
    return comparison * (filters.sortDirection === "desc" ? -1 : 1) || left.sourceRow - right.sourceRow;
  });
  const titles = rows.filter((row): row is TitleRow => "direction" in row);
  const payable = sumRows(titles.filter((row) => row.direction === "payable"));
  const receivable = sumRows(titles.filter((row) => row.direction === "receivable"));
  return {
    fileName: workbook.fileName, sheetName: sheet.name, kind: sheet.kind, generatedAt: new Date().toISOString(),
    filters: { ...filters }, rows, groups: groupRows(rows, filters), sourceCount: sheet.rows.length,
    rejectedCount: sheet.issues.length,
    totals: {
      amount: sumRows(rows), payable, receivable, balance: fromCents(toCents(receivable) - toCents(payable)),
      overdue: sumRows(titles.filter((row) => isOpen(row) && Boolean(row.dueDate) && row.dueDate < filters.asOf)),
      settled: sumRows(titles.filter(isSettled)),
    },
  };
}
