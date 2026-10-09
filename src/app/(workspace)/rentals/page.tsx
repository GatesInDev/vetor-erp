import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { getEquipmentRentals } from "@/modules/rentals/server";
import { RentalWorkspace } from "@/modules/rentals/components/rental-workspace";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function RentalsPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return <WorkspaceScreen pathname="/rentals"><RentalWorkspace rentals={await getEquipmentRentals(actor.companyId)} role={actor.role} /></WorkspaceScreen>;
}
