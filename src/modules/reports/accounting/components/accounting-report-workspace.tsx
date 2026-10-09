"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspaceScreenActive } from "@/modules/workspace/components/workspace-screen";
import type { BalanceSheetReport, TrialBalanceReport } from "../types";
import { useAccountingReport } from "./use-accounting-report";
import { useAccountingFormat } from "./accounting-values";
import { BalanceSheet } from "./balance-sheet";
import { TrialBalance } from "./trial-balance";

type ReportKind = "balance-sheet" | "trial-balance";
type Filters = { asOf: string; from: string; to: string };

export function AccountingReportWorkspace({ kind, defaults }: { kind: ReportKind; defaults: Filters }) {
  const { t, date } = useAccountingFormat();
  const active = useWorkspaceScreenActive();
  const [filters, setFilters] = useState(defaults);
  const [showZero, setShowZero] = useState(false);
  const [filterError, setFilterError] = useState("");
  const { report, loading, error, outdated, generate } = useAccountingReport<BalanceSheetReport | TrialBalanceReport>(`/api/reports/${kind}`);
  const balanceReport = report && "asOf" in report ? report : null;
  const trialReport = report && "from" in report ? report : null;
  const filtersChanged = Boolean(balanceReport ? balanceReport.asOf !== filters.asOf : trialReport && (trialReport.from !== filters.from || trialReport.to !== filters.to));
  const canPrint = Boolean(report && active && !loading && !outdated && !filtersChanged);
  const title = kind === "balance-sheet" ? "Balanço patrimonial" : "Balancete de verificação";
  const description = kind === "balance-sheet" ? "Consulte ativos, passivos e patrimônio líquido em uma data de referência." : "Confira saldos iniciais, débitos, créditos e saldos finais de cada conta no período.";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kind === "trial-balance" && filters.from > filters.to) {
      setFilterError("A data final deve ser igual ou posterior à data inicial.");
      return;
    }
    setFilterError("");
    void generate(kind === "balance-sheet" ? { asOf: filters.asOf } : { from: filters.from, to: filters.to });
  }

  return <div className="page-stack accounting-report" data-print-ready={canPrint}>
    {active && <style>{`@page { size: A4 ${kind === "trial-balance" ? "landscape" : "portrait"}; margin: 12mm; }`}</style>}
    <div className="accounting-report-controls"><Link href="/reports" className="text-button"><ArrowLeft size={17} />{t("Relatórios")}</Link><PageHeader eyebrow={t("DEMONSTRATIVOS CONTÁBEIS")} title={t(title)} description={t(description)} actions={<Link className="secondary-button" href={kind === "balance-sheet" ? "/reports/trial-balance" : "/reports/balance-sheet"}>{t(kind === "balance-sheet" ? "Abrir balancete" : "Abrir balanço")}</Link>} /></div>
    <form className="island panel accounting-report-controls" onSubmit={submit}>
      <div className="accounting-filters">
        {kind === "balance-sheet" ? <label className="form-field">{t("Data de referência")}<input type="date" required disabled={loading} value={filters.asOf} onChange={(event) => setFilters((previous) => ({ ...previous, asOf: event.target.value }))} /></label> : <><label className="form-field">{t("Data inicial")}<input type="date" required disabled={loading} value={filters.from} onChange={(event) => setFilters((previous) => ({ ...previous, from: event.target.value }))} /></label><label className="form-field">{t("Data final")}<input type="date" required min={filters.from} disabled={loading} value={filters.to} onChange={(event) => setFilters((previous) => ({ ...previous, to: event.target.value }))} /></label></>}
        <button className="primary-button" disabled={loading} type="submit"><FileText size={17} />{t(loading ? "Gerando demonstrativo…" : "Gerar demonstrativo")}</button>
        <button className="secondary-button" type="button" disabled={!canPrint} onClick={() => { if (canPrint) window.print(); }}><Printer size={17} />{t("Imprimir / salvar PDF")}</button>
      </div>
      <label className="checkbox-field accounting-zero-toggle"><input type="checkbox" checked={showZero} onChange={(event) => setShowZero(event.target.checked)} />{t("Mostrar contas sem saldo ou movimento")}</label>
      <p className="field-help">{t("As datas incluem o dia completo em UTC. Os valores são exibidos em reais com duas casas decimais.")}</p>
      <div aria-live="polite">{(error || filterError) && <p className="form-error" role="alert">{t(error || filterError)}</p>}{loading && <p className="field-help" role="status">{t("Consultando os lançamentos contábeis…")}</p>}{report && (outdated || filtersChanged) && <p className="accounting-notice" role="status">{t(outdated ? "Os lançamentos foram alterados. Gere o demonstrativo novamente antes de imprimir." : "Os filtros foram alterados. Gere o demonstrativo para atualizar os valores e liberar a impressão.")}</p>}</div>
    </form>
    {!report && !loading && !error && <div className="island panel accounting-report-controls"><EmptyState title={t("Escolha a data e gere o demonstrativo")} description={t("Os dados serão consultados a partir dos lançamentos contábeis da sua empresa.")} /></div>}
    <div className="accounting-print-warning">{t("Gere um demonstrativo atualizado antes de imprimir.")}</div>
    {report && <article className="island panel accounting-report-document" aria-label={t(title)}>
      <header className="accounting-document-heading"><div><p>{report.company.name}</p><h1>{t(title)}</h1><p>{balanceReport ? `${t("Posição em")} ${date(balanceReport.asOf)}` : trialReport ? `${date(trialReport.from)} — ${date(trialReport.to)}` : ""}</p></div><div className="accounting-document-meta"><span>{t("Valores em BRL · 2 casas decimais")}</span><span>{t("Gerado em")} {date(report.generatedAt)}</span><span>{t(showZero ? "Todas as contas incluídas" : "Contas sem saldo ou movimento ocultas")}</span></div></header>
      <p className={`accounting-check ${report.balanced ? "is-balanced" : "is-unbalanced"}`} role="status">{t(report.balanced ? "Conferência contábil sem diferença." : "Existe diferença entre os totais. Revise os lançamentos contábeis.")}</p>
      {balanceReport ? <BalanceSheet report={balanceReport} showZero={showZero} /> : trialReport ? <TrialBalance report={trialReport} showZero={showZero} /> : null}
    </article>}
  </div>;
}
