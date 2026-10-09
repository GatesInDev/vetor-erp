import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { titleBalance } from "./balance";
import { financialTitleFiltersSchema, financialTitleInputSchema, financialTitleUpdateSchema } from "./schema";

const accountId = "6fa459ea-ee8a-4ca4-894e-db77e160355e";
const validInput = { accountType: "RECEIVABLE", accountId, kind: "BOLETO", number: "000045" };

test("financial titles require a single typed account link", () => {
  assert.equal(financialTitleInputSchema.parse(validInput).accountId, accountId);
  assert.equal(financialTitleInputSchema.safeParse({ ...validInput, accountType: "BOTH" }).success, false);
  assert.equal(financialTitleInputSchema.safeParse({ ...validInput, accountId: undefined }).success, false);
  assert.equal(financialTitleInputSchema.safeParse({ ...validInput, payableId: accountId, receivableId: accountId }).success, false);
});

test("financial title metadata cannot override ownership or financial values", () => {
  for (const extra of [{ companyId: accountId }, { userId: accountId }, { amount: "120.00" }, { dueAt: "2026-09-28" }, { paid: true }, { status: "SETTLED" }]) {
    assert.equal(financialTitleInputSchema.safeParse({ ...validInput, ...extra }).success, false);
  }
});

test("financial title metadata keeps leading zeroes and normalizes display separators", () => {
  const digits = "0".repeat(43) + "1234";
  const barcode = "0".repeat(40) + "1234";
  const input = financialTitleInputSchema.parse({ ...validInput, digitLine: `${digits.slice(0, 5)}.${digits.slice(5, 20)} ${digits.slice(20)}`, barcode });
  assert.equal(input.number, "000045");
  assert.equal(input.digitLine, digits);
  assert.equal(input.barcode, barcode);
});

test("financial title banking metadata is optional without generating bank identifiers", () => {
  const input = financialTitleInputSchema.parse(validInput);
  assert.equal(input.bankName, "");
  assert.equal(input.digitLine, "");
  assert.equal(input.barcode, "");
  assert.equal(financialTitleInputSchema.parse({ ...validInput, digitLine: " ", barcode: "" }).digitLine, "");
});

test("financial title banking metadata rejects invalid digits and lengths", () => {
  for (const digitLine of ["123", "1".repeat(46), "1".repeat(49), `X${"1".repeat(46)}`, 123]) {
    assert.equal(financialTitleInputSchema.safeParse({ ...validInput, digitLine }).success, false);
  }
  assert.equal(financialTitleInputSchema.safeParse({ ...validInput, digitLine: "1".repeat(48) }).success, true);
  for (const barcode of ["1".repeat(43), "1".repeat(45), `+${"1".repeat(44)}`]) {
    assert.equal(financialTitleInputSchema.safeParse({ ...validInput, barcode }).success, false);
  }
});

test("financial title input enforces bounded metadata and document kind", () => {
  for (const extra of [{ number: " " }, { number: "1".repeat(81) }, { bankName: "a".repeat(121) }, { notes: "a".repeat(2001) }, { kind: "ISSUED" }]) {
    assert.equal(financialTitleInputSchema.safeParse({ ...validInput, ...extra }).success, false);
  }
});

test("financial title updates require a valid revision", () => {
  assert.equal(financialTitleUpdateSchema.parse({ ...validInput, revision: 1 }).revision, 1);
  for (const revision of [undefined, 0, -1, 1.5, 2147483647]) {
    assert.equal(financialTitleUpdateSchema.safeParse({ ...validInput, revision }).success, false);
  }
});

test("financial title filters reject owner overrides and unsupported states", () => {
  assert.deepEqual(financialTitleFiltersSchema.parse({ status: "PARTIAL", search: "  00045  " }), { status: "PARTIAL", search: "00045" });
  assert.equal(financialTitleFiltersSchema.safeParse({ companyId: accountId }).success, false);
  assert.equal(financialTitleFiltersSchema.safeParse({ status: "PAID" }).success, false);
});

test("financial title balance derives open and partially settled states with exact cents", () => {
  const amount = new Prisma.Decimal("100.10");
  assert.deepEqual(titleBalance(amount, new Prisma.Decimal(0), false), { amount: "100.10", settledAmount: "0.00", remaining: "100.10", status: "OPEN" });
  assert.deepEqual(titleBalance(amount, new Prisma.Decimal("25.05"), false), { amount: "100.10", settledAmount: "25.05", remaining: "75.05", status: "PARTIAL" });
});

test("financial title settlement never produces a negative remaining balance", () => {
  assert.deepEqual(titleBalance(new Prisma.Decimal("100.10"), new Prisma.Decimal("100.10"), false), { amount: "100.10", settledAmount: "100.10", remaining: "0.00", status: "SETTLED" });
  assert.equal(titleBalance(new Prisma.Decimal("100.10"), new Prisma.Decimal("101.10"), false).remaining, "0.00");
});

test("cancelled source accounts produce cancelled titles without an outstanding balance", () => {
  assert.deepEqual(titleBalance(new Prisma.Decimal("100.10"), new Prisma.Decimal("25.05"), true), { amount: "100.10", settledAmount: "25.05", remaining: "0.00", status: "CANCELLED" });
});
