import assert from "node:assert/strict";
import test from "node:test";
import { formatAccountingAmount } from "./accounting-format";

function format(value: string, locale: string) {
  return formatAccountingAmount(value, locale).replaceAll("\u00a0", " ");
}

test("accounting currency preserves cents beyond the safe integer range in both locales", () => {
  assert.equal(format("10000000000000000.01", "pt-BR"), "R$ 10.000.000.000.000.000,01");
  assert.equal(format("10000000000000000.01", "en-US"), "R$10,000,000,000,000,000.01");
  assert.equal(format("-10000000000000000.01", "en-US"), "-R$10,000,000,000,000,000.01");
});

test("accounting currency preserves negative fractions and two decimal places", () => {
  assert.equal(format("-0.10", "pt-BR"), "-R$ 0,10");
  assert.equal(format("-0.10", "en-US"), "-R$0.10");
  assert.equal(format("0.00", "pt-BR"), "R$ 0,00");
  assert.equal(format("1.5", "en-US"), "R$1.50");
});
