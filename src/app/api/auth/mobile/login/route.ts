import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loginSession } from "@/lib/auth";
import { loginSchema } from "@/lib/auth-validation";
import { errorResponse, requireJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireJson(request);
    const input = loginSchema.parse(await request.json());
    return NextResponse.json(await loginSession(input.email, input.password), { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
