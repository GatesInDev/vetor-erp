import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { getBillingData } from "@/modules/billing/data";
import { BillingWorkspace } from "@/modules/billing/billing-workspace";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ tab?: string; recordId?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const query = await searchParams;
  const { tab } = query;
  const initialTab = tab === "contracts" || tab === "measurements" ? tab : "invoices";
  return (
    <WorkspaceScreen pathname="/billing" search={query}>
      <BillingWorkspace initialTab={initialTab} recordId={query.recordId} role={actor.role} data={await getBillingData(actor.companyId)} />
    </WorkspaceScreen>
  );
}
