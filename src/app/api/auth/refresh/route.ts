import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAuthCookies, createRefreshToken, issueAccessToken, refreshHash, setAuthCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const token = (await cookies()).get("refresh_token")?.value;
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const oldHash = refreshHash(token);
    const nextToken = createRefreshToken();
    const session = await db.$transaction(async (transaction) => {
      const current = await transaction.session.findUnique({ where: { refreshHash: oldHash }, include: { user: true } });
      if (!current || current.revokedAt || current.expiresAt <= new Date() || !current.user.active) return null;
      const updated = await transaction.session.updateMany({ where: { id: current.id, refreshHash: oldHash, revokedAt: null }, data: { refreshHash: refreshHash(nextToken) } });
      return updated.count === 1 ? current : null;
    });
    if (!session) {
      await clearAuthCookies();
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }
    await setAuthCookies(await issueAccessToken({ userId: session.user.id, companyId: session.user.companyId, role: session.user.role, sessionId: session.id }), nextToken);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
