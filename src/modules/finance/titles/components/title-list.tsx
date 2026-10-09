"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { isOverdue } from "@/modules/finance/types";
import type { FinancialTitleRow } from "../types";
import { titleKinds, titleStatuses, TitleStatus } from "./title-status";
import { financialOriginHref, financialOriginReference } from "../../origin";

export function TitleList({ titles, canWrite }: { titles: FinancialTitleRow[]; canWrite: boolean }) {
  const { t, locale, formatDate, formatMoney } = useLocale();
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const query = search.trim().toLocaleLowerCase(locale);
  const filtered = titles.filter((title) => (!direction || title.accountType === direction)
    && (!status || (status === "OVERDUE" ? (title.status === "OPEN" || title.status === "PARTIAL") && isOverdue(title.dueAt) : title.status === status))
    && [title.number, title.partner.name, title.project.name, financialOriginReference(title.origin), ...(title.origin.type === "RENTAL" ? [title.origin.equipmentName] : []), title.bankName, t(titleKinds[title.kind])].some((value) => value.toLocaleLowerCase(locale).includes(query)));
  const hasFilters = Boolean(query || direction || status);

  function clearFilters() { setSearch(""); setDirection(""); setStatus(""); }

  return <div className="page-stack">
    <div className="toolbar">
      <label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label={t("Buscar títulos")} placeholder={t("Buscar por título, parceiro, obra ou banco…")} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {canWrite && <Link className="primary-button" href="/finance/titles/new"><Plus size={17} />{t("Novo título")}</Link>}
    </div>
    <div className="form-grid">
      <label className="form-field">{t("Direção do título")}<select value={direction} onChange={(event) => setDirection(event.target.value)}><option value="">{t("A pagar e a receber")}</option><option value="PAYABLE">{t("A pagar")}</option><option value="RECEIVABLE">{t("A receber")}</option></select></label>
      <label className="form-field">{t("Situação do título")}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t("Todas as situações")}</option>{Object.entries(titleStatuses).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}<option value="OVERDUE">{t("Vencido")}</option></select></label>
    </div>
    <div className="inline-actions"><span className="table-secondary">{filtered.length} {t(filtered.length === 1 ? "registro" : "registros")}</span>{hasFilters && <button className="text-button" onClick={clearFilters}>{t("Limpar filtros")}</button>}</div>
    {!filtered.length ? <EmptyState title={hasFilters ? t("Nenhum resultado encontrado") : t("Seus títulos começam aqui")} description={hasFilters ? t("Tente outro termo ou ajuste os filtros.") : t("Cadastre boletos, duplicatas e outros documentos vinculados às contas a pagar ou receber.")} action={hasFilters ? <button className="secondary-button" onClick={clearFilters}>{t("Limpar filtros")}</button> : canWrite ? <Link className="secondary-button" href="/finance/titles/new">{t("Cadastrar título")}</Link> : undefined} /> : <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{t("Título / parceiro")}</th><th>{t("Vínculo")}</th><th>{t("Vencimento")}</th><th>{t("Valor")}</th><th>{t("Saldo em aberto")}</th><th>{t("Situação")}</th><th><span className="sr-only">{t("Ações")}</span></th></tr></thead>
      <tbody>{filtered.map((title) => <tr key={title.id}>
        <td><Link className="table-primary text-button" href={`/finance/titles/${title.id}`}>{title.number}</Link><span className="table-secondary">{t(titleKinds[title.kind])} · {title.partner.name}</span>{title.bankName && <span className="table-secondary">{title.bankName}</span>}</td>
        <td><span className="table-primary">{t(title.accountType === "PAYABLE" ? "A pagar" : "A receber")}</span><Link className="text-button" href={financialOriginHref(title.origin)}>{title.origin.number}</Link>{title.origin.type === "RENTAL" && <Link className="table-secondary text-button" href={`/rentals/${title.origin.id}?tab=documents`}>{title.origin.documentNumber}</Link>}<span className="table-secondary">{title.project.name}</span></td>
        <td>{formatDate(title.dueAt)}</td><td className="amount-cell">{formatMoney(title.amount)}</td><td className="amount-cell">{formatMoney(title.remaining)}</td><td><TitleStatus status={title.status} dueAt={title.dueAt} /></td>
        <td><div className="table-actions"><Link className="text-button" href={`/finance/titles/${title.id}`}>{t(canWrite ? "Editar título" : "Ver título")}</Link>{canWrite && (title.status === "OPEN" || title.status === "PARTIAL") && <Link className="text-button" href={title.accountType === "PAYABLE" ? `/finance/payables/${title.accountId}/pay` : `/finance/receivables/${title.accountId}/reconcile`}>{t(title.accountType === "PAYABLE" ? "Registrar pagamento" : "Conciliar")}</Link>}</div></td>
      </tr>)}</tbody>
    </table></div>}
    <p className="muted">{t("Os títulos acompanham o saldo e a situação da conta vinculada. O cadastro não altera os totais financeiros.")}</p>
  </div>;
}
