import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { payFinancialPayable } from "@/modules/rentals/payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    const id = z.uuid().parse((await context.params).id);
    return await idempotentMutation(request, actor, "payable.pay", { id }, (transaction) => payFinancialPayable(transaction, actor, id));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid payable ID" }, { status: 400 });
    return errorResponse(error);
  }
}
