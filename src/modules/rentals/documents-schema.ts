import { z } from "zod";

export const rentalFileLimit = 2 * 1024 * 1024;
export const rentalFileInputSchema = z.object({
  fileName: z.string().trim().min(1).max(180).regex(/^[^\\/\u0000-\u001f\u007f]+$/),
  mediaType: z.enum(["application/pdf", "application/xml"]),
  contentBase64: z.string().min(4).max(Math.ceil(rentalFileLimit / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/).refine((value) => value.length % 4 === 0, "Invalid file encoding"),
}).strict();

export const rentalFilesSchema = z.array(rentalFileInputSchema).max(3).refine((files) => files.reduce((total, file) => total + file.contentBase64.length * 3 / 4 - (file.contentBase64.endsWith("==") ? 2 : file.contentBase64.endsWith("=") ? 1 : 0), 0) <= rentalFileLimit, "Files must total at most 2 MiB.");
export type RentalFileInput = z.infer<typeof rentalFileInputSchema>;
export type RentalDocumentPreview = {
  fields: { documentKind?: "NFSE" | "INVOICE"; documentNumber?: string; issuedAt?: string; amount?: string };
  warnings: string[];
};
