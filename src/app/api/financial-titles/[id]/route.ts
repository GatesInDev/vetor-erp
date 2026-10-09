import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { checkOrigin, errorResponse, requireJson } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { financialTitleUpdateSchema } from "@/modules/finance/titles/schema";
import { getFinancialTitle, updateFinancialTitle } from "@/modules/finance/titles/server";
import { rejectTitleOwnerOverrides, titleQuery } from "../validation";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = authorize(await currentActor(request), Object.values(Role));
    z.object({}).strict().parse(titleQuery(request));
    const id = z.uuid().parse((await context.params).id);
    const title = await getFinancialTitle(actor.companyId, id);
    if (!title) throw new HttpError(404, "Financial title not found");
    return NextResponse.json({ title }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid financial title request", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    requireJson(request);
    z.object({}).strict().parse(titleQuery(request));
    const id = z.uuid().parse((await context.params).id);
    const body: unknown = await request.json();
    rejectTitleOwnerOverrides(body);
    const input = financialTitleUpdateSchema.parse(body);
    return await idempotentMutation(request, actor, "financial-title.update", { id, ...input }, async (transaction) => ({ title: await updateFinancialTitle(transaction, actor.companyId, id, input) }));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid financial title", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
