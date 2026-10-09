import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";

export function accountingQuery(request: NextRequest): Record<string, string> {
  const query = Object.fromEntries(request.nextUrl.searchParams);
  if ("companyId" in query || "userId" in query) throw new HttpError(403, "Accounting reports are restricted to the authenticated company");
  if (request.nextUrl.searchParams.size !== Object.keys(query).length) throw new HttpError(400, "Duplicate accounting filters are not supported");
  return query;
}
