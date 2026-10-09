import { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/auth";
import type { LedgerSums } from "./calculations";
import { accountingDayEndExclusive, accountingDayStart } from "./schema";
import type { AccountingAccount, AccountingCompany } from "./types";

export type AccountingReadClient = Pick<Prisma.TransactionClient, "company" | "account" | "journalEntry">;
export type AccountingSnapshot = { company: AccountingCompany; accounts: AccountingAccount[]; opening: LedgerSums; period: LedgerSums };

async function readLedgerSums(client: AccountingReadClient, where: Prisma.JournalEntryWhereInput): Promise<LedgerSums> {
  const [debits, credits] = await Promise.all([
    client.journalEntry.groupBy({ by: ["debitAccountId"], where, _sum: { amount: true } }),
    client.journalEntry.groupBy({ by: ["creditAccountId"], where, _sum: { amount: true } }),
  ]);
  return {
    debits: debits.map((row) => ({ accountId: row.debitAccountId, amount: row._sum.amount ?? new Prisma.Decimal(0) })),
    credits: credits.map((row) => ({ accountId: row.creditAccountId, amount: row._sum.amount ?? new Prisma.Decimal(0) })),
  };
}

export async function readAccountingSnapshot(client: AccountingReadClient, companyId: string, to: string, from?: string): Promise<AccountingSnapshot> {
  const scope = { companyId, debitAccount: { companyId }, creditAccount: { companyId } };
  const period = { ...scope, occurredAt: { ...(from ? { gte: accountingDayStart(from) } : {}), lt: accountingDayEndExclusive(to) } };
  const [company, accounts, periodSums, opening] = await Promise.all([
    client.company.findFirst({ where: { id: companyId }, select: { id: true, name: true } }),
    client.account.findMany({ where: { companyId }, select: { id: true, code: true, name: true, type: true, active: true }, orderBy: [{ code: "asc" }, { id: "asc" }] }),
    readLedgerSums(client, period),
    from ? readLedgerSums(client, { ...scope, occurredAt: { lt: accountingDayStart(from) } }) : Promise.resolve({ debits: [], credits: [] }),
  ]);
  if (!company) throw new HttpError(404, "Company not found");
  return { company, accounts, period: periodSums, opening };
}
