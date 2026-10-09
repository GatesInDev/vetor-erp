import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ReportEditor } from "@/modules/reports/components/report-editor";
import { getReportTemplate } from "@/modules/reports/server/templates";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export const dynamic = "force-dynamic";

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await getWorkspaceContext();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)) redirect("/reports");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const template = await getReportTemplate(actor.companyId, id);
  if (!template) notFound();
  return (
    <WorkspaceScreen pathname={`/reports/${id}/edit`}>
      <ReportEditor key={template.id} initial={{ name: template.name, description: template.description, definition: template.definition, active: template.active }} template={template} />
    </WorkspaceScreen>
  );
}
