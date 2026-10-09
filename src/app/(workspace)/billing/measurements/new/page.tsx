import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { getContractOptions } from "@/modules/billing/data";
import { MeasurementForm } from "@/modules/billing/measurement-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function NewMeasurementPage({ searchParams }: { searchParams: Promise<{ contractId?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "OPERATIONS"].includes(actor.role)) redirect("/billing?tab=measurements");
  const contracts = await getContractOptions(actor.companyId);
  const query = await searchParams;
  const { contractId } = query;
  const initialContractId = contracts.some((contract) => contract.id === contractId) ? contractId : undefined;
  return (
    <WorkspaceScreen pathname="/billing/measurements/new" search={query}>
      <MeasurementForm key={initialContractId ?? "new-measurement"} contracts={contracts} initialContractId={initialContractId} />
    </WorkspaceScreen>
  );
}
