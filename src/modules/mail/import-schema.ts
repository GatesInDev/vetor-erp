import { z } from "zod";
import { rentalChargeInputSchema } from "@/modules/rentals/schema";

export const mailAttachmentSelectionSchema = z.object({
  attachmentIds: z.array(z.uuid()).min(1).max(3).refine((ids) => new Set(ids).size === ids.length, "Select distinct attachments"),
}).strict();

export const mailChargeImportSchema = mailAttachmentSelectionSchema.extend({
  rentalId: z.uuid(),
  charge: rentalChargeInputSchema.refine((charge) => charge.files === undefined, "Select stored email attachments instead of uploading files"),
}).strict();

export type MailChargeImportInput = z.infer<typeof mailChargeImportSchema>;
