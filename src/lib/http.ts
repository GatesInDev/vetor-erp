import { NextRequest, NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";
import { hasSameOrigin } from "@/lib/request-origin";

export function checkOrigin(request: NextRequest): void {
  if (!hasSameOrigin(request)) throw new HttpError(403, "Invalid origin");
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
