import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ReportEditor } from "@/modules/reports/components/report-editor";
import { createReportPreset, reportPresets } from "@/modules/reports/presets";
import { getReportTemplate } from "@/modules/reports/server/templates";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export const dynamic = "force-dynamic";

export default async function NewReportPage({ searchParams }: { searchParams: Promise<{ preset?: string; copy?: string }> }) {
  const { actor } = await getWorkspaceContext();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)) redirect("/reports");
  const query = await searchParams;
  if (query.copy) {
    if (!z.uuid().safeParse(query.copy).success) notFound();
    const template = await getReportTemplate(actor.companyId, query.copy);
    if (!template) notFound();
    return (
      <WorkspaceScreen pathname="/reports/new" search={query}>
        <ReportEditor key={`copy-${template.id}`} initial={{ name: `${template.name.slice(0, 112)} (cópia)`, description: template.description, definition: template.definition, active: true }} />
      </WorkspaceScreen>
    );
  }
  const preset = query.preset ?? "blank";
  if (!reportPresets.some((item) => item.id === preset)) notFound();
  return (
    <WorkspaceScreen pathname="/reports/new" search={query}>
      <ReportEditor key={`preset-${preset}`} initial={createReportPreset(preset)} />
    </WorkspaceScreen>
  );
}
