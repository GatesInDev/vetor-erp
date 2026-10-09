import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getReportData, reportDataFilterSchema } from "@/modules/reports/server/data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = authorize(await currentActor(request), Object.values(Role));
    const search = request.nextUrl.searchParams;
    if ([...search.keys()].some((key) => search.getAll(key).length > 1)) throw new HttpError(400, "Duplicate report filter");
    const input = reportDataFilterSchema.safeParse(Object.fromEntries(search));
    if (!input.success) throw new HttpError(400, "Invalid report filters");
    return NextResponse.json(await getReportData(actor, input.data), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
