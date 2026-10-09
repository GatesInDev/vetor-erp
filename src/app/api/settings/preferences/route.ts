import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { checkOrigin, errorResponse, requireJson } from "@/lib/http";
import { updateUserPreferencesSchema } from "@/modules/settings/schema";
import { getUserPreferences, updateUserPreferences } from "@/modules/settings/server/preferences";

export const runtime = "nodejs";

function rejectOwnerParameters(request: NextRequest): void {
  const parameters = request.nextUrl.searchParams;
  if (parameters.has("userId") || parameters.has("companyId")) throw new HttpError(403, "Preferences are restricted to the authenticated user");
  if (parameters.size > 0) throw new HttpError(400, "Preference query parameters are not supported");
}

export async function GET(request: NextRequest) {
  try {
    const actor = authorize(await currentActor(request), Object.values(Role));
    rejectOwnerParameters(request);
    return NextResponse.json({ preferences: await getUserPreferences(actor.userId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), Object.values(Role));
    requireJson(request);
    rejectOwnerParameters(request);
    const body: unknown = await request.json();
    if (body && typeof body === "object" && ("userId" in body || "companyId" in body)) throw new HttpError(403, "Preferences are restricted to the authenticated user");
    const input = updateUserPreferencesSchema.parse(body);
    return NextResponse.json({ preferences: await updateUserPreferences(actor.userId, input) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid preferences", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
