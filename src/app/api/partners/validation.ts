import { z } from "zod";

export const partnerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  customer: z.boolean(),
  supplier: z.boolean(),
  taxId: z.string().trim().max(30).regex(/^[\d.\-/\s]*$/).transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 0 || value.length === 11 || value.length === 14, "Tax ID must contain 11 or 14 digits").optional(),
}).strict().refine((input) => input.customer || input.supplier, { message: "Partner must be a customer or supplier" });
