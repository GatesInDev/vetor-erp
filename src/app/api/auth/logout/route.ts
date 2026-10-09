import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentActor, clearAuthCookies, revokeRefreshSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request, { allowBearer: false });
    const actor = await currentActor();
    if (actor) await db.session.update({ where: { id: actor.sessionId }, data: { revokedAt: new Date() } });
    const refreshToken = (await cookies()).get("refresh_token")?.value;
    if (refreshToken) await revokeRefreshSession(refreshToken);
    await clearAuthCookies();
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
