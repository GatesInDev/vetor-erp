import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() - 11);
  const [company, projects, invoices, receivables, payables, entries, tasks] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: actor.companyId }, select: { name: true } }),
    db.project.findMany({ where: { companyId: actor.companyId }, select: { id: true, code: true, name: true }, take: 8, orderBy: { code: "asc" } }),
    db.serviceInvoice.findMany({ where: { companyId: actor.companyId, serviceDate: { gte: start }, status: { not: "CANCELLED" } }, select: { amount: true, serviceDate: true } }),
    db.receivable.findMany({ where: { companyId: actor.companyId }, select: { amount: true, received: true } }),
    db.payable.findMany({ where: { companyId: actor.companyId, status: "OPEN" }, select: { amount: true } }),
    db.journalEntry.findMany({ where: { companyId: actor.companyId }, include: { debitAccount: { select: { type: true } }, creditAccount: { select: { type: true } }, project: { select: { name: true } } }, orderBy: { occurredAt: "desc" }, take: 100 }),
    db.monthlyTask.findMany({ where: { companyId: actor.companyId, completedAt: null }, select: { title: true, month: true }, take: 4, orderBy: { month: "asc" } }),
  ]);
  const invoiceTotal = invoices.reduce((sum, invoice) => sum + invoice.amount.toNumber(), 0);
  const openReceivables = receivables.reduce((sum, item) => sum + item.amount.minus(item.received).toNumber(), 0);
  const openPayables = payables.reduce((sum, item) => sum + item.amount.toNumber(), 0);
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    return { label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date), year: date.getUTCFullYear(), month: date.getUTCMonth(), value: 0 };
  });
  for (const invoice of invoices) {
    const item = monthly.find((month) => month.year === invoice.serviceDate.getUTCFullYear() && month.month === invoice.serviceDate.getUTCMonth());
    if (item) item.value += invoice.amount.toNumber();
  }
  return <Dashboard data={{
    companyName: company.name, role: actor.role, invoiceTotal, openReceivables, openPayables,
    projectCount: projects.length, monthly, projects,
    tasks: tasks.map((task) => ({ title: task.title, month: task.month.toISOString() })),
    entries: entries.slice(0, 7).map((entry) => ({
      id: entry.id, description: entry.description, project: entry.project?.name ?? "Geral",
      amount: entry.amount.toNumber(), date: entry.occurredAt.toISOString(), source: entry.source,
    })),
  }} />;
}
