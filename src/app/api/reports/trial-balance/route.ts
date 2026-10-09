import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { accountingQuery } from "@/modules/reports/accounting/request";
import { trialBalanceFiltersSchema } from "@/modules/reports/accounting/schema";
import { getTrialBalance } from "@/modules/reports/accounting/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.VIEWER]);
    const filters = trialBalanceFiltersSchema.parse(accountingQuery(request));
    return NextResponse.json(await getTrialBalance(actor.companyId, filters), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid trial balance filters", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
