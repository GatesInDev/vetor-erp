import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse, requireJson } from "@/lib/http";
import { mailAttachmentSelectionSchema } from "@/modules/mail/import-schema";
import { readMailAttachmentFiles } from "@/modules/mail/operations";
import { previewRentalDocuments } from "@/modules/rentals/documents";
import { readRentalDocumentBody } from "@/modules/rentals/documents-request";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    requireJson(request);
    z.object({}).strict().parse(Object.fromEntries(request.nextUrl.searchParams));
    const id = z.uuid().parse((await context.params).id);
    const input = mailAttachmentSelectionSchema.parse(await readRentalDocumentBody(request));
    const files = await readMailAttachmentFiles(db, actor.companyId, id, input.attachmentIds, false);
    return NextResponse.json(previewRentalDocuments(files), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email preview", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
