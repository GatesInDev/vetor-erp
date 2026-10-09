import { ReportCatalog } from "@/modules/reports/components/report-catalog";
import { listReportTemplates } from "@/modules/reports/server/templates";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { actor } = await getWorkspaceContext();
  const templates = await listReportTemplates(actor.companyId);
  return (
    <WorkspaceScreen pathname="/reports">
      <ReportCatalog templates={templates} canWrite={["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)} canReadAccounting={["ADMIN", "ACCOUNTANT", "FINANCE", "VIEWER"].includes(actor.role)} />
    </WorkspaceScreen>
  );
}
