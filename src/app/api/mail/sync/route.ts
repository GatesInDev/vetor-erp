import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { syncMailbox } from "@/modules/mail/server";
import { requireEmptyMailQuery } from "../validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    requireEmptyMailQuery(request);
    return NextResponse.json(await syncMailbox(actor.companyId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email synchronization request" }, { status: 400 });
    return errorResponse(error);
  }
}
