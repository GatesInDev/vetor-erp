import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentActor } from "@/lib/auth";
import { getPayable } from "@/modules/finance/data";
import { SettlementForm } from "@/modules/finance/settlement-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function PayPayablePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "FINANCE"].includes(actor.role)) redirect("/finance");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const payable = await getPayable(actor.companyId, id);
  if (!payable) notFound();
  if (payable.status !== "OPEN") redirect("/finance?tab=payables");
  return (
    <WorkspaceScreen pathname={`/finance/payables/${id}/pay`}>
      <SettlementForm key={id} settlement={{ type: "payment", payable }} transactions={[]} />
    </WorkspaceScreen>
  );
}
