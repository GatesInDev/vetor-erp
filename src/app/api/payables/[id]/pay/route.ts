import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { accountCodes, postEntry } from "@/lib/finance";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    const { id } = await context.params;
    return await idempotentMutation(request, actor, "payable.pay", { id }, async (transaction) => {
      const payable = await transaction.payable.findFirst({ where: { id, companyId: actor.companyId }, include: { contract: true } });
      if (!payable) throw new HttpError(404, "Payable not found");
      if (payable.status !== "OPEN" || payable.projectId !== payable.contract.projectId) throw new HttpError(409, "Payable is unavailable");
      const updated = await transaction.payable.updateMany({ where: { id, status: "OPEN" }, data: { status: "PAID", paidAt: new Date() } });
      if (updated.count !== 1) throw new HttpError(409, "Payable already paid");
      const entry = await postEntry(transaction, {
        companyId: actor.companyId, debitCode: accountCodes.contractorPayable, creditCode: accountCodes.bank,
        amount: payable.amount, projectId: payable.projectId, description: `Contract payment ${payable.contract.number}`,
        source: "CONTRACT_PAYMENT", sourceId: payable.id, occurredAt: new Date(), createdById: actor.userId,
      });
      return { entryId: entry.id, amount: payable.amount.toFixed(2) };
    });
  } catch (error) { return errorResponse(error); }
}
