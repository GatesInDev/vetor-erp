import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { mailMessageFiltersSchema } from "@/modules/mail/schema";
import { getMailMessages } from "@/modules/mail/server";
import { mailQuery } from "../validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = authorize(await currentActor(request), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    const filters = mailMessageFiltersSchema.parse(mailQuery(request));
    return NextResponse.json(await getMailMessages(actor.companyId, filters), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid email filters" }, { status: 400 });
    return errorResponse(error);
  }
}
