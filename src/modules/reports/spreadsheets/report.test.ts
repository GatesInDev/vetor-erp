import assert from "node:assert/strict";
import test from "node:test";
import { fromCents, parseAmount, toCents } from "./money";
import { buildSpreadsheetReport, defaultFilters, validateFilters } from "./report";
import type { ImportedWorkbook, ProjectRow, TitleRow } from "./types";

function title(overrides: Partial<TitleRow> = {}): TitleRow {
  return {
    id: "title-7", sourceRow: 7, documentNumber: "00017", direction: "payable", category: "Manutenção", party: "Supplier",
    issuedAt: "2026-10-01", dueDate: "2026-10-10", nominalAmount: "10.10", interestAmount: "0.00", totalAmount: "10.10",
    paidAt: "", status: "Pendente", paymentMethod: "Boleto", notes: "", ...overrides,
  };
}

function workbook(rows: TitleRow[]): ImportedWorkbook {
  return { fileName: "sample.xlsx", sheets: [{ id: "titles", name: "Títulos", kind: "titles", rows, issues: [] }], skippedSheets: [] };
}

function filters() {
  return { ...defaultFilters("titles"), asOf: "2026-10-14" };
}

test("currency conversion preserves exact large values and Brazilian decimal strings", () => {
  assert.equal(parseAmount("R$ 1.234,50"), "1234.50");
  assert.equal(parseAmount("000.10"), "0.10");
  assert.equal(parseAmount("12.3000"), "12.30");
  assert.equal(fromCents(toCents("9007199254740991.99") + toCents("0.01")), "9007199254740992.00");
  assert.equal(fromCents(BigInt(-1)), "-0.01");
  for (const invalid of ["", "12abc", "-1.00", "1.005", "1.234", "1,23.45", "NaN", "Infinity", "1e100"]) {
    assert.throws(() => parseAmount(invalid), /Invalid monetary amount/);
  }
});

test("report reconciles all selected rows and separates open overdue from settled or cancelled titles", () => {
  const source = workbook([
    title(), title({ id: "paid", sourceRow: 8, totalAmount: "0.20", status: "Pago" }),
    title({ id: "canceled", sourceRow: 9, totalAmount: "2.00", status: "Cancelado" }),
    title({ id: "receivable", sourceRow: 10, totalAmount: "100.00", direction: "receivable", dueDate: "2026-10-15" }),
    title({ id: "paid-date", sourceRow: 11, totalAmount: "3.00", paidAt: "2026-10-12" }),
  ]);
  const report = buildSpreadsheetReport(source, "titles", filters());
  assert.deepEqual(report.totals, { amount: "115.30", payable: "15.30", receivable: "100.00", balance: "84.70", overdue: "10.10", settled: "3.20" });
  assert.equal(report.rows.length, 5);
  assert.equal(report.groups[0].totalAmount, report.totals.amount);
  assert.equal(source.sheets[0].rows[0].id, "title-7");
});

test("due-date filters use inclusive boundaries and exclude missing dates when a range is active", () => {
  const source = workbook([title(), title({ id: "end", dueDate: "2026-10-14" }), title({ id: "later", dueDate: "2026-10-15" }), title({ id: "missing", dueDate: "" })]);
  const report = buildSpreadsheetReport(source, "titles", { ...filters(), from: "2026-10-10", to: "2026-10-14" });
  assert.deepEqual(report.rows.map((row) => row.id), ["title-7", "end"]);
  assert.equal(buildSpreadsheetReport(source, "titles", { ...filters(), dueStatus: "today" }).rows[0].id, "end");
  assert.equal(buildSpreadsheetReport(source, "titles", { ...filters(), dueStatus: "upcoming" }).rows[0].id, "later");
});

test("filters combine accent-insensitive search, direction, exact amounts, categories and payment methods", () => {
  const source = workbook([title(), title({ id: "other", party: "Other", totalAmount: "10.20" }), title({ id: "income", direction: "receivable" })]);
  const report = buildSpreadsheetReport(source, "titles", {
    ...filters(), search: "manutencao", direction: "payable", category: "Manutenção", party: "Supplier", paymentMethod: "Boleto", minAmount: "10,10", maxAmount: "10.10",
  });
  assert.deepEqual(report.rows.map((row) => row.id), ["title-7"]);
});

test("groups reconcile totals and sorting preserves exact large amounts without changing source order", () => {
  const source = workbook([title({ totalAmount: "9007199254740991.99" }), title({ id: "smaller", sourceRow: 8, totalAmount: "9007199254740991.98" })]);
  const options = { ...filters(), groupBy: "category" as const, sortBy: "amount" as const };
  const report = buildSpreadsheetReport(source, "titles", options);
  assert.equal(report.rows[0].id, "smaller");
  assert.equal(report.groups[0].key, "Manutenção");
  assert.equal(report.groups[0].totalAmount, "18014398509481983.97");
  options.search = "changed";
  assert.equal(report.filters.search, "");
  assert.equal(source.sheets[0].rows[0].id, "title-7");
});

test("project reporting filters contracts independently of financial titles", () => {
  const project: ProjectRow = {
    id: "project-7", sourceRow: 7, projectNumber: "CHA-001", name: "Project", party: "Client", taxId: "00123", city: "Chapecó - SC",
    address: "", salesContact: "", technicalContact: "", floorType: "Polished", area: "200.00", totalAmount: "6000.00",
    quotedAt: "2026-10-01", approvedAt: "2026-10-02", startsAt: "2026-10-03", endsAt: "2026-10-04", status: "Concluído", notes: "",
  };
  const source = workbook([title()]);
  source.sheets.push({ id: "projects", name: "Obras", kind: "projects", rows: [project], issues: [{ row: 8, message: "Invalid amount" }] });
  const report = buildSpreadsheetReport(source, "projects", { ...defaultFilters("projects"), city: "Chapecó - SC", from: "2026-10-03", to: "2026-10-03" });
  assert.equal(report.rows.length, 1);
  assert.equal(report.totals.amount, "6000.00");
  assert.equal(report.totals.receivable, "0.00");
  assert.equal(report.rejectedCount, 1);
  assert.equal(report.sourceCount, 1);
});

test("invalid filters fail explicitly and empty selections produce zero totals", () => {
  assert.equal(validateFilters({ ...filters(), from: "2026-02-30" }), "Invalid date range");
  assert.equal(validateFilters({ ...filters(), from: "2026-10-15", to: "2026-10-14" }), "End date must not precede start date");
  assert.equal(validateFilters({ ...filters(), minAmount: "1.999" }), "Invalid amount range");
  assert.equal(validateFilters({ ...filters(), minAmount: "10", maxAmount: "0" }), "Maximum amount must not be less than minimum amount");
  assert.throws(() => buildSpreadsheetReport(workbook([]), "titles", { ...filters(), asOf: "invalid" }), /Invalid reference date/);
  assert.throws(() => buildSpreadsheetReport(workbook([]), "missing", filters()), /Worksheet not found/);
  const empty = buildSpreadsheetReport(workbook([title()]), "titles", { ...filters(), search: "no match" });
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.totals.amount, "0.00");
});
