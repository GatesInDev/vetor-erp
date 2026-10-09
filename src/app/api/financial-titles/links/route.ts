import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getTitleLinkOptions } from "@/modules/finance/titles/server";
import { titleQuery } from "../validation";

export const runtime = "nodejs";
const querySchema = z.object({ currentTitleId: z.uuid().optional() }).strict();

export async function GET(request: NextRequest) {
  try {
    const actor = authorize(await currentActor(request), Object.values(Role));
    const query = querySchema.parse(titleQuery(request));
    return NextResponse.json({ options: await getTitleLinkOptions(actor.companyId, query.currentTitleId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid financial title link request", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
