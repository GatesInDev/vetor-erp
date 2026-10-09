import { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/auth";
import { titleBalance } from "./balance";
import { financialOriginReference } from "../origin";
import type { FinancialTitleFilters, FinancialTitleInput, FinancialTitleUpdate } from "./schema";
import type { FinancialAccountOrigin, FinancialTitleRow, TitleAccountSnapshot, TitleAccountType, TitleLinkOption } from "./types";

export const payableInclude = { contractor: true, contract: true, project: true, rentalCharge: { include: { rental: true } } } satisfies Prisma.PayableInclude;
const receivableInclude = { customer: true, invoice: true, project: true } satisfies Prisma.ReceivableInclude;
const titleInclude = { payable: { include: payableInclude }, receivable: { include: receivableInclude } } satisfies Prisma.FinancialTitleInclude;

type PayableRecord = Prisma.PayableGetPayload<{ include: typeof payableInclude }>;
type ReceivableRecord = Prisma.ReceivableGetPayload<{ include: typeof receivableInclude }>;
type TitleRecord = Prisma.FinancialTitleGetPayload<{ include: typeof titleInclude }>;
type AccountClient = Pick<Prisma.TransactionClient, "payable" | "receivable">;
export type TitleReadClient = AccountClient & Pick<Prisma.TransactionClient, "financialTitle">;

export function payableSnapshot(account: PayableRecord): TitleAccountSnapshot {
  const origin: FinancialAccountOrigin | null = account.contract
    ? { id: account.contract.id, number: account.contract.number, type: "CONTRACT" }
    : account.rentalCharge ? { id: account.rentalCharge.rental.id, number: account.rentalCharge.rental.number, type: "RENTAL", chargeId: account.rentalCharge.id, documentNumber: account.rentalCharge.documentNumber, equipmentName: account.rentalCharge.rental.equipmentName } : null;
  if (!origin) throw new HttpError(409, "Payable has no linked origin");
  return {
    accountType: "PAYABLE", accountId: account.id,
    ...titleBalance(account.amount, account.status === "PAID" ? account.amount : new Prisma.Decimal(0), account.status === "CANCELLED"),
    dueAt: account.dueAt.toISOString(), partner: { id: account.contractor.id, name: account.contractor.name },
    project: { id: account.project.id, name: account.project.name },
    origin, measurementId: account.measurementId,
  };
}

export function receivableSnapshot(account: ReceivableRecord): TitleAccountSnapshot {
  return {
    accountType: "RECEIVABLE", accountId: account.id,
    ...titleBalance(account.amount, account.received, account.invoice.status === "CANCELLED"),
    dueAt: account.dueAt.toISOString(), partner: { id: account.customer.id, name: account.customer.name },
    project: { id: account.project.id, name: account.project.name },
    origin: { id: account.invoice.id, number: account.invoice.number, type: "INVOICE" }, measurementId: null,
  };
}

function titleRow(title: TitleRecord): FinancialTitleRow {
  const account = title.payable ? payableSnapshot(title.payable) : title.receivable ? receivableSnapshot(title.receivable) : null;
  if (!account) throw new HttpError(409, "Financial title has no linked account");
  return {
    id: title.id, kind: title.kind, number: title.number, bankName: title.bankName,
    digitLine: title.digitLine, barcode: title.barcode, notes: title.notes, revision: title.revision, ...account,
  };
}

export async function readFinancialTitles(client: TitleReadClient, companyId: string, filters: FinancialTitleFilters = {}): Promise<FinancialTitleRow[]> {
  const titles = await client.financialTitle.findMany({
    where: { companyId, kind: filters.kind, ...(filters.accountType === "PAYABLE" ? { payableId: { not: null } } : filters.accountType === "RECEIVABLE" ? { receivableId: { not: null } } : {}) },
    include: titleInclude, orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  const search = filters.search?.toLocaleLowerCase();
  return titles.map(titleRow).filter((title) =>
    (!filters.status || title.status === filters.status) &&
    (!search || [title.number, title.bankName, title.partner.name, title.project.name, financialOriginReference(title.origin), ...(title.origin.type === "RENTAL" ? [title.origin.equipmentName] : [])].some((value) => value.toLocaleLowerCase().includes(search))),
  );
}

export async function readFinancialTitle(client: TitleReadClient, companyId: string, id: string): Promise<FinancialTitleRow | null> {
  const title = await client.financialTitle.findFirst({ where: { companyId, id }, include: titleInclude });
  return title ? titleRow(title) : null;
}

function linkOption(account: TitleAccountSnapshot): TitleLinkOption {
  return { ...account, label: `${financialOriginReference(account.origin)} · ${account.partner.name} · ${account.project.name}` };
}

export async function readTitleLinkOptions(client: TitleReadClient, companyId: string, currentTitleId?: string): Promise<TitleLinkOption[]> {
  const current = currentTitleId ? await client.financialTitle.findFirst({ where: { companyId, id: currentTitleId }, select: { id: true } }) : null;
  if (currentTitleId && !current) throw new HttpError(404, "Financial title not found");
  const [payables, receivables] = await Promise.all([
    client.payable.findMany({
      where: { companyId, OR: [{ status: { not: "CANCELLED" }, financialTitle: null }, ...(current ? [{ financialTitle: { id: current.id } }] : [])] },
      include: payableInclude, orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    }),
    client.receivable.findMany({
      where: { companyId, OR: [{ invoice: { status: { not: "CANCELLED" } }, financialTitle: null }, ...(current ? [{ financialTitle: { id: current.id } }] : [])] },
      include: receivableInclude, orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    }),
  ]);
  return [...payables.map(payableSnapshot), ...receivables.map(receivableSnapshot)].map(linkOption).sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.accountId.localeCompare(right.accountId));
}

async function getLinkedAccount(client: AccountClient, companyId: string, accountType: TitleAccountType, accountId: string): Promise<TitleAccountSnapshot> {
  if (accountType === "PAYABLE") {
    const account = await client.payable.findFirst({ where: { companyId, id: accountId }, include: payableInclude });
    if (!account) throw new HttpError(404, "Linked payable not found");
    return payableSnapshot(account);
  }
  const account = await client.receivable.findFirst({ where: { companyId, id: accountId }, include: receivableInclude });
  if (!account) throw new HttpError(404, "Linked receivable not found");
  return receivableSnapshot(account);
}

function titleData(input: FinancialTitleInput) {
  const { accountType, accountId, ...metadata } = input;
  return { ...metadata, payableId: accountType === "PAYABLE" ? accountId : null, receivableId: accountType === "RECEIVABLE" ? accountId : null };
}

async function validateLink(transaction: Prisma.TransactionClient, companyId: string, input: FinancialTitleInput, current?: TitleRecord): Promise<void> {
  const account = await getLinkedAccount(transaction, companyId, input.accountType, input.accountId);
  const unchanged = current && (input.accountType === "PAYABLE" ? current.payableId : current.receivableId) === input.accountId;
  if (account.status === "CANCELLED" && !unchanged) throw new HttpError(409, "Cancelled accounts cannot receive new financial titles");
  const existing = await transaction.financialTitle.findFirst({
    where: { companyId, ...(input.accountType === "PAYABLE" ? { payableId: input.accountId } : { receivableId: input.accountId }), ...(current ? { id: { not: current.id } } : {}) },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, "Linked account already has a financial title");
}

export async function createFinancialTitle(transaction: Prisma.TransactionClient, companyId: string, input: FinancialTitleInput): Promise<FinancialTitleRow> {
  await validateLink(transaction, companyId, input);
  const title = await transaction.financialTitle.create({ data: { companyId, ...titleData(input) }, include: titleInclude });
  return titleRow(title);
}

export async function updateFinancialTitle(transaction: Prisma.TransactionClient, companyId: string, id: string, input: FinancialTitleUpdate): Promise<FinancialTitleRow> {
  const current = await transaction.financialTitle.findFirst({ where: { companyId, id }, include: titleInclude });
  if (!current) throw new HttpError(404, "Financial title not found");
  if (current.revision !== input.revision) throw new HttpError(409, "Financial title changed; reload before saving");
  const { revision, ...data } = input;
  await validateLink(transaction, companyId, data, current);
  const updated = await transaction.financialTitle.updateMany({ where: { companyId, id, revision }, data: { ...titleData(data), revision: { increment: 1 } } });
  if (updated.count !== 1) throw new HttpError(409, "Financial title changed; reload before saving");
  return titleRow(await transaction.financialTitle.findFirstOrThrow({ where: { companyId, id }, include: titleInclude }));
}
