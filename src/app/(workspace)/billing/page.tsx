import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { BillingWorkspace } from "@/modules/billing/billing-workspace";

export default async function BillingPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const [invoices, contracts, partners, projects] = await Promise.all([
    db.serviceInvoice.findMany({ where: { companyId: actor.companyId }, include: { customer: true, project: true, receivable: true }, orderBy: { serviceDate: "desc" } }),
    db.laborContract.findMany({ where: { companyId: actor.companyId }, include: { contractor: true, project: true, measurements: { orderBy: { measuredAt: "desc" } } }, orderBy: { number: "asc" } }),
    db.partner.findMany({ where: { companyId: actor.companyId }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { companyId: actor.companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return <BillingWorkspace role={actor.role} data={{
    invoices: invoices.map((invoice) => ({ id: invoice.id, number: invoice.number, customer: invoice.customer.name, project: invoice.project.name, amount: invoice.amount.toFixed(2), net: invoice.receivable?.amount.toFixed(2) ?? invoice.amount.minus(invoice.issAmount).minus(invoice.inssAmount).toFixed(2), serviceDate: invoice.serviceDate.toISOString(), status: invoice.status })),
    contracts: contracts.map((contract) => {
      const measured = contract.measurements.reduce((sum, measurement) => sum.plus(measurement.amount), new Prisma.Decimal(0));
      return { id: contract.id, number: contract.number, description: contract.description, contractor: contract.contractor.name, project: contract.project.name, amount: contract.amount.toFixed(2), measured: measured.toFixed(2), remaining: contract.amount.minus(measured).toFixed(2) };
    }),
    measurements: contracts.flatMap((contract) => contract.measurements.map((measurement) => ({ id: measurement.id, contractId: contract.id, contractNumber: contract.number, contractor: contract.contractor.name, project: contract.project.name, amount: measurement.amount.toFixed(2), measuredAt: measurement.measuredAt.toISOString(), approved: Boolean(measurement.approvedAt) }))).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
    customers: partners.filter((partner) => partner.customer).map(({ id, name }) => ({ id, name })),
    suppliers: partners.filter((partner) => partner.supplier).map(({ id, name }) => ({ id, name })),
    projects,
  }} />;
}
