import { z } from "zod";

export const quantitySchema = z.string().trim().regex(/^\d{1,15}(\.\d{1,3})?$/, "Quantity must have at most three decimal places");

export const productSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(20),
  minimumQuantity: quantitySchema.default("0"),
  active: z.boolean().default(true),
}).strict();

export const stockMovementSchema = z.object({
  productId: z.uuid(),
  type: z.enum(["ENTRY", "EXIT"]),
  quantity: quantitySchema.refine((value) => /[1-9]/.test(value), "Quantity must be greater than zero"),
  reason: z.string().trim().min(1).max(500),
  projectId: z.uuid().optional(),
}).strict().refine((input) => input.type !== "EXIT" || Boolean(input.projectId), {
  message: "Project is required for stock exits",
  path: ["projectId"],
});

export type StockMovementInput = z.infer<typeof stockMovementSchema>;
