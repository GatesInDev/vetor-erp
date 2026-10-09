import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { checkOrigin, errorResponse, requireJson } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { equipmentRentalUpdateSchema } from "@/modules/rentals/schema";
import { getEquipmentRental, updateEquipmentRental } from "@/modules/rentals/server";
import { rejectRentalOwnerOverrides, rentalQuery } from "../validation";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = authorize(await currentActor(request), Object.values(Role));
    z.object({}).strict().parse(rentalQuery(request));
    const id = z.uuid().parse((await context.params).id);
    const rental = await getEquipmentRental(actor.companyId, id);
    if (!rental) throw new HttpError(404, "Equipment rental not found");
    return NextResponse.json({ rental }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid rental request", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    requireJson(request);
    z.object({}).strict().parse(rentalQuery(request));
    const id = z.uuid().parse((await context.params).id);
    const body: unknown = await request.json();
    rejectRentalOwnerOverrides(body);
    const input = equipmentRentalUpdateSchema.parse(body);
    return await idempotentMutation(request, actor, "equipment-rental.update", { id, ...input }, async (transaction) => ({ rental: await updateEquipmentRental(transaction, actor.companyId, id, input) }));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid equipment rental", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
