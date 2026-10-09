import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse, requireJson } from "@/lib/http";
import { previewRentalDocuments } from "@/modules/rentals/documents";
import { rentalFilesSchema } from "@/modules/rentals/documents-schema";
import { readRentalDocumentBody } from "@/modules/rentals/documents-request";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    requireJson(request);
    if (request.nextUrl.searchParams.size) throw new HttpError(400, "Query parameters are not supported");
    const { id } = z.object({ id: z.uuid() }).parse(await params);
    const rental = await db.equipmentRental.findFirst({ where: { id, companyId: actor.companyId }, select: { id: true } });
    if (!rental) throw new HttpError(404, "Equipment rental not found");
    const { files } = z.object({ files: rentalFilesSchema }).strict().parse(await readRentalDocumentBody(request));
    return NextResponse.json(previewRentalDocuments(files), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid rental files", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
