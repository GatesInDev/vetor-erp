import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { authorizeMailCron, synchronizeAutomaticMailboxes } from "@/modules/mail/cron";
import { syncMailbox } from "@/modules/mail/server";
import { requireEmptyMailQuery } from "../../mail/validation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    authorizeMailCron(request.headers.get("authorization"), process.env.CRON_SECRET);
    requireEmptyMailQuery(request);
    return NextResponse.json(await synchronizeAutomaticMailboxes(db, syncMailbox), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email scheduler request" }, { status: 400 });
    return errorResponse(error);
  }
}
