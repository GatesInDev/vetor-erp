import type { ReportDefinition, ReportElement } from "./schema";
import { manualTableFits, manualTableLayout, manualTableMinimumWidth, tableRow, type PrintedRow } from "./table-layout";
import { replaceTextBindings } from "./text-template";

export { wrapCell, type PrintedRow } from "./table-layout";

export type ReportValues = { company: { name: string }; generatedAt: string; rows: Record<string, string>[]; truncated: boolean };
export type PrintedPage = { record: Record<string, string>; rows: PrintedRow[]; headers: PrintedRow | null };

export function paginateReport(definition: ReportDefinition, data: ReportValues): PrintedPage[] {
  if (definition.elements.some((element) => element.type === "manualTable" && !manualTableFits(element))) throw new Error("A tabela para preenchimento precisa de colunas com pelo menos 12 mm e linhas com pelo menos 8 mm. Amplie a tabela, reduza as linhas ou ajuste os títulos.");
  const table = definition.elements.find((element) => element.type === "table");
  if (!table) {
    if (data.rows.length > 100) throw new Error("O documento excede 100 páginas. Restrinja os filtros para imprimir.");
    return (data.rows.length ? data.rows : [{}]).map((record) => ({ record, rows: [], headers: null }));
  }
  const headers = tableRow(table, table.columns.map((column) => column.label));
  if (headers.height + 8 > table.height) throw new Error("Aumente a altura da tabela ou reduza o tamanho dos títulos.");
  const pages: PrintedPage[] = [];
  let page: PrintedPage = { record: data.rows[0] ?? {}, rows: [], headers };
  let used = headers.height;
  for (const record of data.rows) {
    const row = tableRow(table, table.columns.map((column) => record[column.key] ?? ""));
    if (row.height + headers.height > table.height) throw new Error("Uma linha não cabe na tabela. Aumente a área da tabela ou reduza a fonte.");
    if (used + row.height > table.height) {
      pages.push(page);
      page = { record, rows: [], headers };
      used = headers.height;
    }
    page.rows.push(row);
    used += row.height;
  }
  pages.push(page);
  if (pages.length > 100) throw new Error("O relatório excede 100 páginas. Restrinja os filtros para imprimir.");
  return pages;
}

export function resolveField(binding: string, data: ReportValues, record: Record<string, string>, inputs: Record<string, string>, page: number, total: number): string {
  if (binding === "company.name") return data.company.name;
  if (binding === "system.date") return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(data.generatedAt));
  if (binding === "system.page") return String(page);
  if (binding === "system.pages") return String(total);
  if (binding.startsWith("row.")) return Object.hasOwn(record, binding.slice(4)) ? record[binding.slice(4)] : "";
  if (binding.startsWith("input.")) return Object.hasOwn(inputs, binding.slice(6)) ? inputs[binding.slice(6)] : "";
  return "";
}

export function resolveText(text: string, data: ReportValues, record: Record<string, string>, inputs: Record<string, string>, page: number, total: number): string {
  return replaceTextBindings(text, (binding) => resolveField(binding, data, record, inputs, page, total));
}

export function fitElement(element: ReportElement, width: number, height: number, margin: number): ReportElement {
  const minimumWidth = element.type === "manualTable" ? manualTableMinimumWidth(element) : 2;
  const nextWidth = Math.min(Math.max(minimumWidth, element.width), width - margin * 2);
  const minimumHeight = element.type === "manualTable" ? manualTableLayout({ ...element, width: nextWidth }).minimumHeight : element.type === "table" ? 25 : 1;
  const nextHeight = Math.min(Math.max(minimumHeight, element.height), height - margin * 2);
  return { ...element, width: nextWidth, height: nextHeight, x: Math.max(margin, Math.min(element.x, width - margin - nextWidth)), y: Math.max(margin, Math.min(element.y, height - margin - nextHeight)) };
}
