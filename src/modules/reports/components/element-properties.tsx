"use client";

import { useLocale } from "@/modules/settings/components/preferences-provider";
import { reportSources } from "../sources";
import type { ReportDefinition, ReportElement } from "../schema";
import { manualTableFits } from "../table-layout";
import { ImageProperties } from "./image-properties";
import { TextProperties } from "./text-properties";

export function ElementProperties({ element, definition, update, remove, duplicate, reorder, onImageLoadingChange }: {
  element: ReportElement; definition: ReportDefinition; update: (patch: Partial<ReportElement>) => void;
  remove: () => void; duplicate: () => void; reorder: (direction: number) => void;
  onImageLoadingChange: (loading: boolean) => void;
}) {
  const { t } = useLocale();
  const source = reportSources.find((item) => item.id === definition.source)!;
  const isTable = element.type === "table" || element.type === "manualTable";
  const bindings = [
    { key: "company.name", label: t("Empresa") }, { key: "system.date", label: t("Data de emissão") },
    { key: "system.page", label: t("Página atual") }, { key: "system.pages", label: t("Total de páginas") },
    ...source.fields.map((field) => ({ key: `row.${field.key}`, label: t(field.label) })),
    ...definition.inputs.map((input) => ({ key: `input.${input.id}`, label: `${t("Preenchimento")}: ${input.label}` })),
  ];
  return <div className="report-properties">
    <h3>{t("Propriedades do elemento")}</h3>
    {element.type === "image" && <ImageProperties key={element.id} element={element} definition={definition} update={update} onLoadingChange={onImageLoadingChange} />}
    <div className="report-number-grid">{(["x", "y", "width", "height"] as const).map((key) => <label key={key}>{t(({ x: "Esquerda", y: "Topo", width: "Largura", height: "Altura" })[key])} (mm)<input type="number" step="1" min={key === "width" ? 2 : key === "height" ? 1 : 0} max="300" value={Number(element[key].toFixed(1))} onChange={(event) => update({ [key]: Number(event.target.value) })} /></label>)}</div>
    {["text", "signature"].includes(element.type) && <TextProperties key={element.id} text={element.text} bindings={bindings} update={(text) => update({ text })} />}
    {element.type === "field" && <label>{t("Informação")}<select value={element.binding} onChange={(event) => update({ binding: event.target.value })}>{bindings.map((binding) => <option key={binding.key} value={binding.key}>{binding.label}</option>)}</select></label>}
    {["text", "field", "table", "manualTable", "signature"].includes(element.type) && <>
      <label>{t("Fonte (pt)")}<input type="number" min="8" max={isTable ? 16 : 36} value={element.fontSize} onChange={(event) => update({ fontSize: Math.max(8, Math.min(isTable ? 16 : 36, Number(event.target.value))) })} /></label>
      <label>{t("Alinhamento")}<select value={element.align} onChange={(event) => update({ align: event.target.value as ReportElement["align"] })}><option value="left">{t("Esquerda")}</option><option value="center">{t("Centro")}</option><option value="right">{t("Direita")}</option></select></label>
      <label className="report-check"><input type="checkbox" checked={element.bold} onChange={(event) => update({ bold: event.target.checked })} />{t("Negrito")}</label>
    </>}
    {["text", "field"].includes(element.type) && <label className="report-check"><input type="checkbox" checked={element.border} onChange={(event) => update({ border: event.target.checked })} />{t("Contorno")}</label>}
    {element.type === "blank" && <label>{t("Linhas para preenchimento")}<input type="number" min="1" max="15" value={element.lineCount} onChange={(event) => update({ lineCount: Math.max(1, Math.min(15, Number(event.target.value))) })} /></label>}
    {element.type === "manualTable" && <><label>{t("Linhas em branco")}<input type="number" min="1" max="15" step="1" value={element.lineCount} onChange={(event) => update({ lineCount: Math.max(1, Math.min(15, Math.trunc(Number(event.target.value)))) })} /></label><p className="report-hint">{t("As células ficam vazias para escrever após a impressão. A altura se ajusta para manter pelo menos 8 mm por linha.")}</p>{!manualTableFits(element) && <p className="form-error" role="alert">{t("A tabela para preenchimento precisa de colunas com pelo menos 12 mm e linhas com pelo menos 8 mm. Amplie a tabela, reduza as linhas ou ajuste os títulos.")}</p>}</>}
    {isTable && <div className="report-columns"><h4>{t("Colunas da tabela")}</h4><p>{t("O peso distribui a largura entre as colunas.")}</p>{element.columns.map((column, index) => <fieldset key={index}><legend>{t("Coluna")} {index + 1}</legend>
      {element.type === "table" && <label>{t("Campo")}<select value={column.key} onChange={(event) => update({ columns: element.columns.map((item, position) => position === index ? { ...item, key: event.target.value, label: source.fields.find((field) => field.key === event.target.value)!.label } : item) })}>{source.fields.map((field) => <option key={field.key} value={field.key}>{t(field.label)}</option>)}</select></label>}
      <label>{t("Cabeçalho da coluna")}<input maxLength={80} value={column.label} onChange={(event) => update({ columns: element.columns.map((item, position) => position === index ? { ...item, label: event.target.value } : item) })} /></label>
      <label>{t("Peso da largura")}<input type="number" min="1" max="20" value={column.width} onChange={(event) => update({ columns: element.columns.map((item, position) => position === index ? { ...item, width: Math.max(1, Math.min(20, Number(event.target.value))) } : item) })} /></label>
      <div className="inline-actions"><button type="button" className="text-button" disabled={index === 0} onClick={() => { const columns = [...element.columns]; [columns[index - 1], columns[index]] = [columns[index], columns[index - 1]]; update({ columns }); }}>{t("Mover antes")}</button><button type="button" className="text-button" disabled={element.columns.length === 1} onClick={() => update({ columns: element.columns.filter((_, position) => position !== index) })}>{t("Remover")}</button></div>
    </fieldset>)}<button type="button" className="secondary-button" disabled={element.columns.length >= 8} onClick={() => update({ columns: [...element.columns, element.type === "manualTable" ? { key: `column_${crypto.randomUUID()}`, label: `${t("Coluna")} ${element.columns.length + 1}`, width: 2 } : { ...source.fields[0], width: 2 }] })}>{t("Adicionar coluna")}</button></div>}
    <div className="report-property-actions"><button type="button" className="secondary-button" onClick={() => reorder(-1)}>{t("Enviar para trás")}</button><button type="button" className="secondary-button" onClick={() => reorder(1)}>{t("Trazer para frente")}</button><button type="button" className="secondary-button" disabled={element.type === "table" || definition.elements.length >= 80} onClick={duplicate}>{t("Duplicar elemento")}</button><button type="button" className="text-button" onClick={remove}>{t("Excluir elemento")}</button></div>
  </div>;
}
