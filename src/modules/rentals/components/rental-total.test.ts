import assert from "node:assert/strict";
import test from "node:test";
import { formatRentalTotal } from "./rental-total";

function format(values: string[], locale: string, decimalPlaces: number) {
  return formatRentalTotal(values, locale, decimalPlaces).replaceAll("\u00a0", " ");
}

test("rental totals preserve cents when aggregated balances exceed safe numeric precision", () => {
  assert.equal(format(["99999999999999.99", "0.02"], "pt-BR", 2), "R$ 100.000.000.000.000,01");
  assert.equal(format(["99999999999999.99", "0.02"], "en-US", 2), "R$100,000,000,000,000.01");
  assert.equal(format(["99999999999999.99"], "en-US", 2), "R$99,999,999,999,999.99");
});

test("rental totals round after summing and respect display decimal preferences", () => {
  assert.equal(format(["0.04", "0.04"], "pt-BR", 1), "R$ 0,1");
  assert.equal(format(["99.5"], "en-US", 0), "R$100");
  assert.equal(format(["1.2", "0.03"], "en-US", 6), "R$1.230000");
  assert.equal(format([], "pt-BR", 3), "R$ 0,000");
});
