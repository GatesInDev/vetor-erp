import assert from "node:assert/strict";
import test from "node:test";
import { payableOriginFields } from "./payable-fields";
import { reportDataFilterSchema, reportSourceIds, reportSources } from "./sources";

test("payable report fields preserve contract bindings and expose rental document origins", () => {
  assert.deepEqual(payableOriginFields({ contract: { number: "CTR-001" }, rentalCharge: null }), {
    originType: "Contrato", originNumber: "CTR-001", contractNumber: "CTR-001", rentalNumber: "", documentNumber: "", equipmentName: "",
  });
  assert.deepEqual(payableOriginFields({ contract: null, rentalCharge: { documentNumber: "DOC-045", rental: { number: "RENT-001", equipmentName: "Floor grinder" } } }), {
    originType: "Locação", originNumber: "RENT-001", contractNumber: "", rentalNumber: "RENT-001", documentNumber: "DOC-045", equipmentName: "Floor grinder",
  });
  const keys = reportSources.find((source) => source.id === "payables")!.fields.map((field) => field.key);
  for (const key of ["contractNumber", "originNumber", "originType", "rentalNumber", "documentNumber", "equipmentName"]) assert.ok(keys.includes(key));
});

test("report sources have unique identifiers and expose only printable fields", () => {
  assert.equal(new Set(reportSources.map((source) => source.id)).size, reportSourceIds.length);
  for (const source of reportSources) {
    assert.equal(new Set(source.fields.map((field) => field.key)).size, source.fields.length);
    assert.ok(source.fields.every((field) => !/id|encrypted|bank|password/i.test(field.key)));
  }
  assert.deepEqual(reportSources.filter((source) => source.financial).map((source) => source.id), ["invoices", "payables", "receivables"]);
});

test("report filters validate calendar dates and inclusive period order", () => {
  for (const date of ["2026-02-30", "2025-02-29", "2026-13-01", "09/26/2026", "2026-9-01", ""]) {
    assert.equal(reportDataFilterSchema.safeParse({ source: "invoices", from: date }).success, false);
  }
  assert.equal(reportDataFilterSchema.safeParse({ source: "invoices", from: "2024-02-29", to: "2024-02-29" }).success, true);
  assert.equal(reportDataFilterSchema.safeParse({ source: "invoices", from: "2026-09-30", to: "2026-09-01" }).success, false);
  assert.equal(reportDataFilterSchema.safeParse({ source: "invoices", to: "2026-09-26" }).success, true);
});

test("report filters reject tenant overrides, unknown sources and malformed identifiers", () => {
  for (const input of [
    { source: "projects", companyId: "a1858e88-71bb-4cbc-861f-e9ca4d0b5fba" },
    { source: "users" },
    { source: "invoices", projectId: "invalid" },
    { source: "partners", recordId: "invalid" },
    { source: "projects", sql: "SELECT * FROM User" },
    {},
  ]) assert.equal(reportDataFilterSchema.safeParse(input).success, false);
});

test("report filters permit only the filters applicable to each source", () => {
  const recordId = "a1858e88-71bb-4cbc-861f-e9ca4d0b5fba";
  assert.deepEqual(reportDataFilterSchema.parse({ source: "manual" }), { source: "manual" });
  assert.equal(reportDataFilterSchema.safeParse({ source: "manual", recordId }).success, false);
  assert.equal(reportDataFilterSchema.safeParse({ source: "projects", from: "2026-09-01" }).success, false);
  assert.equal(reportDataFilterSchema.safeParse({ source: "inventory", projectId: recordId }).success, false);
  assert.equal(reportDataFilterSchema.safeParse({ source: "stockMovements", projectId: recordId, recordId, from: "2026-09-01" }).success, true);
  assert.equal(reportDataFilterSchema.safeParse({ source: "projects", recordId }).success, true);
});
