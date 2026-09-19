import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { Actor, HttpError } from "@/lib/auth";
import { recordStockMovement } from "@/modules/inventory/server/movements";
import { stockMovementSchema } from "@/modules/inventory/server/validation";

const actor: Actor = { userId: "user-a", companyId: "company-a", role: "ADMIN", sessionId: "session-a" };
const input = { productId: "product-a", projectId: "project-a", type: "EXIT" as const, quantity: "1.250", reason: "Material used on site" };

test("stock exit atomically checks available quantity and stores the actor company", async () => {
  let filter: Prisma.InventoryProductUpdateManyArgs | undefined;
  let movement: Prisma.StockMovementCreateArgs | undefined;
  const transaction = {
    inventoryProduct: {
      findFirst: async (args: Prisma.InventoryProductFindFirstArgs) => {
        assert.equal(args.where?.companyId, actor.companyId);
        return { id: input.productId };
      },
      updateMany: async (args: Prisma.InventoryProductUpdateManyArgs) => { filter = args; return { count: 1 }; },
      findFirstOrThrow: async () => ({ quantity: new Prisma.Decimal("3.750") }),
    },
    project: { findFirst: async (args: Prisma.ProjectFindFirstArgs) => {
      assert.equal(args.where?.companyId, actor.companyId);
      return { id: input.projectId };
    } },
    stockMovement: { create: async (args: Prisma.StockMovementCreateArgs) => { movement = args; return { id: "movement-a" }; } },
  } as unknown as Prisma.TransactionClient;

  const result = await recordStockMovement(transaction, actor, input);

  assert.equal(filter?.where?.companyId, actor.companyId);
  assert.deepEqual(filter?.where?.quantity, { gte: new Prisma.Decimal("1.250") });
  assert.deepEqual(filter?.data.quantity, { decrement: new Prisma.Decimal("1.250") });
  assert.equal(movement?.data.companyId, actor.companyId);
  assert.equal(movement?.data.createdById, actor.userId);
  assert.deepEqual(result, { movementId: "movement-a", quantity: "3.750" });
});

test("insufficient stock stops the operation before recording a movement", async () => {
  let recorded = false;
  const transaction = {
    inventoryProduct: {
      findFirst: async () => ({ id: input.productId }),
      updateMany: async () => ({ count: 0 }),
    },
    project: { findFirst: async () => ({ id: input.projectId }) },
    stockMovement: { create: async () => { recorded = true; } },
  } as unknown as Prisma.TransactionClient;

  await assert.rejects(recordStockMovement(transaction, actor, input), (error: unknown) => error instanceof HttpError && error.status === 409);
  assert.equal(recorded, false);
});

test("a product outside the actor company cannot be moved", async () => {
  const transaction = {
    inventoryProduct: { findFirst: async (args: Prisma.InventoryProductFindFirstArgs) => {
      assert.equal(args.where?.id, input.productId);
      assert.equal(args.where?.companyId, actor.companyId);
      return null;
    } },
  } as unknown as Prisma.TransactionClient;

  await assert.rejects(recordStockMovement(transaction, actor, input), (error: unknown) => error instanceof HttpError && error.status === 404);
});

test("a project outside the actor company is rejected before updating stock", async () => {
  const transaction = {
    inventoryProduct: { findFirst: async () => ({ id: input.productId }) },
    project: { findFirst: async (args: Prisma.ProjectFindFirstArgs) => {
      assert.equal(args.where?.companyId, actor.companyId);
      return null;
    } },
  } as unknown as Prisma.TransactionClient;

  await assert.rejects(recordStockMovement(transaction, actor, input), (error: unknown) => error instanceof HttpError && error.status === 422);
});

test("movement validation rejects zero, negative and overprecision quantities and exits without a project", () => {
  const validInput = {
    productId: "f7a1f9d0-e7c2-4229-91f0-c52803f870b9",
    type: "ENTRY",
    quantity: "0.001",
    reason: "Purchase received",
  };
  assert.equal(stockMovementSchema.safeParse(validInput).success, true);
  for (const quantity of ["0", "0.000", "-1", "1.0001", "1e3", "1000000000000000"]) {
    assert.equal(stockMovementSchema.safeParse({ ...validInput, quantity }).success, false);
  }
  assert.equal(stockMovementSchema.safeParse({ ...validInput, type: "EXIT" }).success, false);
});
