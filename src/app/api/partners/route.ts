import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { partnerSchema } from "@/app/api/partners/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = authorize(await currentActor(), Object.values(Role));
    const partners = await db.partner.findMany({
      where: { companyId: actor.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, customer: true, supplier: true, taxIdEncrypted: true },
    });
    return NextResponse.json({ partners: partners.map(({ taxIdEncrypted, ...partner }) => ({ ...partner, hasTaxId: Boolean(taxIdEncrypted) })) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const input = partnerSchema.parse(await request.json());
    return await idempotentMutation(request, actor, "partner.create", input, async (transaction) => {
      const partner = await transaction.partner.create({ data: {
        companyId: actor.companyId, name: input.name, customer: input.customer, supplier: input.supplier,
        taxIdEncrypted: input.taxId ? encrypt(input.taxId) : null,
      } });
      return { partnerId: partner.id };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
