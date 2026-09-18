import { NextRequest, NextResponse } from "next/server";
import { currentActor, clearAuthCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = await currentActor();
    if (actor) await db.session.update({ where: { id: actor.sessionId }, data: { revokedAt: new Date() } });
    await clearAuthCookies();
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
