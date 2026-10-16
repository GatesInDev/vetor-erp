"use client";

import { FileText, Printer, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { FormEvent } from "react";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import type { DateField, ImportedSheet, ReportFilters } from "../types";
import { dateLabels, dueLabels, groupLabels, sortLabels } from "./report-labels";

type Props = {
  sheet: ImportedSheet;
  filters: ReportFilters;
  showDetails: boolean;
  canPrint: boolean;
  stale: boolean;
  error: string;
  onChange: (filters: ReportFilters) => void;
  onDetailsChange: (value: boolean) => void;
  onReset: () => void;
  onGenerate: () => void;
};

export function SpreadsheetFilters({ sheet, filters, showDetails, canPrint, stale, error, onChange, onDetailsChange, onReset, onGenerate }: Props) {
  const { t, locale } = useLocale();
  const titles = sheet.kind === "titles";
  const dates: DateField[] = titles ? ["dueDate", "issuedAt", "paidAt"] : ["quotedAt", "approvedAt", "startsAt", "endsAt"];
  const groups: ReportFilters["groupBy"][] = titles ? ["none", "party", "category", "status", "month"] : ["none", "party", "city", "status", "month"];

  function setFilter<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function options(field: "party" | "status" | "category" | "paymentMethod" | "city") {
    return [...new Set(sheet.rows.map((row) => field in row ? String(row[field as keyof typeof row] ?? "") : "").filter(Boolean))].sort((left, right) => left.localeCompare(right, locale));
  }

  function selectFilter(field: "party" | "status" | "category" | "paymentMethod" | "city", label: string) {
    return <label className="form-field">{t(label)}<select value={filters[field]} onChange={(event) => setFilter(field, event.target.value)}><option value="">{t("Todos")}</option>{options(field).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onGenerate();
  }

  return <form className="island panel spreadsheet-controls spreadsheet-filter-panel" onSubmit={submit}>
    <div className="spreadsheet-section-heading"><div><p className="section-label">{t("02 · CONFIGURAR")}</p><h2><SlidersHorizontal size={21} />{t("Escolha o recorte do relatório")}</h2><p>{t("Ajuste os filtros e a apresentação antes de gerar.")}</p></div><button type="button" className="text-button" onClick={onReset}><RotateCcw size={16} />{t("Limpar filtros")}</button></div>
    <div className="spreadsheet-filter-grid">
      <label className="form-field spreadsheet-search">{t("Buscar na planilha")}<input type="search" value={filters.search} placeholder={t(titles ? "Documento, cliente, fornecedor ou observação..." : "Obra, cliente, cidade ou observação...")} onChange={(event) => setFilter("search", event.target.value)} /></label>
      {titles && <label className="form-field">{t("Tipo de título")}<select value={filters.direction} onChange={(event) => setFilter("direction", event.target.value as ReportFilters["direction"])}><option value="all">{t("Pagar e receber")}</option><option value="payable">{t("A pagar")}</option><option value="receivable">{t("A receber")}</option></select></label>}
      {selectFilter("status", "Situação")}
      {selectFilter("party", "Cliente / fornecedor")}
      {titles ? <>{selectFilter("category", "Categoria")}{selectFilter("paymentMethod", "Forma de pagamento")}</> : selectFilter("city", "Cidade")}
      <label className="form-field">{t("Filtrar pela data de")}<select value={filters.dateField} onChange={(event) => setFilter("dateField", event.target.value as DateField)}>{dates.map((field) => <option key={field} value={field}>{t(dateLabels[field])}</option>)}</select></label>
      <label className="form-field">{t("Data inicial")}<input type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} /></label>
      <label className="form-field">{t("Data final")}<input type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => setFilter("to", event.target.value)} /></label>
      <label className="form-field">{t("Valor mínimo (R$)")}<input inputMode="decimal" placeholder={locale === "en-US" ? "0.00" : "0,00"} value={filters.minAmount} onChange={(event) => setFilter("minAmount", event.target.value)} /></label>
      <label className="form-field">{t("Valor máximo (R$)")}<input inputMode="decimal" placeholder={t("Sem limite")} value={filters.maxAmount} onChange={(event) => setFilter("maxAmount", event.target.value)} /></label>
      {titles && <><label className="form-field">{t("Vencimento em aberto")}<select value={filters.dueStatus} onChange={(event) => setFilter("dueStatus", event.target.value as ReportFilters["dueStatus"])}>{Object.entries(dueLabels).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label><label className="form-field">{t("Data de referência")}<input type="date" required value={filters.asOf} onChange={(event) => setFilter("asOf", event.target.value)} /></label></>}
    </div>
    <div className="spreadsheet-presentation">
      <div className="spreadsheet-filter-grid">
        <label className="form-field">{t("Agrupar por")}<select value={filters.groupBy} onChange={(event) => setFilter("groupBy", event.target.value as ReportFilters["groupBy"])}>{groups.map((group) => <option key={group} value={group}>{t(groupLabels[group])}</option>)}</select></label>
        <label className="form-field">{t("Ordenar por")}<select value={filters.sortBy} onChange={(event) => setFilter("sortBy", event.target.value as ReportFilters["sortBy"])}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select></label>
        <label className="form-field">{t("Ordem")}<select value={filters.sortDirection} onChange={(event) => setFilter("sortDirection", event.target.value as ReportFilters["sortDirection"])}><option value="asc">{t("Crescente")}</option><option value="desc">{t("Decrescente")}</option></select></label>
      </div>
      <div className="checkbox-options"><label className="checkbox-field"><input type="checkbox" checked={filters.showNotes} onChange={(event) => setFilter("showNotes", event.target.checked)} />{t("Incluir observações")}</label><label className="checkbox-field"><input type="checkbox" checked={showDetails} onChange={(event) => onDetailsChange(event.target.checked)} />{t("Incluir detalhes adicionais")}</label></div>
    </div>
    <div aria-live="polite">{error && <p className="form-error" role="alert">{t(error)}</p>}{stale && <p className="spreadsheet-notice" role="status">{t("Os filtros foram alterados. Gere novamente para atualizar o relatório e liberar a impressão.")}</p>}</div>
    <div className="spreadsheet-generate"><p>{t(titles ? "Os filtros de vencimento em aberto excluem registros quitados ou cancelados." : "Os valores de obras representam o total informado na planilha, sem vínculo automático com os títulos.")}</p><div><button className="primary-button" type="submit"><FileText size={17} />{t("Gerar relatório")}</button><button className="secondary-button" type="button" disabled={!canPrint} onClick={() => { if (canPrint) window.print(); }}><Printer size={17} />{t("Imprimir / salvar PDF")}</button></div></div>
  </form>;
}
