"use client";

import { useLocale } from "@/modules/settings/components/preferences-provider";
import type { CSSProperties } from "react";
import Image from "next/image";
import { pageDimensions, type ReportDefinition, type ReportElement } from "../schema";
import { resolveField, type PrintedPage, type ReportValues } from "../layout";
import { manualTableLayout } from "../table-layout";

export function elementStyle(element: ReportElement): CSSProperties {
  return { left: `${element.x}mm`, top: `${element.y}mm`, width: `${element.width}mm`, height: `${element.height}mm`, fontSize: `${element.fontSize}pt`, fontWeight: element.bold ? 700 : 400, textAlign: element.align };
}

export function ReportElementContent({ element, value, table, editing = false }: { element: ReportElement; value?: string; table?: PrintedPage; editing?: boolean }) {
  const { t } = useLocale();
  if (element.type === "image") return element.imageData
    ? <Image className="report-image" src={element.imageData} alt={element.text || t("Imagem / logo")} width={Math.round(element.width * 96 / 25.4)} height={Math.round(element.height * 96 / 25.4)} unoptimized loading="eager" draggable={false} />
    : <div className="report-image-placeholder">{t("Envie uma imagem nas propriedades.")}</div>;
  if (element.type === "line") return <div className="report-rule" />;
  if (element.type === "box") return <div className="report-box" />;
  if (element.type === "blank") return <div className="report-blank">{Array.from({ length: element.lineCount }, (_, index) => <span key={index} />)}</div>;
  if (element.type === "signature") return <div className="report-signature"><span>{element.text}</span></div>;
  if (element.type === "manualTable") {
    const weight = element.columns.reduce((sum, column) => sum + column.width, 0);
    const { headers, rowHeight } = manualTableLayout(element);
    return <table className="report-data-table report-manual-table" style={{ height: `${element.height}mm`, fontSize: `${element.fontSize}pt` }}><colgroup>{element.columns.map((column, index) => <col key={index} style={{ width: `${column.width / weight * 100}%` }} />)}</colgroup><thead><tr style={{ height: `${headers.height}mm` }}>{headers.cells.map((cell, index) => <th scope="col" key={index}>{cell.join("\n")}</th>)}</tr></thead><tbody>{Array.from({ length: element.lineCount }, (_, index) => <tr key={index} style={{ height: `${rowHeight}mm` }}>{element.columns.map((_, columnIndex) => <td key={columnIndex} />)}</tr>)}</tbody></table>;
  }
  if (element.type === "table") {
    const weight = element.columns.reduce((sum, column) => sum + column.width, 0);
    return <table className="report-data-table" style={{ fontSize: `${element.fontSize}pt` }}><colgroup>{element.columns.map((column, index) => <col key={index} style={{ width: `${column.width / weight * 100}%` }} />)}</colgroup><thead><tr style={{ height: table?.headers ? `${table.headers.height}mm` : undefined }}>{element.columns.map((column, index) => <th key={index}>{table?.headers?.cells[index].join("\n") ?? column.label}</th>)}</tr></thead><tbody>{table ? table.rows.map((row, index) => <tr key={index} style={{ height: `${row.height}mm` }}>{row.cells.map((cell, columnIndex) => <td key={columnIndex}>{cell.join("\n")}</td>)}</tr>) : Array.from({ length: 3 }, (_, index) => <tr key={index}>{element.columns.map((column, columnIndex) => <td key={columnIndex}>{editing ? `«${column.label}»` : ""}</td>)}</tr>)}</tbody></table>;
  }
  return <div className={`report-text ${element.border ? "with-border" : ""}`}>{element.type === "field" ? value ?? `«${element.binding}»` : element.text}</div>;
}

export function ReportPage({ definition, data, page, inputs, index, total }: { definition: ReportDefinition; data: ReportValues; page: PrintedPage; inputs: Record<string, string>; index: number; total: number }) {
  const { t } = useLocale();
  const { width, height } = pageDimensions(definition.page);
  return <article className="report-paper" aria-label={`${t("Página")} ${index} ${t("de")} ${total}`} style={{ width: `${width}mm`, height: `${height}mm` }}>
    {definition.elements.map((element) => <div key={element.id} className={`report-element report-element-${element.type}`} style={elementStyle(element)}>
      <ReportElementContent element={element} value={resolveField(element.binding, data, page.record, inputs, index, total)} table={page} />
    </div>)}
  </article>;
}
