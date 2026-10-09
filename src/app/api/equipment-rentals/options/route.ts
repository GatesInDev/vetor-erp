import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getRentalOptions } from "@/modules/rentals/server";
import { rentalQuery } from "../validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = authorize(await currentActor(request), Object.values(Role));
    const { currentRentalId } = z.object({ currentRentalId: z.uuid().optional() }).strict().parse(rentalQuery(request));
    return NextResponse.json(await getRentalOptions(actor.companyId, currentRentalId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid rental options request", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
