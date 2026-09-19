import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { InventoryWorkspace } from "@/modules/inventory/components/inventory-workspace";
import { listInventoryProducts, listStockMovements } from "@/modules/inventory/server/queries";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const [products, movements, projects] = await Promise.all([
    listInventoryProducts(actor.companyId),
    listStockMovements(actor.companyId),
    db.project.findMany({
      where: { companyId: actor.companyId, active: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);
  return <InventoryWorkspace products={products} movements={movements} projects={projects} canWrite={["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)} />;
}
