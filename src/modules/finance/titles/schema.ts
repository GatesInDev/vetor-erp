import { z } from "zod";

export const financialTitleKinds = ["BOLETO", "DUPLICATE", "PROMISSORY_NOTE", "OTHER"] as const;
export const financialTitleStatuses = ["OPEN", "PARTIAL", "SETTLED", "CANCELLED"] as const;
export const titleAccountTypes = ["PAYABLE", "RECEIVABLE"] as const;

function digitMetadata(lengths: number[]) {
  return z.string().trim().max(160).regex(/^[\d\s.\-]*$/, "Only digits and formatting separators are allowed")
    .transform((value) => value.replace(/[\s.\-]/g, ""))
    .refine((value) => value.length === 0 || lengths.includes(value.length), "Invalid digit count").default("");
}

export const financialTitleInputSchema = z.object({
  accountType: z.enum(titleAccountTypes),
  accountId: z.uuid(),
  kind: z.enum(financialTitleKinds),
  number: z.string().trim().min(1).max(80),
  bankName: z.string().trim().max(120).default(""),
  digitLine: digitMetadata([47, 48]),
  barcode: digitMetadata([44]),
  notes: z.string().trim().max(2000).default(""),
}).strict();

export const financialTitleUpdateSchema = financialTitleInputSchema.extend({ revision: z.number().int().positive().max(2147483646) });

export const financialTitleFiltersSchema = z.object({
  accountType: z.enum(titleAccountTypes).optional(),
  kind: z.enum(financialTitleKinds).optional(),
  status: z.enum(financialTitleStatuses).optional(),
  search: z.string().trim().max(120).optional(),
}).strict();

export type FinancialTitleInput = z.infer<typeof financialTitleInputSchema>;
export type FinancialTitleUpdate = z.infer<typeof financialTitleUpdateSchema>;
export type FinancialTitleFilters = z.infer<typeof financialTitleFiltersSchema>;
