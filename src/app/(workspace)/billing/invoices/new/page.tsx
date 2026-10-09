import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { getDocumentOptions } from "@/modules/billing/data";
import { DocumentForm } from "@/modules/billing/document-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function NewInvoicePage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "FINANCE"].includes(actor.role)) redirect("/billing");
  const options = await getDocumentOptions(actor.companyId, "invoice");
  return (
    <WorkspaceScreen pathname="/billing/invoices/new">
      <DocumentForm kind="invoice" {...options} />
    </WorkspaceScreen>
  );
}
