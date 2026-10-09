import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { ProductForm } from "@/modules/inventory/components/product-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export const dynamic = "force-dynamic";

export default async function ProductFormPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { actor } = await getWorkspaceContext();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)) redirect("/inventory");
  const { recordId } = await params;
  if (recordId === "new") {
    return (
      <WorkspaceScreen pathname={`/inventory/products/${recordId}`}>
        <ProductForm key="new-product" product={null} />
      </WorkspaceScreen>
    );
  }
  if (!z.uuid().safeParse(recordId).success) notFound();
  const product = await db.inventoryProduct.findFirst({
    where: { id: recordId, companyId: actor.companyId },
    select: { id: true, sku: true, name: true, unit: true, minimumQuantity: true, quantity: true, active: true },
  });
  if (!product) notFound();
  return (
    <WorkspaceScreen pathname={`/inventory/products/${recordId}`}>
      <ProductForm key={product.id} product={{ ...product, minimumQuantity: product.minimumQuantity.toFixed(3), quantity: product.quantity.toFixed(3) }} />
    </WorkspaceScreen>
  );
}
