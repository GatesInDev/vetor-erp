import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { getDashboardData } from "@/modules/dashboard/server/queries";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function DashboardPage() {
  const { actor } = await getWorkspaceContext();
  return (
    <WorkspaceScreen pathname="/dashboard">
      <DashboardView data={await getDashboardData(actor.companyId)} role={actor.role} />
    </WorkspaceScreen>
  );
}
