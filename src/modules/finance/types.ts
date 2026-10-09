import type { FinancialAccountOrigin, FinancialTitleRow, TitleAccountSnapshot } from "./titles/types";

export type FinancialAccountRecord = TitleAccountSnapshot & { paidAt: string | null };

export type PayableRow = { id: string; contractor: string; contractNumber: string; origin: FinancialAccountOrigin; project: string; amount: string; dueAt: string; status: string; paidAt: string | null };
export type ReceivableRow = { id: string; customer: string; invoiceNumber: string; project: string; amount: string; received: string; remaining: string; dueAt: string; sourceCancelled: boolean };
export type BankTransactionRow = { id: string; description: string; amount: string; postedAt: string; reconciled: boolean; invoiceNumber: string | null };
export type FinanceData = { payables: PayableRow[]; receivables: ReceivableRow[]; bankTransactions: BankTransactionRow[]; titles: FinancialTitleRow[] };
export const formatMoney = (value: string | number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
export const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
export const isOverdue = (value: string) => value.slice(0, 10) < new Date().toLocaleDateString("en-CA");
