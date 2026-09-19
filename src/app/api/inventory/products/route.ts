import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";
import { listInventoryProducts } from "@/modules/inventory/server/queries";
import { productSchema } from "@/modules/inventory/server/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = authorize(await currentActor(), Object.values(Role));
    return NextResponse.json({ products: await listInventoryProducts(actor.companyId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const input = productSchema.parse(await request.json());
    return await idempotentMutation(request, actor, "inventory.product.create", input, async (transaction) => {
      const existing = await transaction.inventoryProduct.findFirst({ where: { companyId: actor.companyId, sku: input.sku }, select: { id: true } });
      if (existing) throw new HttpError(409, "Product SKU already exists");
      const product = await transaction.inventoryProduct.create({ data: { companyId: actor.companyId, ...input } });
      return { productId: product.id };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
