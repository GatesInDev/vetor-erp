import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { BankTransactionRow, FinanceData, FinancialAccountRecord, PayableRow, ReceivableRow } from "./types";
import { getFinancialTitles } from "./titles/server";
import { payableInclude, payableSnapshot, receivableSnapshot } from "./titles/operations";
import type { TitleAccountType } from "./titles/types";

type PayableRecord = Prisma.PayableGetPayload<{ include: typeof payableInclude }>;
type ReceivableRecord = Prisma.ReceivableGetPayload<{ include: { customer: true; invoice: true; project: true } }>;
type TransactionRecord = Prisma.BankTransactionGetPayload<{ include: { receivable: { include: { invoice: true } } } }>;

function payableRow(payable: PayableRecord): PayableRow {
  return { id: payable.id, contractor: payable.contractor.name, contractNumber: payable.contract?.number ?? "", origin: payableSnapshot(payable).origin, project: payable.project.name, amount: payable.amount.toFixed(2), dueAt: payable.dueAt.toISOString(), status: payable.status, paidAt: payable.paidAt?.toISOString() ?? null };
}

function receivableRow(receivable: ReceivableRecord): ReceivableRow {
  return { id: receivable.id, customer: receivable.customer.name, invoiceNumber: receivable.invoice.number, project: receivable.project.name, amount: receivable.amount.toFixed(2), received: receivable.received.toFixed(2), remaining: receivable.amount.minus(receivable.received).toFixed(2), dueAt: receivable.dueAt.toISOString(), sourceCancelled: receivable.invoice.status === "CANCELLED" };
}

function transactionRow(transaction: TransactionRecord): BankTransactionRow {
  return { id: transaction.id, description: transaction.description, amount: transaction.amount.toFixed(2), postedAt: transaction.postedAt.toISOString(), reconciled: Boolean(transaction.reconciledAt), invoiceNumber: transaction.receivable?.invoice.number ?? null };
}

export async function getPayable(companyId: string, id: string) {
  const payable = await db.payable.findFirst({ where: { id, companyId }, include: payableInclude });
  return payable ? payableRow(payable) : null;
}

export async function getReceivable(companyId: string, id: string) {
  const receivable = await db.receivable.findFirst({ where: { id, companyId }, include: { customer: true, invoice: true, project: true } });
  return receivable ? receivableRow(receivable) : null;
}

export async function getFinancialAccount(companyId: string, accountType: TitleAccountType, id: string): Promise<FinancialAccountRecord | null> {
  if (accountType === "PAYABLE") {
    const account = await db.payable.findFirst({ where: { companyId, id }, include: payableInclude });
    if (!account) return null;
    return { ...payableSnapshot(account), paidAt: account.paidAt?.toISOString() ?? null };
  }
  const account = await db.receivable.findFirst({ where: { companyId, id }, include: { customer: true, invoice: true, project: true } });
  if (!account) return null;
  return { ...receivableSnapshot(account), paidAt: null };
}

export async function getBankTransactions(companyId: string) {
  const transactions = await db.bankTransaction.findMany({ where: { statement: { companyId } }, include: { receivable: { include: { invoice: true } } }, orderBy: { postedAt: "desc" } });
  return transactions.map(transactionRow);
}

export async function getFinanceData(companyId: string): Promise<FinanceData> {
  const [payables, receivables, bankTransactions, titles] = await Promise.all([
    db.payable.findMany({ where: { companyId }, include: payableInclude, orderBy: { dueAt: "asc" } }),
    db.receivable.findMany({ where: { companyId }, include: { customer: true, invoice: true, project: true }, orderBy: { dueAt: "asc" } }),
    getBankTransactions(companyId),
    getFinancialTitles(companyId),
  ]);
  return { payables: payables.map(payableRow), receivables: receivables.map(receivableRow), bankTransactions, titles };
}
