import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loginSession, setAuthCookies } from "@/lib/auth";
import { loginSchema } from "@/lib/auth-validation";
import { checkOrigin, errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request, { allowBearer: false });
    const input = loginSchema.parse(await request.json());
    const tokens = await loginSession(input.email, input.password);
    await setAuthCookies(tokens.accessToken, tokens.refreshToken);
    return NextResponse.json({ user: tokens.user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
