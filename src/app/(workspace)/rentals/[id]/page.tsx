import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentActor } from "@/lib/auth";
import { getEquipmentRental, getRentalOptions } from "@/modules/rentals/server";
import { RentalForm } from "@/modules/rentals/components/rental-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function RentalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const rental = await getEquipmentRental(actor.companyId, id);
  if (!rental) notFound();
  const canWrite = ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role);
  const options = canWrite ? await getRentalOptions(actor.companyId, id) : { projects: [rental.project], suppliers: [rental.supplier] };
  return <WorkspaceScreen pathname={`/rentals/${id}`} search={query}><RentalForm key={id} rental={rental} options={options} role={actor.role} initialTab={query.tab === "documents" ? "documents" : "details"} /></WorkspaceScreen>;
}
