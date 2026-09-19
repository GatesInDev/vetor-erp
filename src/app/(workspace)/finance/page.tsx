import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { FinanceWorkspace } from "@/modules/finance/finance-workspace";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const { tab } = await searchParams;
  const initialTab = tab === "receivables" || tab === "reconciliation" ? tab : "payables";
  const [payables, receivables, bankTransactions] = await Promise.all([
    db.payable.findMany({ where: { companyId: actor.companyId }, include: { contractor: true, contract: true, project: true }, orderBy: { dueAt: "asc" } }),
    db.receivable.findMany({ where: { companyId: actor.companyId }, include: { customer: true, invoice: true, project: true }, orderBy: { dueAt: "asc" } }),
    db.bankTransaction.findMany({ where: { statement: { companyId: actor.companyId } }, include: { receivable: { include: { invoice: true } } }, orderBy: { postedAt: "desc" } }),
  ]);
  return <FinanceWorkspace key={initialTab} initialTab={initialTab} role={actor.role} data={{
    payables: payables.map((payable) => ({ id: payable.id, contractor: payable.contractor.name, contractNumber: payable.contract.number, project: payable.project.name, amount: payable.amount.toFixed(2), dueAt: payable.dueAt.toISOString(), status: payable.status, paidAt: payable.paidAt?.toISOString() ?? null })),
    receivables: receivables.map((receivable) => ({ id: receivable.id, customer: receivable.customer.name, invoiceNumber: receivable.invoice.number, project: receivable.project.name, amount: receivable.amount.toFixed(2), received: receivable.received.toFixed(2), remaining: receivable.amount.minus(receivable.received).toFixed(2), dueAt: receivable.dueAt.toISOString() })),
    bankTransactions: bankTransactions.map((transaction) => ({ id: transaction.id, description: transaction.description, amount: transaction.amount.toFixed(2), postedAt: transaction.postedAt.toISOString(), reconciled: Boolean(transaction.reconciledAt), invoiceNumber: transaction.receivable?.invoice.number ?? null })),
  }} />;
}
