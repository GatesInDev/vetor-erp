import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { partnerSchema } from "@/app/api/partners/validation";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const id = z.uuid().parse((await context.params).id);
    const input = partnerSchema.parse(await request.json());
    return await idempotentMutation(request, actor, "partner.update", { id, ...input }, async (transaction) => {
      const partner = await transaction.partner.findFirst({ where: { id, companyId: actor.companyId }, select: { id: true } });
      if (!partner) throw new HttpError(404, "Partner not found");
      await transaction.partner.update({ where: { id, companyId: actor.companyId }, data: {
        name: input.name, customer: input.customer, supplier: input.supplier,
        ...(input.taxId ? { taxIdEncrypted: encrypt(input.taxId) } : {}),
      } });
      return { partnerId: id };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
