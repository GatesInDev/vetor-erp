import { z } from "zod";
import { reportSources } from "./sources";
import { manualTableFits } from "./table-layout";
import { MAX_REPORT_IMAGE_BYTES, MAX_REPORT_IMAGES_BYTES, reportImageBytes, validateReportImage } from "./images";
import { textBindings } from "./text-template";

export const reportSourceSchema = z.enum(["manual", "projects", "partners", "inventory", "stockMovements", "invoices", "payables", "receivables"]);
export const elementTypeSchema = z.enum(["text", "field", "line", "box", "blank", "signature", "table", "manualTable", "image"]);
export const reportInputSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/).refine((id) => !["constructor", "prototype", "__proto__"].includes(id)),
  label: z.string().trim().min(1).max(80),
  type: z.enum(["text", "number", "date"]),
}).strict();
export const reportElementSchema = z.object({
  id: z.uuid(),
  type: elementTypeSchema,
  x: z.number().finite().min(0).max(300),
  y: z.number().finite().min(0).max(300),
  width: z.number().finite().min(2).max(300),
  height: z.number().finite().min(1).max(300),
  text: z.string().max(2000),
  imageData: z.string().max(Math.ceil(MAX_REPORT_IMAGE_BYTES / 3) * 4 + 23).optional(),
  binding: z.string().max(90),
  fontSize: z.number().int().min(8).max(36),
  bold: z.boolean(),
  align: z.enum(["left", "center", "right"]),
  border: z.boolean(),
  lineCount: z.number().int().min(1).max(15),
  columns: z.array(z.object({ key: z.string().max(60), label: z.string().trim().min(1).max(80), width: z.number().finite().min(1).max(20) }).strict()).max(8),
}).strict().superRefine((element, context) => {
  if (element.type === "image" && (!element.imageData || !validateReportImage(element.imageData))) context.addIssue({ code: "custom", message: "Image requires a valid PNG or JPEG of at most 512 KiB", path: ["imageData"] });
  if (element.type !== "image" && element.imageData !== undefined) context.addIssue({ code: "custom", message: "Image data is only allowed on image elements", path: ["imageData"] });
});

export function pageDimensions(page: { size: "A4" | "LETTER"; orientation: "portrait" | "landscape" }) {
  const [width, height] = page.size === "A4" ? [210, 297] : [215.9, 279.4];
  return page.orientation === "portrait" ? { width, height } : { width: height, height: width };
}

export const reportDefinitionSchema = z.object({
  version: z.literal(1),
  source: reportSourceSchema,
  page: z.object({ size: z.enum(["A4", "LETTER"]), orientation: z.enum(["portrait", "landscape"]), margin: z.number().int().min(5).max(30) }).strict(),
  inputs: z.array(reportInputSchema).max(30),
  elements: z.array(reportElementSchema).min(1).max(80),
}).strict().superRefine((definition, context) => {
  const { width, height } = pageDimensions(definition.page);
  const fields = reportSources.find((source) => source.id === definition.source)?.fields ?? [];
  const bindings = new Set(["company.name", "system.date", "system.page", "system.pages", ...fields.map((field) => `row.${field.key}`), ...definition.inputs.map((input) => `input.${input.id}`)]);
  if (new Set(definition.elements.map((element) => element.id)).size !== definition.elements.length) context.addIssue({ code: "custom", message: "Duplicate element identifiers", path: ["elements"] });
  if (new Set(definition.inputs.map((input) => input.id)).size !== definition.inputs.length) context.addIssue({ code: "custom", message: "Duplicate input identifiers", path: ["inputs"] });
  if (definition.elements.filter((element) => element.type === "table").length > 1) context.addIssue({ code: "custom", message: "Only one repeating table is allowed", path: ["elements"] });
  if (definition.elements.reduce((bytes, element) => bytes + (element.imageData ? reportImageBytes(element.imageData) : 0), 0) > MAX_REPORT_IMAGES_BYTES) context.addIssue({ code: "custom", message: "Report images must total at most 1 MiB", path: ["elements"] });
  definition.elements.forEach((element, index) => {
    const margin = definition.page.margin;
    if (element.x < margin || element.y < margin || element.x + element.width > width - margin + 0.01 || element.y + element.height > height - margin + 0.01) context.addIssue({ code: "custom", message: "Element is outside printable bounds", path: ["elements", index] });
    if (element.type === "field" && !bindings.has(element.binding)) context.addIssue({ code: "custom", message: "Unknown field binding", path: ["elements", index, "binding"] });
    if ((element.type === "text" || element.type === "signature") && textBindings(element.text).some((binding) => !bindings.has(binding))) context.addIssue({ code: "custom", message: "Unknown inline field binding", path: ["elements", index, "text"] });
    if (element.type === "table" && (!element.columns.length || element.columns.some((column) => !fields.some((field) => field.key === column.key)))) context.addIssue({ code: "custom", message: "Invalid table columns for this source", path: ["elements", index, "columns"] });
    if (element.type === "table" && (element.height < 25 || element.fontSize > 16)) context.addIssue({ code: "custom", message: "Table requires at least 25 mm height and at most 16 pt font", path: ["elements", index] });
    if (element.type === "manualTable" && !manualTableFits(element)) context.addIssue({ code: "custom", message: "Manual table requires columns at least 12 mm wide, rows at least 8 mm high, and at most 16 pt font", path: ["elements", index] });
  });
});

export const reportTemplateInputSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).default(""), definition: reportDefinitionSchema, active: z.boolean().default(true) }).strict();
export type ReportDefinition = z.infer<typeof reportDefinitionSchema>;
export type ReportElement = z.infer<typeof reportElementSchema>;
export type ReportInput = z.infer<typeof reportInputSchema>;
export type ReportTemplateInput = z.infer<typeof reportTemplateInputSchema>;
export type ReportTemplate = ReportTemplateInput & { id: string; revision: number; createdAt: string; updatedAt: string };
