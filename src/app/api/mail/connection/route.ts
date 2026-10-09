import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { checkOrigin, errorResponse, requireJson } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { saveMailConnection } from "@/modules/mail/operations";
import { mailConnectionInputSchema } from "@/modules/mail/schema";
import { getMailConnection } from "@/modules/mail/server";
import { readMailSettingsBody, rejectMailOwnerOverrides, requireEmptyMailQuery } from "../validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = authorize(await currentActor(request), [Role.ADMIN]);
    requireEmptyMailQuery(request);
    return NextResponse.json({ connection: await getMailConnection(actor.companyId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email connection request" }, { status: 400 });
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN]);
    requireEmptyMailQuery(request);
    requireJson(request);
    const body = await readMailSettingsBody(request);
    rejectMailOwnerOverrides(body);
    const input = mailConnectionInputSchema.parse(body);
    return await idempotentMutation(request, actor, "mail.connection.save", input, async (transaction) => ({ connection: await saveMailConnection(transaction, actor.companyId, input) }));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email connection settings" }, { status: 400 });
    return errorResponse(error);
  }
}
