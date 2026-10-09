import "server-only";

import type { ReportTemplate as ReportTemplateRecord } from "@prisma/client";
import { db } from "@/lib/db";
import { reportDefinitionSchema } from "@/modules/reports/schema";

export function serializeReportTemplate(template: ReportTemplateRecord) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    definition: reportDefinitionSchema.parse(template.definition),
    revision: template.revision,
    active: template.active,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export type ReportTemplate = ReturnType<typeof serializeReportTemplate>;

export async function listReportTemplates(companyId: string): Promise<ReportTemplate[]> {
  const templates = await db.reportTemplate.findMany({
    where: { companyId },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
  });
  return templates.map(serializeReportTemplate);
}

export async function getReportTemplate(companyId: string, id: string): Promise<ReportTemplate | null> {
  const template = await db.reportTemplate.findFirst({ where: { id, companyId } });
  return template ? serializeReportTemplate(template) : null;
}
