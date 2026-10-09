import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";

export function rejectTitleOwnerOverrides(value: unknown): void {
  if (value && typeof value === "object" && ("companyId" in value || "userId" in value)) throw new HttpError(403, "Financial titles are restricted to the authenticated company");
}

export function titleQuery(request: NextRequest): Record<string, string> {
  const parameters = Object.fromEntries(request.nextUrl.searchParams);
  rejectTitleOwnerOverrides(parameters);
  if (request.nextUrl.searchParams.size !== Object.keys(parameters).length) throw new HttpError(400, "Duplicate query parameters are not supported");
  return parameters;
}
