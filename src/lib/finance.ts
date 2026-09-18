import { EntrySource, Prisma } from "@prisma/client";
import { HttpError } from "@/lib/auth";

export { accountCodes } from "@/lib/account-catalog";

type Transaction = Prisma.TransactionClient;
type Money = Prisma.Decimal;

export function money(value: string): Money {
  if (!/^\d{1,14}(\.\d{1,2})?$/.test(value)) throw new HttpError(400, "Invalid monetary amount");
  const amount = new Prisma.Decimal(value);
  if (amount.lte(0)) throw new HttpError(400, "Amount must be positive");
  return amount;
}

export function nonnegativeMoney(value: string): Money {
  if (!/^\d{1,14}(\.\d{1,2})?$/.test(value)) throw new HttpError(400, "Invalid monetary amount");
  return new Prisma.Decimal(value);
}

export async function postEntry(transaction: Transaction, input: {
  companyId: string;
  debitCode: string;
  creditCode: string;
  amount: Money;
  projectId?: string;
  description: string;
  source: EntrySource;
  sourceId: string;
  occurredAt: Date;
  createdById: string;
}) {
  if (input.debitCode === input.creditCode || input.amount.lte(0)) throw new HttpError(400, "Invalid journal entry");
  const accounts = await transaction.account.findMany({ where: { companyId: input.companyId, code: { in: [input.debitCode, input.creditCode] }, active: true } });
  const debit = accounts.find((account) => account.code === input.debitCode);
  const credit = accounts.find((account) => account.code === input.creditCode);
  if (!debit || !credit) throw new HttpError(422, "Required account is missing");
  return transaction.journalEntry.create({ data: {
    companyId: input.companyId, debitAccountId: debit.id, creditAccountId: credit.id,
    amount: input.amount, projectId: input.projectId, description: input.description,
    source: input.source, sourceId: input.sourceId, occurredAt: input.occurredAt,
    createdById: input.createdById,
  } });
}
