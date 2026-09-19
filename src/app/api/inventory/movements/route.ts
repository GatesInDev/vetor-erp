import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { recordStockMovement } from "@/modules/inventory/server/movements";
import { listStockMovements } from "@/modules/inventory/server/queries";
import { stockMovementSchema } from "@/modules/inventory/server/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = authorize(await currentActor(), Object.values(Role));
    return NextResponse.json({ movements: await listStockMovements(actor.companyId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const input = stockMovementSchema.parse(await request.json());
    return await idempotentMutation(request, actor, "inventory.movement.create", input, (transaction) => recordStockMovement(transaction, actor, input));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
