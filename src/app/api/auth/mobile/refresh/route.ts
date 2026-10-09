import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rotateSession } from "@/lib/auth";
import { refreshTokenSchema } from "@/lib/auth-validation";
import { errorResponse, requireJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireJson(request);
    const { refreshToken } = refreshTokenSchema.parse(await request.json());
    return NextResponse.json(await rotateSession(refreshToken), { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
