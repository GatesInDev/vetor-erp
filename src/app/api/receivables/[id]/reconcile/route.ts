import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { accountCodes, postEntry } from "@/lib/finance";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

const schema = z.object({ bankTransactionId: z.uuid() });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return await idempotentMutation(request, actor, "receivable.reconcile", { id, ...input }, async (transaction) => {
      const receivable = await transaction.receivable.findFirst({ where: { id, companyId: actor.companyId } });
      const bankTransaction = await transaction.bankTransaction.findFirst({ where: { id: input.bankTransactionId, statement: { companyId: actor.companyId } } });
      if (!receivable || !bankTransaction) throw new HttpError(404, "Receivable or bank transaction not found");
      if (bankTransaction.reconciledAt || bankTransaction.amount.lte(0)) throw new HttpError(409, "Bank transaction is unavailable");
      const open = receivable.amount.minus(receivable.received);
      if (bankTransaction.amount.gt(open)) throw new HttpError(422, "Receipt exceeds open balance");
      const updated = await transaction.bankTransaction.updateMany({ where: { id: bankTransaction.id, reconciledAt: null }, data: { receivableId: receivable.id, reconciledAt: new Date() } });
      if (updated.count !== 1) throw new HttpError(409, "Bank transaction already reconciled");
      await transaction.receivable.update({ where: { id: receivable.id }, data: { received: { increment: bankTransaction.amount } } });
      const entry = await postEntry(transaction, {
        companyId: actor.companyId, debitCode: accountCodes.bank, creditCode: accountCodes.receivable,
        amount: bankTransaction.amount, projectId: receivable.projectId, description: `Receipt ${bankTransaction.externalId}`,
        source: "BANK_RECEIPT", sourceId: bankTransaction.id, occurredAt: bankTransaction.postedAt, createdById: actor.userId,
      });
      return { entryId: entry.id, received: bankTransaction.amount.toFixed(2) };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
