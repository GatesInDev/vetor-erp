import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; chargeId: string; fileId: string }> }) {
  try {
    const actor = authorize(await currentActor(request), Object.values(Role));
    if (request.nextUrl.searchParams.size) throw new HttpError(400, "Query parameters are not supported");
    const { id, chargeId, fileId } = z.object({ id: z.uuid(), chargeId: z.uuid(), fileId: z.uuid() }).parse(await params);
    const file = await db.rentalChargeFile.findFirst({
      where: { id: fileId, companyId: actor.companyId, rentalChargeId: chargeId, rentalCharge: { companyId: actor.companyId, rentalId: id, rental: { companyId: actor.companyId } } },
      select: { fileName: true, mediaType: true, contentEncrypted: true },
    });
    if (!file) throw new HttpError(404, "Rental file not found");
    const bytes = Buffer.from(decrypt(file.contentEncrypted), "base64");
    const name = encodeURIComponent(file.fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(Uint8Array.from(bytes), { headers: {
      "Content-Type": file.mediaType,
      "Content-Disposition": `attachment; filename="rental-document.${file.mediaType === "application/pdf" ? "pdf" : "xml"}"; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'",
    } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid rental file identifier" }, { status: 400 });
    return errorResponse(error);
  }
}
