import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { productSchema } from "@/modules/inventory/server/validation";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const id = z.uuid().parse((await context.params).id);
    const input = productSchema.parse(await request.json());
    return await idempotentMutation(request, actor, "inventory.product.update", { id, ...input }, async (transaction) => {
      const product = await transaction.inventoryProduct.findFirst({ where: { id, companyId: actor.companyId }, select: { id: true, unit: true } });
      if (!product) throw new HttpError(404, "Product not found");
      if (input.unit !== product.unit) {
        const movement = await transaction.stockMovement.findFirst({ where: { productId: id, companyId: actor.companyId }, select: { id: true } });
        if (movement) throw new HttpError(409, "Product unit cannot change after stock movements have been recorded");
      }
      const duplicate = await transaction.inventoryProduct.findFirst({ where: { companyId: actor.companyId, sku: input.sku, id: { not: id } }, select: { id: true } });
      if (duplicate) throw new HttpError(409, "Product SKU already exists");
      await transaction.inventoryProduct.update({ where: { id, companyId: actor.companyId }, data: input });
      return { productId: id };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
