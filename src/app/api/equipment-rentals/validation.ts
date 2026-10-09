import type { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";

export function rejectRentalOwnerOverrides(value: unknown): void {
  if (value && typeof value === "object" && ("companyId" in value || "userId" in value)) throw new HttpError(403, "Equipment rentals are restricted to the authenticated company");
}

export function rentalQuery(request: NextRequest): Record<string, string> {
  const query = Object.fromEntries(request.nextUrl.searchParams);
  rejectRentalOwnerOverrides(query);
  if (request.nextUrl.searchParams.size !== Object.keys(query).length) throw new HttpError(400, "Duplicate rental filters are not supported");
  return query;
}
