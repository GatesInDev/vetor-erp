import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { checkOrigin, errorResponse, requireJson } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { equipmentRentalInputSchema, rentalFiltersSchema } from "@/modules/rentals/schema";
import { createEquipmentRental, getEquipmentRentals } from "@/modules/rentals/server";
import { rejectRentalOwnerOverrides, rentalQuery } from "./validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = authorize(await currentActor(request), Object.values(Role));
    const filters = rentalFiltersSchema.parse(rentalQuery(request));
    return NextResponse.json({ rentals: await getEquipmentRentals(actor.companyId, filters) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid rental filters", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    requireJson(request);
    z.object({}).strict().parse(rentalQuery(request));
    const body: unknown = await request.json();
    rejectRentalOwnerOverrides(body);
    const input = equipmentRentalInputSchema.parse(body);
    return await idempotentMutation(request, actor, "equipment-rental.create", input, async (transaction) => ({ rental: await createEquipmentRental(transaction, actor.companyId, input) }));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid equipment rental", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
