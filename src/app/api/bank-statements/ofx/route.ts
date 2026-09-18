import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse } from "@/lib/http";
import { parseOfx } from "@/lib/ofx";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    const content = await request.text();
    if (content.length > 2_000_000) throw new HttpError(413, "OFX file too large");
    const transactions = parseOfx(content);
    const fileHash = sha256(content);
    const existing = await db.bankStatement.findUnique({ where: { companyId_fileHash: { companyId: actor.companyId, fileHash } } });
    if (existing) return NextResponse.json({ statementId: existing.id, replayed: true });
    try {
      const statement = await db.bankStatement.create({ data: {
        companyId: actor.companyId, fileHash,
        transactions: { create: transactions },
      } });
      return NextResponse.json({ statementId: statement.id, transactionCount: transactions.length }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const stored = await db.bankStatement.findUnique({ where: { companyId_fileHash: { companyId: actor.companyId, fileHash } } });
        if (stored) return NextResponse.json({ statementId: stored.id, replayed: true });
        throw new HttpError(409, "Duplicate OFX transaction identifier");
      }
      throw error;
    }
  } catch (error) { return errorResponse(error); }
}
