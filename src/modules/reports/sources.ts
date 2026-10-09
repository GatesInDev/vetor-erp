import { z } from "zod";

export const reportSourceIds = ["manual", "projects", "partners", "inventory", "stockMovements", "invoices", "payables", "receivables"] as const;

export type ReportSourceId = typeof reportSourceIds[number];
export type ReportSource = {
  id: ReportSourceId;
  label: string;
  fields: { key: string; label: string }[];
  financial: boolean;
  dated: boolean;
  projectScoped: boolean;
};

export const reportSources: ReportSource[] = [
  { id: "manual", label: "Documento livre", financial: false, dated: false, projectScoped: false, fields: [] },
  { id: "projects", label: "Obras", financial: false, dated: false, projectScoped: false, fields: [
    { key: "code", label: "Código" }, { key: "name", label: "Obra" }, { key: "active", label: "Situação" },
  ] },
  { id: "partners", label: "Clientes e fornecedores", financial: false, dated: false, projectScoped: false, fields: [
    { key: "name", label: "Nome" }, { key: "customer", label: "Cliente" }, { key: "supplier", label: "Fornecedor" },
  ] },
  { id: "inventory", label: "Produtos em estoque", financial: false, dated: false, projectScoped: false, fields: [
    { key: "sku", label: "Código" }, { key: "name", label: "Produto" }, { key: "unit", label: "Unidade" }, { key: "quantity", label: "Saldo" }, { key: "minimumQuantity", label: "Estoque mínimo" }, { key: "active", label: "Situação" },
  ] },
  { id: "stockMovements", label: "Movimentações de estoque", financial: false, dated: true, projectScoped: true, fields: [
    { key: "sku", label: "Código do produto" }, { key: "product", label: "Produto" }, { key: "unit", label: "Unidade" }, { key: "project", label: "Obra" }, { key: "type", label: "Movimentação" }, { key: "quantity", label: "Quantidade" }, { key: "reason", label: "Motivo" }, { key: "createdAt", label: "Data da movimentação" },
  ] },
  { id: "invoices", label: "Serviços faturados", financial: true, dated: true, projectScoped: true, fields: [
    { key: "number", label: "Número" }, { key: "customer", label: "Cliente" }, { key: "project", label: "Obra" }, { key: "serviceDate", label: "Data do serviço" }, { key: "amount", label: "Valor bruto" }, { key: "net", label: "Valor líquido" }, { key: "status", label: "Situação" },
  ] },
  { id: "payables", label: "Contas a pagar", financial: true, dated: true, projectScoped: true, fields: [
    { key: "contractor", label: "Fornecedor" }, { key: "originType", label: "Tipo de origem" }, { key: "originNumber", label: "Número da origem" }, { key: "documentNumber", label: "Documento recebido" }, { key: "project", label: "Obra" }, { key: "amount", label: "Valor" }, { key: "dueAt", label: "Vencimento" }, { key: "status", label: "Situação" }, { key: "contractNumber", label: "Contrato" }, { key: "rentalNumber", label: "Número da locação" }, { key: "equipmentName", label: "Equipamento locado" },
  ] },
  { id: "receivables", label: "Contas a receber", financial: true, dated: true, projectScoped: true, fields: [
    { key: "customer", label: "Cliente" }, { key: "invoiceNumber", label: "Serviço" }, { key: "project", label: "Obra" }, { key: "amount", label: "Valor" }, { key: "received", label: "Valor recebido" }, { key: "remaining", label: "Saldo a receber" }, { key: "dueAt", label: "Vencimento" },
  ] },
];

const reportDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");

export const reportDataFilterSchema = z.object({
  source: z.enum(reportSourceIds),
  from: reportDateSchema.optional(),
  to: reportDateSchema.optional(),
  projectId: z.uuid().optional(),
  recordId: z.uuid().optional(),
}).strict().superRefine((value, context) => {
  const source = reportSources.find((item) => item.id === value.source)!;
  if (value.from && value.to && value.from > value.to) context.addIssue({ code: "custom", path: ["to"], message: "End date must not precede start date" });
  if (!source.dated && (value.from || value.to)) context.addIssue({ code: "custom", path: ["from"], message: "This source does not support date filters" });
  if (!source.projectScoped && value.projectId) context.addIssue({ code: "custom", path: ["projectId"], message: "This source does not support project filters" });
  if (source.id === "manual" && value.recordId) context.addIssue({ code: "custom", path: ["recordId"], message: "Manual documents do not have records" });
});

export type ReportDataFilters = z.infer<typeof reportDataFilterSchema>;
export type ReportData = {
  company: { name: string };
  generatedAt: string;
  rows: Record<string, string>[];
  truncated: boolean;
};
