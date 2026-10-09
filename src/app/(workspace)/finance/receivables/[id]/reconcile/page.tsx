import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentActor } from "@/lib/auth";
import { getBankTransactions, getReceivable } from "@/modules/finance/data";
import { SettlementForm } from "@/modules/finance/settlement-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function ReconcileReceivablePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "FINANCE"].includes(actor.role)) redirect("/finance");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const receivable = await getReceivable(actor.companyId, id);
  if (!receivable) notFound();
  if (Number(receivable.remaining) <= 0) redirect("/finance?tab=receivables");
  return (
    <WorkspaceScreen pathname={`/finance/receivables/${id}/reconcile`}>
      <SettlementForm key={id} settlement={{ type: "receipt", receivable }} transactions={await getBankTransactions(actor.companyId)} />
    </WorkspaceScreen>
  );
}
