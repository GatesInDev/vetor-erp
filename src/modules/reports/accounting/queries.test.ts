import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { calculateTrialBalance } from "./calculations";
import { readAccountingSnapshot, type AccountingReadClient } from "./queries";
import { accountingQuery } from "./request";

const companyId = "company-a";
const accounts = [
  { id: "bank", code: "1", name: "Bank", type: "ASSET", active: false },
  { id: "capital", code: "3", name: "Capital", type: "EQUITY", active: true },
];

test("accounting snapshots scope every query and split postings on UTC period boundaries", async () => {
  const entries = [
    { occurredAt: new Date("2026-08-31T23:59:59.999Z"), amount: "10.00" },
    { occurredAt: new Date("2026-09-01T00:00:00.000Z"), amount: "20.00" },
    { occurredAt: new Date("2026-09-30T23:59:59.999Z"), amount: "30.00" },
    { occurredAt: new Date("2026-10-01T00:00:00.000Z"), amount: "40.00" },
  ];
  let groupedQueries = 0;
  const client = {
    company: { findFirst: async (args: Prisma.CompanyFindFirstArgs) => { assert.deepEqual(args.where, { id: companyId }); return { id: companyId, name: "Company" }; } },
    account: { findMany: async (args: Prisma.AccountFindManyArgs) => { assert.deepEqual(args.where, { companyId }); return accounts; } },
    journalEntry: { groupBy: async (args: Prisma.JournalEntryGroupByArgs) => {
      groupedQueries += 1;
      assert.equal(args.where?.companyId, companyId);
      assert.deepEqual(args.where?.debitAccount, { companyId });
      assert.deepEqual(args.where?.creditAccount, { companyId });
      assert.equal(args.where?.source, undefined);
      assert.equal(args.where?.createdAt, undefined);
      const range = args.where?.occurredAt as { gte?: Date; lt: Date };
      const amount = entries.filter((entry) => (!range.gte || entry.occurredAt >= range.gte) && entry.occurredAt < range.lt).reduce((total, entry) => total.plus(entry.amount), new Prisma.Decimal(0));
      const side = Array.isArray(args.by) ? args.by[0] : args.by;
      return [{ [side]: side === "debitAccountId" ? "bank" : "capital", _sum: { amount } }];
    } },
  } as unknown as AccountingReadClient;
  const snapshot = await readAccountingSnapshot(client, companyId, "2026-09-30", "2026-09-01");
  const report = calculateTrialBalance(snapshot.accounts, snapshot.opening, snapshot.period);
  assert.equal(groupedQueries, 4);
  assert.equal(report.lines.find((line) => line.id === "bank")?.openingBalance, "10.00");
  assert.equal(report.lines.find((line) => line.id === "bank")?.debits, "50.00");
  assert.equal(report.lines.find((line) => line.id === "bank")?.closingBalance, "60.00");
  assert.equal(report.balanced, true);
});

test("balance sheet snapshots query the full posted history before the exclusive cutoff", async () => {
  let groupedQueries = 0;
  const client = {
    company: { findFirst: async () => ({ id: companyId, name: "Company" }) },
    account: { findMany: async () => accounts },
    journalEntry: { groupBy: async (args: Prisma.JournalEntryGroupByArgs) => {
      groupedQueries += 1;
      assert.deepEqual(args.where?.occurredAt, { lt: new Date("2027-01-01T00:00:00.000Z") });
      assert.equal(args.where?.companyId, companyId);
      return [];
    } },
  } as unknown as AccountingReadClient;
  const snapshot = await readAccountingSnapshot(client, companyId, "2026-12-31");
  assert.equal(groupedQueries, 2);
  assert.deepEqual(snapshot.opening, { debits: [], credits: [] });
  assert.equal(snapshot.accounts.length, 2);
});

test("accounting snapshots reject a missing authenticated company", async () => {
  const client = { company: { findFirst: async () => null }, account: { findMany: async () => [] }, journalEntry: { groupBy: async () => [] } } as unknown as AccountingReadClient;
  await assert.rejects(readAccountingSnapshot(client, companyId, "2026-09-30"), (error: unknown) => error instanceof HttpError && error.status === 404);
});

test("accounting API filters reject duplicate keys and owner overrides", () => {
  assert.deepEqual(accountingQuery(new NextRequest("http://localhost/api/reports/balance-sheet?asOf=2026-09-30")), { asOf: "2026-09-30" });
  assert.throws(() => accountingQuery(new NextRequest("http://localhost/api/reports/balance-sheet?asOf=2026-09-01&asOf=2026-09-30")), (error: unknown) => error instanceof HttpError && error.status === 400);
  assert.throws(() => accountingQuery(new NextRequest("http://localhost/api/reports/balance-sheet?companyId=foreign")), (error: unknown) => error instanceof HttpError && error.status === 403);
  assert.throws(() => accountingQuery(new NextRequest("http://localhost/api/reports/balance-sheet?userId=foreign")), (error: unknown) => error instanceof HttpError && error.status === 403);
});
