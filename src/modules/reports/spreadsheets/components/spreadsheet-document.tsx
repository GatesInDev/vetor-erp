"use client";

import { Fragment } from "react";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { formatAccountingAmount } from "@/modules/reports/accounting/components/accounting-format";
import type { ProjectRow, ReportFilters, SpreadsheetReport, TitleRow } from "../types";
import { dateLabels, dueLabels, groupLabels, sortLabels } from "./report-labels";

type Formatter = { t: (value: string) => string; date: (value: string) => string; money: (value: string) => string };

function selectedFilters(filters: ReportFilters, kind: SpreadsheetReport["kind"], format: Formatter): string[] {
  const { t, date } = format;
  const labels: string[] = [];
  if (filters.search.trim()) labels.push(`${t("Busca")}: ${filters.search.trim()}`);
  if (kind === "titles" && filters.direction !== "all") labels.push(t(filters.direction === "payable" ? "A pagar" : "A receber"));
  for (const [field, label] of [["status", "Situação"], ["party", "Cliente / fornecedor"], ["category", "Categoria"], ["paymentMethod", "Forma de pagamento"], ["city", "Cidade"]] as const) {
    if (filters[field]) labels.push(`${t(label)}: ${filters[field]}`);
  }
  if (filters.from || filters.to) labels.push(`${t(dateLabels[filters.dateField])}: ${filters.from ? date(filters.from) : t("Sem início")} — ${filters.to ? date(filters.to) : t("Sem fim")}`);
  if (filters.minAmount || filters.maxAmount) labels.push(`${t("Valor")}: ${filters.minAmount || t("Sem mínimo")} — ${filters.maxAmount || t("Sem máximo")}`);
  if (kind === "titles") {
    if (filters.dueStatus !== "all") labels.push(t(dueLabels[filters.dueStatus]));
    labels.push(`${t("Referência")}: ${date(filters.asOf)}`);
  }
  return labels;
}

function TitleTable({ rows, showNotes, showDetails, format }: { rows: TitleRow[]; showNotes: boolean; showDetails: boolean; format: Formatter }) {
  const { t, date, money } = format;
  return <div className="spreadsheet-table-scroll"><table className="spreadsheet-table spreadsheet-title-table"><thead><tr><th scope="col">{t("Documento")}</th><th scope="col">{t("Tipo / categoria")}</th><th scope="col">{t("Cliente / fornecedor")}</th><th scope="col">{t("Vencimento")}</th><th scope="col">{t("Situação")}</th><th scope="col" className="spreadsheet-money">{t("Valor nominal")}</th><th scope="col" className="spreadsheet-money">{t("Juros")}</th><th scope="col" className="spreadsheet-money">{t("Valor total")}</th></tr></thead><tbody>{rows.map((row) => <Fragment key={row.id}>
    <tr><th scope="row"><strong>{row.documentNumber || "—"}</strong>{showDetails && <small>{t("Linha")} {row.sourceRow}</small>}</th><td><span className={`spreadsheet-direction is-${row.direction}`}>{t(row.direction === "payable" ? "A pagar" : "A receber")}</span><small>{row.category || "—"}</small></td><td>{row.party || "—"}</td><td><span className="spreadsheet-date">{date(row.dueDate)}</span>{showDetails && <><small>{t("Emissão")}: {date(row.issuedAt)}</small><small>{t("Pagamento")}: {date(row.paidAt)}</small></>}</td><td>{row.status || "—"}{showDetails && <small>{row.paymentMethod || t("Forma não informada")}</small>}</td><td className="spreadsheet-money">{money(row.nominalAmount)}</td><td className="spreadsheet-money">{money(row.interestAmount)}</td><td className="spreadsheet-money"><strong>{money(row.totalAmount)}</strong></td></tr>
    {showNotes && row.notes && <tr className="spreadsheet-notes-row"><td colSpan={8}><strong>{t("Observações")}:</strong> {row.notes}</td></tr>}
  </Fragment>)}</tbody></table></div>;
}

function ProjectTable({ rows, showNotes, showDetails, format }: { rows: ProjectRow[]; showNotes: boolean; showDetails: boolean; format: Formatter }) {
  const { t, date, money } = format;
  return <div className="spreadsheet-table-scroll"><table className="spreadsheet-table spreadsheet-project-table"><thead><tr><th scope="col">{t("Obra")}</th><th scope="col">{t("Cliente")}</th><th scope="col">{t("Cidade")}</th><th scope="col">{t("Datas da obra")}</th><th scope="col">{t("Situação")}</th><th scope="col" className="spreadsheet-money">{t("Valor total")}</th></tr></thead><tbody>{rows.map((row) => <Fragment key={row.id}>
    <tr><th scope="row"><strong>{row.name || "—"}</strong><small>{row.projectNumber || "—"}{showDetails ? ` · ${t("Linha")} ${row.sourceRow}` : ""}</small></th><td>{row.party || "—"}{showDetails && <small>{t("CPF / CNPJ")}: {row.taxId || "—"}</small>}</td><td>{row.city || "—"}{showDetails && <small>{row.address || "—"}</small>}</td><td><span>{t("Início da obra")}: {date(row.startsAt)}</span><small>{t("Fim")}: {date(row.endsAt)}</small>{showDetails && <><small>{t("Orçamento")}: {date(row.quotedAt)}</small><small>{t("Aprovação")}: {date(row.approvedAt)}</small></>}</td><td>{row.status || "—"}{showDetails && <><small>{t("Piso")}: {row.floorType || "—"}</small><small>{t("Área")}: {row.area || "—"}</small></>}</td><td className="spreadsheet-money"><strong>{money(row.totalAmount)}</strong></td></tr>
    {showDetails && (row.salesContact || row.technicalContact) && <tr className="spreadsheet-notes-row"><td colSpan={6}><strong>{t("Contato comercial")}:</strong> {row.salesContact || "—"}<span className="spreadsheet-detail-divider"> · </span><strong>{t("Responsável técnico")}:</strong> {row.technicalContact || "—"}</td></tr>}
    {showNotes && row.notes && <tr className="spreadsheet-notes-row"><td colSpan={6}><strong>{t("Observações")}:</strong> {row.notes}</td></tr>}
  </Fragment>)}</tbody></table></div>;
}

export function SpreadsheetDocument({ report, companyName, showDetails }: { report: SpreadsheetReport; companyName: string; showDetails: boolean }) {
  const { t, locale, formatDate } = useLocale();
  const format: Formatter = {
    t,
    date: (value) => value ? formatDate(`${value.slice(0, 10)}T12:00:00Z`, { dateStyle: "short" }) : "—",
    money: (value) => formatAccountingAmount(value, locale),
  };
  const titles = report.kind === "titles";
  const applied = selectedFilters(report.filters, report.kind, format);
  const summary = titles ? [
    { label: "Total dos títulos a pagar", value: report.totals.payable },
    { label: "Total dos títulos a receber", value: report.totals.receivable },
    { label: "Receber menos pagar", value: report.totals.balance },
    { label: "Vencidos em aberto", value: report.totals.overdue },
    { label: "Títulos quitados", value: report.totals.settled },
    { label: "Total dos registros", value: report.totals.amount },
  ] : [{ label: "Valor total das obras", value: report.totals.amount }];

  function groupLabel(key: string): string {
    if (!key || key === "Not provided") return t("Não informado");
    if (report.filters.groupBy === "month" && /^\d{4}-\d{2}$/.test(key)) return formatDate(`${key}-01T12:00:00Z`, { month: "long", year: "numeric" });
    return key;
  }

  return <article className="island spreadsheet-document" aria-label={t(titles ? "Relatório de boletos e títulos" : "Relatório de obras da planilha")}>
    <header className="spreadsheet-document-heading"><div><p className="spreadsheet-company">{companyName}</p><p className="section-label">{t("RELATÓRIO DA PLANILHA")}</p><h1>{t(titles ? "Boletos e títulos" : "Obras e propostas")}</h1><p>{report.fileName} <span aria-hidden="true">/</span> {report.sheetName}</p></div><div className="spreadsheet-document-meta"><strong>{report.rows.length} {t("registros selecionados")}</strong><span>{t("de")} {report.sourceCount} {t("registros válidos da aba")}</span><span>{t("Gerado em")} {formatDate(report.generatedAt, { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}</span><span>{t("Valores em reais · 2 casas decimais")}</span></div></header>
    <section className="spreadsheet-summary" aria-label={t("Resumo do relatório")}>{summary.map((item) => <div key={item.label}><span>{t(item.label)}</span><strong>{format.money(item.value)}</strong></div>)}{!titles && <div><span>{t("Obras selecionadas")}</span><strong>{report.rows.length}</strong></div>}</section>
    <p className="spreadsheet-total-note">{t(titles ? "Totais dos registros selecionados, incluindo situações quitadas ou canceladas quando presentes no filtro." : "Valores informados para obras e propostas. Este relatório não representa contas a receber.")}</p>
    <div className="spreadsheet-applied-filters"><strong>{t("Filtros aplicados")}</strong><ul>{applied.length ? applied.map((value, index) => <li key={index}>{value}</li>) : <li>{t("Todos os registros da aba")}</li>}<li>{t("Agrupamento")}: {t(groupLabels[report.filters.groupBy])}</li><li>{t("Ordenação")}: {t(sortLabels[report.filters.sortBy])} · {t(report.filters.sortDirection === "asc" ? "Crescente" : "Decrescente")}</li><li>{t(report.filters.showNotes ? "Com observações" : "Sem observações")} · {t(showDetails ? "Com detalhes adicionais" : "Sem detalhes adicionais")}</li></ul></div>
    {report.rejectedCount > 0 && <p className="spreadsheet-document-warning">{report.rejectedCount} {t("linhas com dados inválidos foram excluídas deste relatório. Confira os avisos da importação.")}</p>}
    {report.rows.length ? report.groups.map((group, index) => <section className="spreadsheet-report-group" key={`${group.key}-${index}`}>{report.filters.groupBy !== "none" && <div className="spreadsheet-group-heading"><h2>{groupLabel(group.key)}</h2><span>{group.rows.length} {t("registros")} · <strong>{format.money(group.totalAmount)}</strong></span></div>}{titles ? <TitleTable rows={group.rows as TitleRow[]} showNotes={report.filters.showNotes} showDetails={showDetails} format={format} /> : <ProjectTable rows={group.rows as ProjectRow[]} showNotes={report.filters.showNotes} showDetails={showDetails} format={format} />}</section>) : <p className="spreadsheet-no-results">{t("Nenhum registro corresponde aos filtros. Ajuste os critérios e gere novamente.")}</p>}
    <footer className="spreadsheet-document-footer"><span>{t("Fonte")}: {report.fileName} · {report.sheetName}</span><span>{t("Relatório informativo a partir do arquivo importado.")}</span></footer>
  </article>;
}
