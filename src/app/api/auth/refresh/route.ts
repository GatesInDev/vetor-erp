import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAuthCookies, HttpError, rotateSession, setAuthCookies } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request, { allowBearer: false });
    const token = (await cookies()).get("refresh_token")?.value;
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const tokens = await rotateSession(token);
    await setAuthCookies(tokens.accessToken, tokens.refreshToken);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) await clearAuthCookies();
    return errorResponse(error);
  }
}
