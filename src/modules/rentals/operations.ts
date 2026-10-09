import { Prisma } from "@prisma/client";
import { HttpError, type Actor } from "@/lib/auth";
import { accountCodes, money, postEntry } from "@/lib/finance";
import { prepareRentalFiles } from "./documents";
import type { EquipmentRentalInput, EquipmentRentalUpdate, RentalChargeInput, RentalFilters } from "./schema";
import type { EquipmentRentalDetail, EquipmentRentalRow, RentalChargeRow, RentalOptions } from "./types";

const fileSelect = { id: true, fileName: true, mediaType: true, sizeBytes: true } as const;
const chargeInclude = { payable: { include: { financialTitle: { select: { id: true } } } }, files: { select: fileSelect } } satisfies Prisma.RentalChargeInclude;
const rentalInclude = {
  project: { select: { id: true, code: true, name: true, active: true } },
  supplier: { select: { id: true, name: true } },
  charges: { include: chargeInclude, orderBy: [{ issuedAt: "desc" }, { id: "asc" }] },
} satisfies Prisma.EquipmentRentalInclude;
type RentalRecord = Prisma.EquipmentRentalGetPayload<{ include: typeof rentalInclude }>;
type ChargeRecord = Prisma.RentalChargeGetPayload<{ include: typeof chargeInclude }>;
export type RentalReadClient = Pick<Prisma.TransactionClient, "equipmentRental" | "rentalCharge" | "project" | "partner">;
const dateValue = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

function chargeRow(charge: ChargeRecord): RentalChargeRow {
  return {
    id: charge.id, rentalId: charge.rentalId, documentKind: charge.documentKind, documentNumber: charge.documentNumber,
    issuedAt: dateValue(charge.issuedAt)!, dueAt: dateValue(charge.dueAt)!, amount: charge.amount.toFixed(2), documentUrl: charge.documentUrl, notes: charge.notes,
    payable: charge.payable ? { id: charge.payable.id, status: charge.payable.status, paidAt: charge.payable.paidAt?.toISOString() ?? null, financialTitleId: charge.payable.financialTitle?.id ?? null } : null,
    files: charge.files,
  };
}

function rentalRow(rental: RentalRecord, today = new Date().toISOString().slice(0, 10)): EquipmentRentalRow {
  const total = (accept: (charge: ChargeRecord) => boolean) => rental.charges.filter(accept).reduce((sum, charge) => sum.plus(charge.amount), new Prisma.Decimal(0)).toFixed(2);
  return {
    id: rental.id, number: rental.number, equipmentName: rental.equipmentName, equipmentIdentifier: rental.equipmentIdentifier,
    quantity: rental.quantity, startsAt: dateValue(rental.startsAt)!, expectedReturnAt: dateValue(rental.expectedReturnAt), returnedAt: dateValue(rental.returnedAt),
    notes: rental.notes, revision: rental.revision, project: rental.project, supplier: rental.supplier,
    status: rental.returnedAt ? "RETURNED" : dateValue(rental.startsAt)! > today ? "SCHEDULED" : "ACTIVE",
    chargeCount: rental.charges.length, totalCharged: total(() => true), totalPaid: total((charge) => charge.payable?.status === "PAID"), totalOutstanding: total((charge) => charge.payable?.status === "OPEN"),
  };
}

export async function readEquipmentRentals(client: RentalReadClient, companyId: string, filters: RentalFilters = {}): Promise<EquipmentRentalRow[]> {
  const rows = await client.equipmentRental.findMany({
    where: { companyId, projectId: filters.projectId, supplierId: filters.supplierId, ...(filters.search ? { OR: ["number", "equipmentName", "equipmentIdentifier"].map((field) => ({ [field]: { contains: filters.search, mode: "insensitive" as const } })) } : {}) },
    include: rentalInclude, orderBy: [{ startsAt: "desc" }, { number: "asc" }],
  });
  return rows.map((row) => rentalRow(row)).filter((row) => !filters.status || row.status === filters.status);
}

export async function readEquipmentRental(client: RentalReadClient, companyId: string, id: string): Promise<EquipmentRentalDetail | null> {
  const rental = await client.equipmentRental.findFirst({ where: { companyId, id }, include: rentalInclude });
  return rental ? { ...rentalRow(rental), charges: rental.charges.map(chargeRow) } : null;
}

export async function readRentalOptions(client: RentalReadClient, companyId: string, currentRentalId?: string): Promise<RentalOptions> {
  const current = currentRentalId ? await client.equipmentRental.findFirst({ where: { companyId, id: currentRentalId }, select: { projectId: true, supplierId: true } }) : null;
  if (currentRentalId && !current) throw new HttpError(404, "Equipment rental not found");
  const [projects, suppliers] = await Promise.all([
    client.project.findMany({ where: { companyId, ...(current ? { OR: [{ active: true }, { id: current.projectId }] } : { active: true }) }, select: { id: true, code: true, name: true, active: true }, orderBy: { code: "asc" } }),
    client.partner.findMany({ where: { companyId, ...(current ? { OR: [{ supplier: true }, { id: current.supplierId }] } : { supplier: true }) }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { projects, suppliers };
}

async function validateRentalLinks(client: RentalReadClient, companyId: string, input: EquipmentRentalInput, current?: RentalRecord): Promise<void> {
  const [project, supplier] = await Promise.all([
    client.project.findFirst({ where: { companyId, id: input.projectId, ...(current?.projectId === input.projectId ? {} : { active: true }) }, select: { id: true } }),
    client.partner.findFirst({ where: { companyId, id: input.supplierId, ...(current?.supplierId === input.supplierId ? {} : { supplier: true }) }, select: { id: true } }),
  ]);
  if (!project || !supplier) throw new HttpError(422, "Active project or rental supplier not found");
  if (current?.charges.length && (current.projectId !== input.projectId || current.supplierId !== input.supplierId)) throw new HttpError(409, "Project and supplier cannot change after rental charges exist");
  const duplicate = await client.equipmentRental.findFirst({ where: { companyId, number: input.number, ...(current ? { id: { not: current.id } } : {}) }, select: { id: true } });
  if (duplicate) throw new HttpError(409, "Rental reference already exists");
}

function rentalData(input: EquipmentRentalInput) {
  return { ...input, startsAt: new Date(`${input.startsAt}T00:00:00.000Z`), expectedReturnAt: input.expectedReturnAt ? new Date(`${input.expectedReturnAt}T00:00:00.000Z`) : null, returnedAt: input.returnedAt ? new Date(`${input.returnedAt}T00:00:00.000Z`) : null };
}

export async function createEquipmentRental(transaction: Prisma.TransactionClient, companyId: string, input: EquipmentRentalInput): Promise<EquipmentRentalDetail> {
  await validateRentalLinks(transaction, companyId, input);
  const rental = await transaction.equipmentRental.create({ data: { companyId, ...rentalData(input) }, include: rentalInclude });
  return { ...rentalRow(rental), charges: [] };
}

export async function updateEquipmentRental(transaction: Prisma.TransactionClient, companyId: string, id: string, input: EquipmentRentalUpdate): Promise<EquipmentRentalDetail> {
  const current = await transaction.equipmentRental.findFirst({ where: { companyId, id }, include: rentalInclude });
  if (!current) throw new HttpError(404, "Equipment rental not found");
  if (current.revision !== input.revision) throw new HttpError(409, "Equipment rental changed; reload before saving");
  const { revision, ...data } = input;
  await validateRentalLinks(transaction, companyId, data, current);
  const changed = await transaction.equipmentRental.updateMany({ where: { companyId, id, revision }, data: { ...rentalData(data), revision: { increment: 1 } } });
  if (changed.count !== 1) throw new HttpError(409, "Equipment rental changed; reload before saving");
  const result = await readEquipmentRental(transaction, companyId, id);
  if (!result) throw new HttpError(404, "Equipment rental not found");
  return result;
}

export async function createRentalCharge(transaction: Prisma.TransactionClient, actor: Actor, rentalId: string, input: RentalChargeInput): Promise<RentalChargeRow> {
  const rental = await transaction.equipmentRental.findFirst({ where: { companyId: actor.companyId, id: rentalId }, select: { id: true, number: true, projectId: true, supplierId: true, revision: true } });
  if (!rental) throw new HttpError(404, "Equipment rental not found");
  const duplicate = await transaction.rentalCharge.findFirst({ where: { companyId: actor.companyId, rentalId, documentKind: input.documentKind, documentNumber: input.documentNumber }, select: { id: true } });
  if (duplicate) throw new HttpError(409, "Rental document already registered");
  const accounts = await transaction.account.findMany({ where: { companyId: actor.companyId, active: true, OR: [{ code: accountCodes.equipmentRentalCost, type: "COST" }, { code: accountCodes.supplierPayable, type: "LIABILITY" }] }, select: { code: true } });
  if (accounts.length !== 2) throw new HttpError(422, "Required rental accounting accounts are missing or inactive");
  const amount = money(input.amount);
  const files = await prepareRentalFiles(input.files ?? []);
  const changed = await transaction.equipmentRental.updateMany({ where: { companyId: actor.companyId, id: rentalId, revision: rental.revision }, data: { revision: { increment: 1 } } });
  if (changed.count !== 1) throw new HttpError(409, "Equipment rental changed; retry creating the charge");
  const charge = await transaction.rentalCharge.create({ data: {
    companyId: actor.companyId, rentalId, documentKind: input.documentKind, documentNumber: input.documentNumber,
    issuedAt: new Date(`${input.issuedAt}T00:00:00.000Z`), dueAt: new Date(`${input.dueAt}T00:00:00.000Z`), amount,
    documentUrl: input.documentUrl, notes: input.notes, files: { create: files },
  } });
  await transaction.payable.create({ data: { companyId: actor.companyId, contractorId: rental.supplierId, projectId: rental.projectId, rentalChargeId: charge.id, amount, dueAt: charge.dueAt } });
  await postEntry(transaction, { companyId: actor.companyId, debitCode: accountCodes.equipmentRentalCost, creditCode: accountCodes.supplierPayable, amount, projectId: rental.projectId, description: `Equipment rental ${rental.number}: ${charge.documentNumber}`, source: "RENTAL_CHARGE", sourceId: charge.id, occurredAt: charge.issuedAt, createdById: actor.userId });
  return chargeRow(await transaction.rentalCharge.findFirstOrThrow({ where: { companyId: actor.companyId, id: charge.id }, include: chargeInclude }));
}
