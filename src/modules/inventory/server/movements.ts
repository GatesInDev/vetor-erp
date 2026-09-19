import { Prisma } from "@prisma/client";
import { Actor, HttpError } from "@/lib/auth";
import { StockMovementInput } from "@/modules/inventory/server/validation";

export async function recordStockMovement(transaction: Prisma.TransactionClient, actor: Actor, input: StockMovementInput) {
  const product = await transaction.inventoryProduct.findFirst({
    where: { id: input.productId, companyId: actor.companyId, active: true },
    select: { id: true },
  });
  if (!product) throw new HttpError(404, "Active product not found");

  if (input.projectId) {
    const project = await transaction.project.findFirst({
      where: { id: input.projectId, companyId: actor.companyId, active: true },
      select: { id: true },
    });
    if (!project) throw new HttpError(422, "Active project not found");
  }

  const quantity = new Prisma.Decimal(input.quantity);
  const isExit = input.type === "EXIT";
  const changed = await transaction.inventoryProduct.updateMany({
    where: {
      id: product.id,
      companyId: actor.companyId,
      active: true,
      quantity: isExit ? { gte: quantity } : { lte: new Prisma.Decimal("999999999999999.999").minus(quantity) },
    },
    data: { quantity: isExit ? { decrement: quantity } : { increment: quantity } },
  });
  if (changed.count !== 1) throw new HttpError(409, isExit ? "Insufficient stock" : "Stock quantity limit exceeded");

  const movement = await transaction.stockMovement.create({
    data: {
      companyId: actor.companyId,
      productId: product.id,
      projectId: input.projectId,
      type: input.type,
      quantity,
      reason: input.reason,
      createdById: actor.userId,
    },
  });
  const updated = await transaction.inventoryProduct.findFirstOrThrow({
    where: { id: product.id, companyId: actor.companyId },
    select: { quantity: true },
  });
  return { movementId: movement.id, quantity: updated.quantity.toFixed(3) };
}
