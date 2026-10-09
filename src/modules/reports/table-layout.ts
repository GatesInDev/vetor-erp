import type { ReportElement } from "./schema";

export type PrintedRow = { cells: string[][]; height: number };

export function wrapCell(value: string, capacity: number): string[] {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Cell capacity must be a positive integer");
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let remaining = paragraph;
    while (remaining.length > capacity) {
      const lastSpace = remaining.lastIndexOf(" ", capacity);
      const end = lastSpace > capacity / 2 ? lastSpace : capacity;
      lines.push(remaining.slice(0, end));
      remaining = remaining.slice(end).trimStart();
    }
    lines.push(remaining);
  }
  return lines;
}

export function tableRow(element: ReportElement, values: string[]): PrintedRow {
  const weight = element.columns.reduce((sum, column) => sum + column.width, 0);
  const cells = values.map((value, index) => {
    const cellWidth = element.width * element.columns[index].width / weight - 4;
    const capacity = Math.max(1, Math.floor(cellWidth / (element.fontSize * 25.4 / 72 * 0.64)));
    return wrapCell(value, capacity);
  });
  return { cells, height: Math.max(...cells.map((cell) => cell.length), 1) * element.fontSize * 25.4 / 72 * 1.35 + 4 };
}

export function manualTableMinimumWidth(element: ReportElement): number {
  const weight = element.columns.reduce((sum, column) => sum + column.width, 0);
  return Math.max(2, ...element.columns.map((column) => 12 * weight / column.width));
}

export function manualTableLayout(element: ReportElement) {
  const headers = tableRow(element, element.columns.map((column) => column.label));
  headers.height += 0.5;
  const minimumHeight = headers.height + element.lineCount * 8;
  return { headers, minimumHeight, rowHeight: Math.max(8, (element.height - headers.height) / element.lineCount) };
}

export function manualTableFits(element: ReportElement): boolean {
  return element.columns.length > 0 && element.columns.length <= 8 && element.lineCount >= 1 && element.lineCount <= 15
    && element.fontSize <= 16 && element.width + 0.01 >= manualTableMinimumWidth(element)
    && element.height + 0.01 >= manualTableLayout(element).minimumHeight;
}
