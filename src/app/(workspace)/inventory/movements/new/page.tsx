import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { listInventoryProducts } from "@/modules/inventory/server/queries";
import { MovementForm } from "@/modules/inventory/components/movement-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export const dynamic = "force-dynamic";

export default async function MovementFormPage({ searchParams }: { searchParams: Promise<{ productId?: string }> }) {
  const { actor } = await getWorkspaceContext();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)) redirect("/inventory");
  const [query, products, projects] = await Promise.all([
    searchParams,
    listInventoryProducts(actor.companyId),
    db.project.findMany({
      where: { companyId: actor.companyId, active: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);
  const activeProducts = products.filter((product) => product.active);
  if (query.productId && !activeProducts.some((product) => product.id === query.productId)) notFound();
  return (
    <WorkspaceScreen pathname="/inventory/movements/new" search={query}>
      <MovementForm key={query.productId ?? "new-movement"} products={activeProducts} projects={projects} initialProductId={query.productId ?? ""} />
    </WorkspaceScreen>
  );
}
