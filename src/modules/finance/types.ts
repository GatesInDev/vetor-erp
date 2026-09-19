export type PayableRow = { id: string; contractor: string; contractNumber: string; project: string; amount: string; dueAt: string; status: string; paidAt: string | null };
export type ReceivableRow = { id: string; customer: string; invoiceNumber: string; project: string; amount: string; received: string; remaining: string; dueAt: string };
export type BankTransactionRow = { id: string; description: string; amount: string; postedAt: string; reconciled: boolean; invoiceNumber: string | null };
export type FinanceData = { payables: PayableRow[]; receivables: ReceivableRow[]; bankTransactions: BankTransactionRow[] };
export const formatMoney = (value: string | number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
export const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
export const isOverdue = (value: string) => value.slice(0, 10) < new Date().toLocaleDateString("en-CA");
