import { db } from "@/lib/db";

export async function listInventoryProducts(companyId: string) {
  const products = await db.inventoryProduct.findMany({
    where: { companyId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, sku: true, name: true, unit: true, minimumQuantity: true, quantity: true, active: true },
  });
  return products.map((product) => ({
    ...product,
    minimumQuantity: product.minimumQuantity.toFixed(3),
    quantity: product.quantity.toFixed(3),
  }));
}

export async function listStockMovements(companyId: string) {
  const movements = await db.stockMovement.findMany({
    where: { companyId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true, type: true, quantity: true, reason: true, createdAt: true,
      product: { select: { id: true, sku: true, name: true, unit: true } },
      project: { select: { id: true, code: true, name: true } },
    },
  });
  return movements.map((movement) => ({
    ...movement,
    quantity: movement.quantity.toFixed(3),
    createdAt: movement.createdAt.toISOString(),
  }));
}
