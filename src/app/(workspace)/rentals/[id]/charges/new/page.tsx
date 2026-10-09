import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentActor } from "@/lib/auth";
import { getEquipmentRental } from "@/modules/rentals/server";
import { RentalChargeForm } from "@/modules/rentals/components/rental-charge-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function NewRentalChargePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE"].includes(actor.role)) redirect(`/rentals/${id}?tab=documents`);
  const rental = await getEquipmentRental(actor.companyId, id);
  if (!rental) notFound();
  return <WorkspaceScreen pathname={`/rentals/${id}/charges/new`}><RentalChargeForm rental={rental} /></WorkspaceScreen>;
}
