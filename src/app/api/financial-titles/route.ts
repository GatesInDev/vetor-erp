import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { checkOrigin, errorResponse, requireJson } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { financialTitleFiltersSchema, financialTitleInputSchema } from "@/modules/finance/titles/schema";
import { createFinancialTitle, getFinancialTitles } from "@/modules/finance/titles/server";
import { rejectTitleOwnerOverrides, titleQuery } from "./validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = authorize(await currentActor(request), Object.values(Role));
    const filters = financialTitleFiltersSchema.parse(titleQuery(request));
    return NextResponse.json({ titles: await getFinancialTitles(actor.companyId, filters) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid financial title filters", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    requireJson(request);
    z.object({}).strict().parse(titleQuery(request));
    const body: unknown = await request.json();
    rejectTitleOwnerOverrides(body);
    const input = financialTitleInputSchema.parse(body);
    return await idempotentMutation(request, actor, "financial-title.create", input, async (transaction) => ({ title: await createFinancialTitle(transaction, actor.companyId, input) }));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid financial title", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
