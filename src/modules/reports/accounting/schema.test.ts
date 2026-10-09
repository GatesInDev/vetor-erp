import assert from "node:assert/strict";
import test from "node:test";
import { accountingDateSchema, accountingDayEndExclusive, accountingDayStart, accountingDefaults, balanceSheetFiltersSchema, trialBalanceFiltersSchema } from "./schema";

test("accounting defaults use the current UTC date and month", () => {
  assert.deepEqual(accountingDefaults(new Date("2026-09-01T00:30:00Z")), { asOf: "2026-09-01", from: "2026-09-01", to: "2026-09-01" });
});

test("accounting filters accept real calendar dates and reject malformed dates", () => {
  assert.equal(accountingDateSchema.parse("2024-02-29"), "2024-02-29");
  for (const value of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-9-01", "2026-09-01T00:00:00Z", "", "0000-01-01"]) {
    assert.equal(accountingDateSchema.safeParse(value).success, false);
  }
});

test("accounting date limits cover the entire last UTC day and no part of the next", () => {
  assert.equal(accountingDayStart("2026-09-01").toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(accountingDayEndExclusive("2026-09-30").toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(accountingDayEndExclusive("2024-02-29").toISOString(), "2024-03-01T00:00:00.000Z");
  assert.equal(accountingDayEndExclusive("2026-12-31").toISOString(), "2027-01-01T00:00:00.000Z");
});

test("accounting filters reject reversed periods and unknown or ownership fields", () => {
  assert.equal(trialBalanceFiltersSchema.safeParse({ from: "2026-09-02", to: "2026-09-01" }).success, false);
  assert.equal(trialBalanceFiltersSchema.safeParse({ from: "2026-09-01", to: "2026-09-01" }).success, true);
  assert.equal(balanceSheetFiltersSchema.safeParse({ companyId: "company-a" }).success, false);
  assert.equal(balanceSheetFiltersSchema.safeParse({ from: "2026-09-01" }).success, false);
  assert.equal(trialBalanceFiltersSchema.safeParse({ asOf: "2026-09-01" }).success, false);
});
