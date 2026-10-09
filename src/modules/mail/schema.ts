import { z } from "zod";
import { rentalDateSchema } from "@/modules/rentals/schema";

export const mailConnectionInputSchema = z.object({
  username: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().transform((value) => value.replace(/\s/g, "")).pipe(z.string().regex(/^[a-zA-Z0-9]{16}$/, "Use a 16-character Google app password")).optional(),
  folder: z.string().trim().min(1).max(200).regex(/^[^\u0000-\u001f\u007f]+$/).default("INBOX"),
  enabled: z.boolean(),
  autoSync: z.boolean(),
  importSince: rentalDateSchema,
  revision: z.number().int().positive().max(2147483646).optional(),
}).strict();

export const mailMessageFiltersSchema = z.object({
  cursor: z.uuid().optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["PENDING", "IMPORTED"]).optional(),
}).strict();

export type MailConnectionInput = z.infer<typeof mailConnectionInputSchema>;
export type MailMessageFilters = z.infer<typeof mailMessageFiltersSchema>;
