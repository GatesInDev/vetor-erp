import { NextRequest, NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";
import { hasSameOrigin } from "@/lib/request-origin";
import { isJsonContentType, requiresOriginCheck } from "@/lib/auth-credentials";

export function checkOrigin(request: NextRequest, options: { allowBearer?: boolean } = {}): void {
  if (options.allowBearer !== false && !requiresOriginCheck(request.headers.get("authorization"))) return;
  if (!hasSameOrigin(request)) throw new HttpError(403, "Invalid origin");
}

export function requireJson(request: NextRequest): void {
  if (!isJsonContentType(request.headers.get("content-type"))) throw new HttpError(415, "Content-Type must be application/json");
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
