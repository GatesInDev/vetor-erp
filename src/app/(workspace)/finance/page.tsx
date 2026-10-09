import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { getFinanceData } from "@/modules/finance/data";
import { FinanceWorkspace } from "@/modules/finance/finance-workspace";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ tab?: string; recordId?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const query = await searchParams;
  const { tab } = query;
  const initialTab = tab === "receivables" || tab === "reconciliation" || tab === "titles" ? tab : "payables";
  return (
    <WorkspaceScreen pathname="/finance" search={query}>
      <FinanceWorkspace initialTab={initialTab} recordId={query.recordId} role={actor.role} data={await getFinanceData(actor.companyId)} />
    </WorkspaceScreen>
  );
}
