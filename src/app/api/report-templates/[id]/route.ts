import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { reportTemplateInputSchema } from "@/modules/reports/schema";
import { readReportTemplateBody } from "@/modules/reports/template-request";
import { getReportTemplate, serializeReportTemplate } from "@/modules/reports/server/templates";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const revisionSchema = z.object({ revision: z.number().int().positive().max(2147483646) }).strict();
const updateSchema = reportTemplateInputSchema.extend(revisionSchema.shape);

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const actor = authorize(await currentActor(), Object.values(Role));
    const id = z.uuid().parse((await context.params).id);
    const template = await getReportTemplate(actor.companyId, id);
    if (!template) throw new HttpError(404, "Report template not found");
    return NextResponse.json({ template });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid report template ID" }, { status: 400 });
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const id = z.uuid().parse((await context.params).id);
    const input = updateSchema.parse(await readReportTemplateBody(request));
    return await idempotentMutation(request, actor, "report-template.update", { id, ...input }, async (transaction) => {
      const existing = await transaction.reportTemplate.findFirst({ where: { id, companyId: actor.companyId }, select: { id: true } });
      if (!existing) throw new HttpError(404, "Report template not found");
      const { revision, ...data } = input;
      const updated = await transaction.reportTemplate.updateMany({
        where: { id, companyId: actor.companyId, revision },
        data: { ...data, revision: { increment: 1 } },
      });
      if (updated.count !== 1) throw new HttpError(409, "Report template changed; reload before saving");
      const template = await transaction.reportTemplate.findFirstOrThrow({ where: { id, companyId: actor.companyId } });
      return { template: serializeReportTemplate(template) };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid report template", details: error.flatten() }, { status: 400 });
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const id = z.uuid().parse((await context.params).id);
    const input = revisionSchema.parse(await request.json());
    return await idempotentMutation(request, actor, "report-template.archive", { id, ...input }, async (transaction) => {
      const existing = await transaction.reportTemplate.findFirst({ where: { id, companyId: actor.companyId }, select: { id: true } });
      if (!existing) throw new HttpError(404, "Report template not found");
      const updated = await transaction.reportTemplate.updateMany({
        where: { id, companyId: actor.companyId, revision: input.revision },
        data: { active: false, revision: { increment: 1 } },
      });
      if (updated.count !== 1) throw new HttpError(409, "Report template changed; reload before archiving");
      const template = await transaction.reportTemplate.findFirstOrThrow({ where: { id, companyId: actor.companyId } });
      return { template: serializeReportTemplate(template) };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid report template revision" }, { status: 400 });
    return errorResponse(error);
  }
}
