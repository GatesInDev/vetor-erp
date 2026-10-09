import { notFound } from "next/navigation";
import { z } from "zod";
import { ReportPreview } from "@/modules/reports/components/report-preview";
import { getReportTemplate } from "@/modules/reports/server/templates";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export const dynamic = "force-dynamic";

export default async function PreviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await getWorkspaceContext();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const template = await getReportTemplate(actor.companyId, id);
  if (!template) notFound();
  return (
    <WorkspaceScreen pathname={`/reports/${id}/preview`}>
      <ReportPreview key={`${template.id}-${template.revision}`} definition={template.definition} name={template.name} />
    </WorkspaceScreen>
  );
}
