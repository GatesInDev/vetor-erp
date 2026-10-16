"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, LoaderCircle, Trash2, Upload } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useWorkspaceScreenActive } from "@/modules/workspace/components/workspace-screen";
import { buildSpreadsheetReport, defaultFilters, validateFilters } from "../report";
import type { ImportedWorkbook, SpreadsheetReport } from "../types";
import { spreadsheetErrorMessage } from "./report-labels";
import { SpreadsheetFilters } from "./spreadsheet-filters";
import { SpreadsheetDocument } from "./spreadsheet-document";

export function SpreadsheetWorkspace({ companyName }: { companyName: string }) {
  const { t } = useLocale();
  const active = useWorkspaceScreenActive();
  const fileInput = useRef<HTMLInputElement>(null);
  const importVersion = useRef(0);
  const [workbook, setWorkbook] = useState<ImportedWorkbook | null>(null);
  const [sheetId, setSheetId] = useState("");
  const [filters, setFilters] = useState(() => defaultFilters("titles"));
  const [showDetails, setShowDetails] = useState(true);
  const [report, setReport] = useState<SpreadsheetReport | null>(null);
  const [reportDetails, setReportDetails] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [filterError, setFilterError] = useState("");
  const sheet = workbook?.sheets.find((entry) => entry.id === sheetId);
  const stale = Boolean(report && (JSON.stringify(report.filters) !== JSON.stringify(filters) || showDetails !== reportDetails));
  const canPrint = Boolean(report?.rows.length && active && !loading && !stale);

  useEffect(() => () => { importVersion.current += 1; }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const version = ++importVersion.current;
    setLoading(true);
    setImportError("");
    setFilterError("");
    setWorkbook(null);
    setReport(null);
    try {
      const { parseSpreadsheet } = await import("../parser");
      const imported = await parseSpreadsheet(file);
      if (version !== importVersion.current) return;
      const firstSheet = imported.sheets[0];
      setWorkbook(imported);
      setSheetId(firstSheet.id);
      setFilters(defaultFilters(firstSheet.kind));
      setShowDetails(true);
    } catch (failure) {
      if (version === importVersion.current) setImportError(spreadsheetErrorMessage(failure instanceof Error ? failure.message : ""));
    } finally {
      if (version === importVersion.current) setLoading(false);
    }
  }

  function clearImport() {
    importVersion.current += 1;
    setWorkbook(null);
    setSheetId("");
    setReport(null);
    setLoading(false);
    setImportError("");
    setFilterError("");
  }

  function selectSheet(id: string) {
    const selected = workbook?.sheets.find((entry) => entry.id === id);
    if (!selected) return;
    setSheetId(id);
    setFilters(defaultFilters(selected.kind));
    setReport(null);
    setFilterError("");
  }

  function generate() {
    if (!workbook || !sheet) return;
    const error = validateFilters(filters);
    if (error) {
      setFilterError(spreadsheetErrorMessage(error));
      return;
    }
    try {
      setReport(buildSpreadsheetReport(workbook, sheet.id, filters));
      setReportDetails(showDetails);
      setFilterError("");
    } catch (failure) {
      setFilterError(spreadsheetErrorMessage(failure instanceof Error ? failure.message : ""));
    }
  }

  return <div className="page-stack spreadsheet-workspace" data-print-ready={canPrint}>
    {active && <style>{"@page { size: A4 landscape; margin: 12mm; }"}</style>}
    <div className="spreadsheet-controls"><Link href="/reports" className="text-button"><ArrowLeft size={17} />{t("Relatórios")}</Link><PageHeader eyebrow={t("PLANILHAS DA OPERAÇÃO")} title={t("Relatórios de planilhas")} description={t("Transforme sua planilha de boletos em um relatório organizado. Selecione a aba, aplique filtros e prepare a versão para impressão.")} /></div>
    <section className="island panel spreadsheet-upload spreadsheet-controls" aria-labelledby="spreadsheet-upload-title">
      <div className="spreadsheet-upload-icon"><FileSpreadsheet size={32} strokeWidth={1.5} /></div>
      <div className="spreadsheet-upload-copy"><p className="section-label">{t("01 · IMPORTAR")}</p><h2 id="spreadsheet-upload-title">{workbook ? workbook.fileName : t("Comece pela sua planilha")}</h2><p>{t("Importe um arquivo XLSX com as abas de títulos ou obras no formato de Boletos.xlsx.")}</p><small>{t("O arquivo é processado neste navegador. Os dados ficam nesta tela e são descartados ao fechá-la ou recarregá-la.")}</small></div>
      <div className="spreadsheet-upload-actions"><input ref={fileInput} className="spreadsheet-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label={t("Selecionar planilha XLSX")} onChange={upload} disabled={loading} /><button className="primary-button" type="button" disabled={loading} onClick={() => fileInput.current?.click()}>{loading ? <LoaderCircle className="spreadsheet-spinner" size={18} /> : <Upload size={18} />}{t(loading ? "Lendo planilha..." : workbook ? "Trocar arquivo" : "Selecionar arquivo XLSX")}</button>{(workbook || loading) && <button className="text-button" type="button" onClick={clearImport}><Trash2 size={16} />{t("Limpar importação")}</button>}</div>
      <div className="spreadsheet-upload-status" aria-live="polite">{importError && <p className="form-error" role="alert">{t(importError)}</p>}{loading && <p className="field-help" role="status">{t("Lendo as abas e conferindo os valores da planilha...")}</p>}{workbook && <p className="spreadsheet-import-success"><CheckCircle2 size={17} />{workbook.sheets.length} {t("abas reconhecidas. Selecione os dados que deseja analisar.")}</p>}</div>
    </section>
    {workbook && sheet && <>
      <section className="island panel spreadsheet-controls spreadsheet-sheet-panel" aria-labelledby="spreadsheet-sheet-title"><div className="spreadsheet-section-heading"><div><h2 id="spreadsheet-sheet-title">{t("Dados importados")}</h2><p>{t("Títulos e obras são relatórios independentes, conforme as abas do arquivo.")}</p></div><label className="form-field">{t("Aba da planilha")}<select value={sheetId} onChange={(event) => selectSheet(event.target.value)}>{workbook.sheets.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.rows.length} {t("registros")}</option>)}</select></label></div><div className="spreadsheet-import-counts"><span><strong>{sheet.rows.length}</strong> {t("registros válidos")}</span><span><strong>{sheet.issues.length}</strong> {t("linhas excluídas")}</span><span>{t(sheet.kind === "titles" ? "Boletos e títulos" : "Obras e propostas")}</span></div>
        {workbook.skippedSheets.length > 0 && <p className="field-help">{t("Abas sem formato reconhecido")}: {workbook.skippedSheets.join(", ")}.</p>}
        {sheet.issues.length > 0 && <details className="spreadsheet-import-issues"><summary><AlertTriangle size={17} />{t("Conferir linhas não importadas")} ({sheet.issues.length})</summary><p>{t("Estas linhas não entram nos totais. Corrija a planilha e importe novamente para incluí-las.")}</p><ul>{sheet.issues.slice(0, 50).map((issue, index) => <li key={`${issue.row}-${index}`}><strong>{t("Linha")} {issue.row}:</strong> {t(spreadsheetErrorMessage(issue.message))}</li>)}</ul>{sheet.issues.length > 50 && <p>{t("Exibindo os primeiros 50 avisos.")}</p>}</details>}
      </section>
      <SpreadsheetFilters sheet={sheet} filters={filters} showDetails={showDetails} canPrint={canPrint} stale={stale} error={filterError} onChange={(value) => { setFilters(value); setFilterError(""); }} onDetailsChange={setShowDetails} onReset={() => { setFilters(defaultFilters(sheet.kind)); setShowDetails(true); setFilterError(""); }} onGenerate={generate} />
    </>}
    {!report && !loading && <div className="island panel spreadsheet-controls"><EmptyState title={t(workbook ? "Seu relatório começa nos filtros" : "Uma visão clara dos seus dados")} description={t(workbook ? "Escolha o período, a situação e a organização desejada. Depois, clique em Gerar relatório." : "Importe a planilha para conferir as abas disponíveis, filtrar os registros e gerar um documento com totais e detalhes.")} /></div>}
    <p className="spreadsheet-print-warning">{t("Gere um relatório atualizado com registros antes de imprimir.")}</p>
    {report && <SpreadsheetDocument report={report} companyName={companyName} showDetails={reportDetails} />}
  </div>;
}
