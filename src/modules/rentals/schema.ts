import { z } from "zod";
import { rentalFilesSchema } from "./documents-schema";

export const rentalDocumentKinds = ["NFSE", "INVOICE", "RENTAL_RECEIPT", "OTHER"] as const;
export const rentalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return value >= "0001-01-01" && !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Invalid rental date");

const rentalFields = {
  projectId: z.uuid(), supplierId: z.uuid(), number: z.string().trim().min(1).max(80),
  equipmentName: z.string().trim().min(1).max(160), equipmentIdentifier: z.string().trim().max(120).default(""),
  quantity: z.number().int().min(1).max(9999), startsAt: rentalDateSchema,
  expectedReturnAt: rentalDateSchema.nullable().default(null), returnedAt: rentalDateSchema.nullable().default(null),
  notes: z.string().trim().max(2000).default(""),
};

function validateDates(value: { startsAt: string; expectedReturnAt: string | null; returnedAt: string | null }, context: z.RefinementCtx) {
  if (value.expectedReturnAt && value.expectedReturnAt < value.startsAt) context.addIssue({ code: "custom", path: ["expectedReturnAt"], message: "Expected return cannot precede rental start" });
  if (value.returnedAt && value.returnedAt < value.startsAt) context.addIssue({ code: "custom", path: ["returnedAt"], message: "Return cannot precede rental start" });
}

export const equipmentRentalInputSchema = z.object(rentalFields).strict().superRefine(validateDates);
export const equipmentRentalUpdateSchema = z.object({ ...rentalFields, revision: z.number().int().positive().max(2147483646) }).strict().superRefine(validateDates);

const documentUrlSchema = z.string().trim().max(2000).refine((value) => {
  if (!value) return true;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}, "Document URL must use HTTP or HTTPS without credentials").default("");

export const rentalChargeInputSchema = z.object({
  documentKind: z.enum(rentalDocumentKinds), documentNumber: z.string().trim().min(1).max(80),
  issuedAt: rentalDateSchema, dueAt: rentalDateSchema,
  amount: z.string().regex(/^\d{1,14}(\.\d{1,2})?$/).refine((value) => /[1-9]/.test(value), "Amount must be positive"),
  documentUrl: documentUrlSchema, notes: z.string().trim().max(2000).default(""), files: rentalFilesSchema.optional(),
}).strict().refine((value) => value.dueAt >= value.issuedAt, { path: ["dueAt"], message: "Due date cannot precede issue date" });

export const rentalFiltersSchema = z.object({ search: z.string().trim().max(120).optional(), projectId: z.uuid().optional(), supplierId: z.uuid().optional(), status: z.enum(["SCHEDULED", "ACTIVE", "RETURNED"]).optional() }).strict();
export type EquipmentRentalInput = z.infer<typeof equipmentRentalInputSchema>;
export type EquipmentRentalUpdate = z.infer<typeof equipmentRentalUpdateSchema>;
export type RentalChargeInput = z.infer<typeof rentalChargeInputSchema>;
export type RentalFilters = z.infer<typeof rentalFiltersSchema>;
