import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { getRentalOptions } from "@/modules/rentals/server";
import { RentalForm } from "@/modules/rentals/components/rental-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function NewRentalPage({ searchParams }: { searchParams: Promise<{ projectId?: string; supplierId?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)) redirect("/rentals");
  const [query, options] = await Promise.all([searchParams, getRentalOptions(actor.companyId)]);
  const initialProjectId = options.projects.find((project) => project.id === query.projectId)?.id ?? "";
  const initialSupplierId = options.suppliers.find((supplier) => supplier.id === query.supplierId)?.id ?? "";
  return <WorkspaceScreen pathname="/rentals/new" search={query}><RentalForm rental={null} options={options} role={actor.role} initialProjectId={initialProjectId} initialSupplierId={initialSupplierId} /></WorkspaceScreen>;
}
