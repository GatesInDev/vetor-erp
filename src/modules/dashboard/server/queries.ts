import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function getDashboardData(companyId: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [projectCount, invoices, receivables, payableTotal, entries, tasks] = await Promise.all([
    db.project.count({ where: { companyId, active: true } }),
    db.serviceInvoice.findMany({ where: { companyId, serviceDate: { gte: start, lt: end }, status: { not: "CANCELLED" } }, select: { amount: true, serviceDate: true } }),
    db.receivable.findMany({ where: { companyId }, select: { amount: true, received: true } }),
    db.payable.aggregate({ where: { companyId, status: "OPEN" }, _sum: { amount: true } }),
    db.journalEntry.findMany({ where: { companyId }, include: { project: { select: { name: true } } }, orderBy: { occurredAt: "desc" }, take: 8 }),
    db.monthlyTask.findMany({ where: { companyId, month: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), lt: end } }, select: { id: true, title: true, completedAt: true }, orderBy: { title: "asc" } }),
  ]);
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const value = invoices.filter((invoice) => invoice.serviceDate.getUTCFullYear() === date.getUTCFullYear() && invoice.serviceDate.getUTCMonth() === date.getUTCMonth()).reduce((sum, invoice) => sum.plus(invoice.amount), new Prisma.Decimal(0));
    return { label: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(date).replace(".", ""), value: value.toNumber(), date: date.toISOString() };
  });
  return {
    projectCount, monthly,
    openReceivables: receivables.reduce((sum, item) => sum.plus(item.amount.minus(item.received)), new Prisma.Decimal(0)).toNumber(),
    openPayables: payableTotal._sum.amount?.toNumber() ?? 0,
    tasks: tasks.map((task) => ({ id: task.id, title: task.title, completed: Boolean(task.completedAt) })),
    entries: entries.map((entry) => ({ id: entry.id, description: entry.description, project: entry.project?.name ?? "Geral", amount: entry.amount.toNumber(), date: entry.occurredAt.toISOString(), source: entry.source })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
