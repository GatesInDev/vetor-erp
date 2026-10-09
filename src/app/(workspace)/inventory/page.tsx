import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { InventoryWorkspace } from "@/modules/inventory/components/inventory-workspace";
import { listInventoryProducts, listStockMovements } from "@/modules/inventory/server/queries";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const query = await searchParams;
  const [products, movements] = await Promise.all([
    listInventoryProducts(actor.companyId),
    listStockMovements(actor.companyId),
  ]);
  return (
    <WorkspaceScreen pathname="/inventory" search={query}>
      <InventoryWorkspace products={products} movements={movements} initialTab={query.tab === "movements" ? "movements" : "products"} canWrite={["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)} />
    </WorkspaceScreen>
  );
}
