import argon2 from "argon2";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRefreshToken, issueAccessToken, refreshHash, setAuthCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse } from "@/lib/http";

export const runtime = "nodejs";

const inputSchema = z.object({ email: z.email(), password: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const input = inputSchema.parse(await request.json());
    const user = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user?.active || !(await argon2.verify(user.passwordHash, input.password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const refreshToken = createRefreshToken();
    const session = await db.session.create({ data: {
      userId: user.id, refreshHash: refreshHash(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    } });
    await setAuthCookies(await issueAccessToken({ userId: user.id, companyId: user.companyId, role: user.role, sessionId: session.id }), refreshToken);
    return NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
