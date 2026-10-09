import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { calculateBalanceSheet, calculateTrialBalance } from "./calculations";
import { readAccountingSnapshot } from "./queries";
import { balanceSheetFiltersSchema, trialBalanceFiltersSchema, type BalanceSheetFilters, type TrialBalanceFilters } from "./schema";
import type { BalanceSheetReport, TrialBalanceReport } from "./types";

export async function getBalanceSheet(companyId: string, filters: Partial<BalanceSheetFilters> = {}): Promise<BalanceSheetReport> {
  const { asOf } = balanceSheetFiltersSchema.parse(filters);
  const snapshot = await db.$transaction((transaction) => readAccountingSnapshot(transaction, companyId, asOf), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { company: snapshot.company, generatedAt: new Date().toISOString(), asOf, ...calculateBalanceSheet(snapshot.accounts, snapshot.period) };
}

export async function getTrialBalance(companyId: string, filters: Partial<TrialBalanceFilters> = {}): Promise<TrialBalanceReport> {
  const { from, to } = trialBalanceFiltersSchema.parse(filters);
  const snapshot = await db.$transaction((transaction) => readAccountingSnapshot(transaction, companyId, to, from), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { company: snapshot.company, generatedAt: new Date().toISOString(), from, to, ...calculateTrialBalance(snapshot.accounts, snapshot.opening, snapshot.period) };
}
