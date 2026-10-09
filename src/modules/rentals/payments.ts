import type { Prisma } from "@prisma/client";
import { HttpError, type Actor } from "@/lib/auth";
import { accountCodes, postEntry } from "@/lib/finance";

export async function payFinancialPayable(transaction: Prisma.TransactionClient, actor: Actor, id: string) {
  const payable = await transaction.payable.findFirst({ where: { id, companyId: actor.companyId }, include: { contract: true, rentalCharge: { include: { rental: true } } } });
  if (!payable) throw new HttpError(404, "Payable not found");
  if (Boolean(payable.contract) === Boolean(payable.rentalCharge)) throw new HttpError(409, "Payable origin is unavailable");
  if (payable.rentalCharge && (payable.rentalCharge.companyId !== actor.companyId || !payable.amount.equals(payable.rentalCharge.amount))) throw new HttpError(409, "Payable does not match the rental charge");
  const rental = payable.rentalCharge?.rental;
  const source = rental ?? payable.contract;
  const sourcePartner = rental?.supplierId ?? payable.contract?.contractorId;
  if (payable.status !== "OPEN" || !source || source.companyId !== actor.companyId || source.projectId !== payable.projectId || sourcePartner !== payable.contractorId) throw new HttpError(409, "Payable is unavailable");
  const debitCode = rental ? accountCodes.supplierPayable : accountCodes.contractorPayable;
  const accounts = await transaction.account.findMany({ where: { companyId: actor.companyId, active: true, OR: [{ code: debitCode, type: "LIABILITY" }, { code: accountCodes.bank, type: "ASSET" }] }, select: { code: true } });
  if (accounts.length !== 2) throw new HttpError(422, "Required payment accounting accounts are missing or inactive");
  const paidAt = new Date();
  const updated = await transaction.payable.updateMany({ where: { id, companyId: actor.companyId, status: "OPEN" }, data: { status: "PAID", paidAt } });
  if (updated.count !== 1) throw new HttpError(409, "Payable already paid");
  const entry = await postEntry(transaction, {
    companyId: actor.companyId, debitCode, creditCode: accountCodes.bank,
    amount: payable.amount, projectId: payable.projectId, description: `${rental ? "Equipment rental" : "Contract"} payment ${source.number}`,
    source: rental ? "RENTAL_PAYMENT" : "CONTRACT_PAYMENT", sourceId: payable.id, occurredAt: paidAt, createdById: actor.userId,
  });
  return { entryId: entry.id, amount: payable.amount.toFixed(2) };
}
