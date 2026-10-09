import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { checkOrigin, errorResponse, requireJson } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { importMailCharge } from "@/modules/mail/import-charge";
import { mailChargeImportSchema } from "@/modules/mail/import-schema";
import { readRentalDocumentBody } from "@/modules/rentals/documents-request";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    requireJson(request);
    z.object({}).strict().parse(Object.fromEntries(request.nextUrl.searchParams));
    const id = z.uuid().parse((await context.params).id);
    const input = mailChargeImportSchema.parse(await readRentalDocumentBody(request));
    return await idempotentMutation(request, actor, "mail-charge.import", { messageId: id, ...input }, (transaction) => importMailCharge(transaction, actor, id, input));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email import", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
