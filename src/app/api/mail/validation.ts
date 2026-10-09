import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/auth";

export function rejectMailOwnerOverrides(value: unknown): void {
  if (value && typeof value === "object" && ("companyId" in value || "userId" in value)) throw new HttpError(403, "Email is restricted to the authenticated company");
}

export function mailQuery(request: NextRequest): Record<string, string> {
  const values = Object.fromEntries(request.nextUrl.searchParams);
  rejectMailOwnerOverrides(values);
  if (request.nextUrl.searchParams.size !== Object.keys(values).length) throw new HttpError(400, "Duplicate email filters are not supported");
  return values;
}

export function requireEmptyMailQuery(request: NextRequest): void {
  z.object({}).strict().parse(mailQuery(request));
}

export async function readMailSettingsBody(request: Request): Promise<unknown> {
  const maximumBytes = 8192;
  if (Number(request.headers.get("content-length") ?? "0") > maximumBytes) throw new HttpError(413, "Email settings are too large");
  if (!request.body) throw new HttpError(400, "Request body is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new HttpError(413, "Email settings are too large");
      }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
