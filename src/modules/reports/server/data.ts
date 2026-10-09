import "server-only";

import { Prisma, Role } from "@prisma/client";
import { authorize, HttpError, type Actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { reportDataFilterSchema, reportSources, type ReportData, type ReportDataFilters } from "../sources";
import { payableOriginFields } from "../payable-fields";

export { reportDataFilterSchema } from "../sources";
export type { ReportData, ReportDataFilters } from "../sources";

const reportRowLimit = 500;
const documentDateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const eventDateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const invoiceStatuses = { DRAFT: "Rascunho", EXPORTED: "Exportado", ISSUED: "Emitido", CANCELLED: "Cancelado" };
const payableStatuses = { OPEN: "Em aberto", PAID: "Pago", CANCELLED: "Cancelado" };

function formatDecimal(value: Prisma.Decimal, places: number): string {
  const [integer, fraction] = value.toFixed(places).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = places === 2 ? fraction : fraction.replace(/0+$/, "");
  return decimals ? `${grouped},${decimals}` : grouped;
}

function money(value: Prisma.Decimal): string {
  return `R$ ${formatDecimal(value, 2)}`;
}

function dateFilter(filters: ReportDataFilters): Prisma.DateTimeFilter | undefined {
  if (!filters.from && !filters.to) return undefined;
  const end = filters.to ? new Date(`${filters.to}T00:00:00.000Z`) : undefined;
  if (end) end.setUTCDate(end.getUTCDate() + 1);
  return { gte: filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : undefined, lt: end };
}

async function assertRecordAccess(companyId: string, filters: ReportDataFilters): Promise<void> {
  if (!filters.recordId) return;
  const query = { where: { id: filters.recordId, companyId }, select: { id: true } } as const;
  const record = await (() => {
    switch (filters.source) {
      case "projects": return db.project.findFirst(query);
      case "partners": return db.partner.findFirst(query);
      case "inventory": return db.inventoryProduct.findFirst(query);
      case "stockMovements": return db.stockMovement.findFirst(query);
      case "invoices": return db.serviceInvoice.findFirst(query);
      case "payables": return db.payable.findFirst(query);
      case "receivables": return db.receivable.findFirst(query);
      case "manual": return null;
    }
  })();
  if (!record) throw new HttpError(404, "Report record not found");
}

async function queryRows(companyId: string, filters: ReportDataFilters): Promise<Record<string, string>[]> {
  const where = { companyId, id: filters.recordId };
  const project = { companyId };
  const period = dateFilter(filters);
  const take = reportRowLimit + 1;
  switch (filters.source) {
    case "manual": return [{}];
    case "projects": {
      const rows = await db.project.findMany({ where, take, orderBy: [{ code: "asc" }, { id: "asc" }], select: { id: true, code: true, name: true, active: true } });
      return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, active: row.active ? "Ativa" : "Inativa" }));
    }
    case "partners": {
      const rows = await db.partner.findMany({ where, take, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, customer: true, supplier: true } });
      return rows.map((row) => ({ id: row.id, name: row.name, customer: row.customer ? "Sim" : "Não", supplier: row.supplier ? "Sim" : "Não" }));
    }
    case "inventory": {
      const rows = await db.inventoryProduct.findMany({ where, take, orderBy: [{ sku: "asc" }, { id: "asc" }], select: { id: true, sku: true, name: true, unit: true, quantity: true, minimumQuantity: true, active: true } });
      return rows.map((row) => ({ id: row.id, sku: row.sku, name: row.name, unit: row.unit, quantity: formatDecimal(row.quantity, 3), minimumQuantity: formatDecimal(row.minimumQuantity, 3), active: row.active ? "Ativo" : "Inativo" }));
    }
    case "stockMovements": {
      const rows = await db.stockMovement.findMany({
        where: { ...where, projectId: filters.projectId, product: { companyId }, OR: [{ projectId: null }, { project }], createdAt: period },
        take, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: { id: true, type: true, quantity: true, reason: true, createdAt: true, product: { select: { sku: true, name: true, unit: true } }, project: { select: { name: true } } },
      });
      return rows.map((row) => ({ id: row.id, sku: row.product.sku, product: row.product.name, unit: row.product.unit, project: row.project?.name ?? "Sem obra", type: row.type === "ENTRY" ? "Entrada" : "Saída", quantity: formatDecimal(row.quantity, 3), reason: row.reason, createdAt: eventDateFormatter.format(row.createdAt) }));
    }
    case "invoices": {
      const rows = await db.serviceInvoice.findMany({
        where: { ...where, projectId: filters.projectId, project, customer: { companyId }, serviceDate: period },
        take, orderBy: [{ serviceDate: "desc" }, { id: "asc" }],
        select: { id: true, number: true, serviceDate: true, amount: true, issAmount: true, inssAmount: true, status: true, customer: { select: { name: true } }, project: { select: { name: true } } },
      });
      return rows.map((row) => ({ id: row.id, number: row.number, customer: row.customer.name, project: row.project.name, serviceDate: documentDateFormatter.format(row.serviceDate), amount: money(row.amount), net: money(row.amount.minus(row.issAmount).minus(row.inssAmount)), status: invoiceStatuses[row.status] }));
    }
    case "payables": {
      const rows = await db.payable.findMany({
        where: { ...where, projectId: filters.projectId, project, contractor: { companyId }, OR: [{ contract: { companyId } }, { rentalCharge: { companyId, rental: { companyId } } }], dueAt: period },
        take, orderBy: [{ dueAt: "asc" }, { id: "asc" }],
        select: { id: true, amount: true, dueAt: true, status: true, contractor: { select: { name: true } }, contract: { select: { number: true } }, rentalCharge: { select: { documentNumber: true, rental: { select: { number: true, equipmentName: true } } } }, project: { select: { name: true } } },
      });
      return rows.map((row) => ({ id: row.id, contractor: row.contractor.name, ...payableOriginFields(row), project: row.project.name, amount: money(row.amount), dueAt: documentDateFormatter.format(row.dueAt), status: payableStatuses[row.status] }));
    }
    case "receivables": {
      const rows = await db.receivable.findMany({
        where: { ...where, projectId: filters.projectId, project, customer: { companyId }, invoice: { companyId }, dueAt: period },
        take, orderBy: [{ dueAt: "asc" }, { id: "asc" }],
        select: { id: true, amount: true, received: true, dueAt: true, customer: { select: { name: true } }, invoice: { select: { number: true } }, project: { select: { name: true } } },
      });
      return rows.map((row) => ({ id: row.id, customer: row.customer.name, invoiceNumber: row.invoice.number, project: row.project.name, amount: money(row.amount), received: money(row.received), remaining: money(row.amount.minus(row.received)), dueAt: documentDateFormatter.format(row.dueAt) }));
    }
  }
}

export async function getReportData(actor: Actor, filters: ReportDataFilters): Promise<ReportData> {
  const parsed = reportDataFilterSchema.safeParse(filters);
  if (!parsed.success) throw new HttpError(400, "Invalid report filters");
  const source = reportSources.find((item) => item.id === parsed.data.source)!;
  authorize(actor, source.financial ? [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.VIEWER] : Object.values(Role));
  const company = await db.company.findFirst({ where: { id: actor.companyId }, select: { name: true } });
  if (!company) throw new HttpError(404, "Company not found");
  if (parsed.data.projectId && !await db.project.findFirst({ where: { id: parsed.data.projectId, companyId: actor.companyId }, select: { id: true } })) {
    throw new HttpError(404, "Project not found");
  }
  await assertRecordAccess(actor.companyId, parsed.data);
  const rows = await queryRows(actor.companyId, parsed.data);
  return { company, generatedAt: new Date().toISOString(), rows: rows.slice(0, reportRowLimit), truncated: rows.length > reportRowLimit };
}
