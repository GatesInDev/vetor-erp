import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { calculateBalanceSheet, calculateTrialBalance, type LedgerSums } from "./calculations";
import type { AccountingAccount } from "./types";

const accounts: AccountingAccount[] = [
  { id: "bank", code: "1.01", name: "Bank", type: "ASSET", active: false },
  { id: "receivable", code: "1.02", name: "Receivables", type: "ASSET", active: true },
  { id: "depreciation", code: "1.03", name: "Accumulated depreciation", type: "ASSET", active: true },
  { id: "payable", code: "2.01", name: "Payables", type: "LIABILITY", active: true },
  { id: "capital", code: "3.01", name: "Capital", type: "EQUITY", active: true },
  { id: "retained", code: "3.02", name: "Retained earnings", type: "EQUITY", active: true },
  { id: "revenue", code: "4.01", name: "Revenue", type: "REVENUE", active: true },
  { id: "cost", code: "5.01", name: "Cost", type: "COST", active: true },
  { id: "expense", code: "6.01", name: "Expense", type: "EXPENSE", active: true },
];

function ledger(entries: [string, string, string][]): LedgerSums {
  return {
    debits: entries.map(([accountId, , amount]) => ({ accountId, amount: new Prisma.Decimal(amount) })),
    credits: entries.map(([, accountId, amount]) => ({ accountId, amount: new Prisma.Decimal(amount) })),
  };
}

test("trial balance combines opening balances and period debits and credits", () => {
  const opening = ledger([["bank", "capital", "100.00"]]);
  const period = ledger([["receivable", "revenue", "200.00"], ["revenue", "receivable", "50.00"], ["expense", "bank", "100.00"]]);
  const report = calculateTrialBalance(accounts, opening, period);
  const bank = report.lines.find((line) => line.id === "bank")!;
  assert.equal(bank.openingBalance, "100.00");
  assert.equal(bank.openingDebit, "100.00");
  assert.equal(bank.credits, "100.00");
  assert.equal(bank.closingBalance, "0.00");
  assert.equal(bank.active, false);
  assert.equal(report.lines.find((line) => line.id === "revenue")?.closingCredit, "150.00");
  assert.equal(report.totals.debits, "350.00");
  assert.equal(report.totals.credits, "350.00");
  assert.equal(report.totals.closingDebit, "250.00");
  assert.equal(report.totals.closingCredit, "250.00");
  assert.equal(report.balanced, true);
});

test("empty accounts remain available for the presentation zero balance toggle", () => {
  const report = calculateTrialBalance(accounts, ledger([]), ledger([]));
  assert.equal(report.lines.length, accounts.length);
  assert.equal(report.lines.find((line) => line.id === "bank")?.active, false);
  assert.equal(report.lines.every((line) => line.closingBalance === "0.00"), true);
  assert.equal(report.balanced, true);
});

test("balance sheet includes unclosed earnings without creating closing postings", () => {
  const report = calculateBalanceSheet(accounts, ledger([
    ["bank", "capital", "100.00"], ["receivable", "revenue", "200.00"], ["cost", "payable", "40.00"], ["expense", "bank", "10.00"],
  ]));
  assert.equal(report.assets.total, "290.00");
  assert.equal(report.liabilities.total, "40.00");
  assert.equal(report.equity.total, "100.00");
  assert.equal(report.unclosedEarnings, "150.00");
  assert.equal(report.equityIncludingEarnings, "250.00");
  assert.equal(report.liabilitiesAndEquity, "290.00");
  assert.equal(report.difference, "0.00");
  assert.equal(report.balanced, true);
});

test("closing postings transfer results into equity without double counting", () => {
  const report = calculateBalanceSheet(accounts, ledger([
    ["bank", "revenue", "100.00"], ["expense", "bank", "40.00"],
    ["revenue", "retained", "100.00"], ["retained", "expense", "40.00"],
  ]));
  assert.equal(report.assets.total, "60.00");
  assert.equal(report.equity.total, "60.00");
  assert.equal(report.unclosedEarnings, "0.00");
  assert.equal(report.liabilitiesAndEquity, "60.00");
  assert.equal(report.balanced, true);
});

test("reversals affect the ledger and zero a previously posted transaction", () => {
  const report = calculateBalanceSheet(accounts, ledger([["receivable", "revenue", "100.00"], ["revenue", "receivable", "100.00"]]));
  assert.equal(report.assets.total, "0.00");
  assert.equal(report.unclosedEarnings, "0.00");
  assert.equal(report.balanced, true);
});

test("contra assets and current losses retain their negative balances", () => {
  const report = calculateBalanceSheet(accounts, ledger([["bank", "capital", "100.00"], ["expense", "depreciation", "20.00"]]));
  assert.equal(report.assets.lines.find((line) => line.id === "depreciation")?.balance, "-20.00");
  assert.equal(report.assets.total, "80.00");
  assert.equal(report.unclosedEarnings, "-20.00");
  assert.equal(report.equityIncludingEarnings, "80.00");
  assert.equal(report.balanced, true);
  const trial = calculateTrialBalance(accounts, ledger([]), ledger([["expense", "bank", "20.00"]]));
  assert.equal(trial.lines.find((line) => line.id === "bank")?.closingBalance, "-20.00");
  assert.equal(trial.lines.find((line) => line.id === "bank")?.closingCredit, "20.00");
});

test("cent precision survives balances above the safe JavaScript integer range", () => {
  const report = calculateBalanceSheet(accounts, ledger([["bank", "capital", "9999999999999999.99"], ["bank", "capital", "0.02"]]));
  assert.equal(report.assets.total, "10000000000000000.01");
  assert.equal(report.equity.total, "10000000000000000.01");
  assert.equal(report.balanced, true);
});

test("unequal ledger sides are exposed as a difference without inventing balances", () => {
  const sums = { debits: [{ accountId: "bank", amount: new Prisma.Decimal("12.34") }], credits: [] };
  const sheet = calculateBalanceSheet(accounts, sums);
  assert.equal(sheet.difference, "12.34");
  assert.equal(sheet.balanced, false);
  assert.equal(calculateTrialBalance(accounts, ledger([]), sums).balanced, false);
});
