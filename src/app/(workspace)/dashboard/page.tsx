import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { getDashboardData } from "@/modules/dashboard/server/queries";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";

export default async function DashboardPage() {
  const { actor } = await getWorkspaceContext();
  return <DashboardView data={await getDashboardData(actor.companyId)} role={actor.role} />;
}
