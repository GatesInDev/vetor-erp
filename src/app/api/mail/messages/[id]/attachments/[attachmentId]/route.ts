import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { readMailAttachment } from "@/modules/mail/operations";
import { requireEmptyMailQuery } from "../../../../validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    requireEmptyMailQuery(request);
    const { id, attachmentId } = z.object({ id: z.uuid(), attachmentId: z.uuid() }).parse(await context.params);
    const attachment = await readMailAttachment(db, actor.companyId, id, attachmentId);
    const fallback = attachment.fileName.replace(/[^A-Za-z0-9._-]/g, "_");
    return new NextResponse(new Uint8Array(attachment.content), { headers: {
      "Content-Type": attachment.mediaType,
      "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      "Content-Length": attachment.content.length.toString(),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email attachment request" }, { status: 400 });
    return errorResponse(error);
  }
}
