import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { reportTemplateInputSchema } from "@/modules/reports/schema";
import { readReportTemplateBody } from "@/modules/reports/template-request";
import { listReportTemplates, serializeReportTemplate } from "@/modules/reports/server/templates";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = authorize(await currentActor(), Object.values(Role));
    return NextResponse.json({ templates: await listReportTemplates(actor.companyId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const input = reportTemplateInputSchema.parse(await readReportTemplateBody(request));
    return await idempotentMutation(request, actor, "report-template.create", input, async (transaction) => {
      const template = await transaction.reportTemplate.create({ data: { companyId: actor.companyId, ...input } });
      return { template: serializeReportTemplate(template) };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid report template", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}
