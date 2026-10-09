import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { getDocumentOptions } from "@/modules/billing/data";
import { DocumentForm } from "@/modules/billing/document-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function NewContractPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)) redirect("/billing");
  const options = await getDocumentOptions(actor.companyId, "contract");
  return (
    <WorkspaceScreen pathname="/billing/contracts/new">
      <DocumentForm kind="contract" {...options} />
    </WorkspaceScreen>
  );
}
