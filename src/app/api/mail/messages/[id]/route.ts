import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getMailMessage } from "@/modules/mail/server";
import { requireEmptyMailQuery } from "../../validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    requireEmptyMailQuery(request);
    const id = z.uuid().parse((await context.params).id);
    const message = await getMailMessage(actor.companyId, id);
    if (!message) throw new HttpError(404, "Email message not found");
    return NextResponse.json({ message }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email request" }, { status: 400 });
    return errorResponse(error);
  }
}
