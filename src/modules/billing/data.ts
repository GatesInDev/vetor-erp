import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { BillingData, ContractRow, MeasurementRow } from "./types";

type ContractRecord = Prisma.LaborContractGetPayload<{ include: { contractor: true; project: true; measurements: true } }>;

function contractRow(contract: ContractRecord): ContractRow {
  const measured = contract.measurements.reduce((sum, measurement) => sum.plus(measurement.amount), new Prisma.Decimal(0));
  return { id: contract.id, number: contract.number, description: contract.description, contractor: contract.contractor.name, project: contract.project.name, amount: contract.amount.toFixed(2), measured: measured.toFixed(2), remaining: contract.amount.minus(measured).toFixed(2) };
}

function contractMeasurements(contract: ContractRecord): MeasurementRow[] {
  return contract.measurements.map((measurement) => ({ id: measurement.id, contractId: contract.id, contractNumber: contract.number, contractor: contract.contractor.name, project: contract.project.name, amount: measurement.amount.toFixed(2), measuredAt: measurement.measuredAt.toISOString(), approved: Boolean(measurement.approvedAt) }));
}

function findContracts(companyId: string) {
  return db.laborContract.findMany({ where: { companyId }, include: { contractor: true, project: true, measurements: { orderBy: { measuredAt: "desc" } } }, orderBy: { number: "asc" } });
}

export async function getContractOptions(companyId: string) {
  return (await findContracts(companyId)).map(contractRow);
}

export async function getDocumentOptions(companyId: string, kind: "invoice" | "contract") {
  const [partners, projects] = await Promise.all([
    db.partner.findMany({ where: { companyId, ...(kind === "invoice" ? { customer: true } : { supplier: true }) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.project.findMany({ where: { companyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { partners, projects };
}

export async function getMeasurement(companyId: string, id: string): Promise<MeasurementRow | null> {
  const measurement = await db.measurement.findFirst({ where: { id, contract: { companyId } }, include: { contract: { include: { contractor: true, project: true } } } });
  if (!measurement) return null;
  return { id: measurement.id, contractId: measurement.contractId, contractNumber: measurement.contract.number, contractor: measurement.contract.contractor.name, project: measurement.contract.project.name, amount: measurement.amount.toFixed(2), measuredAt: measurement.measuredAt.toISOString(), approved: Boolean(measurement.approvedAt) };
}

export async function getBillingData(companyId: string): Promise<BillingData> {
  const [invoices, contracts] = await Promise.all([
    db.serviceInvoice.findMany({ where: { companyId }, include: { customer: true, project: true, receivable: true }, orderBy: { serviceDate: "desc" } }),
    findContracts(companyId),
  ]);
  return {
    invoices: invoices.map((invoice) => ({ id: invoice.id, number: invoice.number, customer: invoice.customer.name, project: invoice.project.name, amount: invoice.amount.toFixed(2), net: invoice.receivable?.amount.toFixed(2) ?? invoice.amount.minus(invoice.issAmount).minus(invoice.inssAmount).toFixed(2), serviceDate: invoice.serviceDate.toISOString(), status: invoice.status })),
    contracts: contracts.map(contractRow),
    measurements: contracts.flatMap(contractMeasurements).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
  };
}
