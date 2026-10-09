"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Search, Upload, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { apiRequest } from "@/lib/client-api";
import { isOverdue, type FinanceData } from "./types";
import { TitleList } from "./titles/components/title-list";
import type { TitleAccountType } from "./titles/types";
import { financialOriginHref, financialOriginLabel, financialOriginReference } from "./origin";

export type FinanceTab = "payables" | "receivables" | "titles" | "reconciliation";
const tabs: { id: FinanceTab; label: string }[] = [{ id: "payables", label: "Contas a pagar" }, { id: "receivables", label: "Contas a receber" }, { id: "titles", label: "Títulos" }, { id: "reconciliation", label: "Conciliação bancária" }];

export function FinanceWorkspace({ data, role, initialTab = "payables", recordId }: { data: FinanceData; role: string; initialTab?: FinanceTab; recordId?: string }) {
  const { t, locale, formatDate, formatMoney } = useLocale();
  const router = useRouter();
  const tab = initialTab;
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const canWrite = ["ADMIN", "ACCOUNTANT", "FINANCE"].includes(role);
  const query = search.trim().toLocaleLowerCase(locale);
  const matches = (...values: string[]) => values.some((value) => value.toLocaleLowerCase(locale).includes(query));
  const payables = data.payables.filter((payable) => (!recordId || payable.id === recordId) && matches(payable.contractor, financialOriginReference(payable.origin), payable.origin.type === "RENTAL" ? payable.origin.equipmentName : "", payable.project));
  const receivables = data.receivables.filter((receivable) => (!recordId || receivable.id === recordId) && matches(receivable.customer, receivable.invoiceNumber, receivable.project));
  const transactions = data.bankTransactions.filter((transaction) => matches(transaction.description, transaction.invoiceNumber ?? ""));
  const count = tab === "payables" ? payables.length : tab === "receivables" ? receivables.length : transactions.length;
  const openPayables = data.payables.filter((payable) => payable.status === "OPEN");
  const openReceivables = data.receivables.filter((receivable) => Number(receivable.remaining) > 0);
  const linkedTitles = new Map(data.titles.map((title) => [`${title.accountType}:${title.accountId}`, title]));

  function titleLink(accountType: TitleAccountType, accountId: string, allowCreate = true) {
    const title = linkedTitles.get(`${accountType}:${accountId}`);
    return title ? <Link className="text-button" href={`/finance/titles/${title.id}`}>{t("Ver título")}</Link> : canWrite && allowCreate ? <Link className="text-button" href={`/finance/titles/new?accountType=${accountType}&accountId=${accountId}`}>{t("Vincular título")}</Link> : null;
  }

  async function importStatement(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setError("");
    setNotice("");
    if (file.size > 2_000_000) { setError(t("Selecione um arquivo OFX de até 2 MB.")); return; }
    setBusy(true);
    try {
      const result = await apiRequest<{ transactionCount?: number; replayed?: boolean }>("/api/bank-statements/ofx", { method: "POST", rawBody: await file.text() });
      setNotice(result.replayed ? t("Este extrato já foi importado. As transações continuam disponíveis para conferência.") : `${result.transactionCount} ${t("transações importadas. Confira os créditos e concilie na aba Contas a receber.")}`);
      setTab("reconciliation");
      setSearch("");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Não foi possível importar o extrato."));
    } finally { setBusy(false); }
  }

  function setTab(nextTab: FinanceTab) { router.push(`/finance?tab=${nextTab}`, { scroll: false }); }

  return <div className="page-stack">
    <PageHeader eyebrow={t("Clareza em cada movimento")} title={t("Financeiro")} description={t("Contas, recebimentos e conciliação em um só lugar.")} actions={canWrite ? <><a href="/api/exports/accounting" className="secondary-button"><Download size={16} />{t("Exportar razão")}</a><button className="primary-button" disabled={busy} onClick={() => uploadInput.current?.click()}><Upload size={16} />{busy ? t("Importando…") : t("Importar OFX")}</button><input ref={uploadInput} className="sr-only" tabIndex={-1} aria-label={t("Arquivo OFX")} type="file" accept=".ofx" onChange={importStatement} /></> : undefined} />
    <div className="stats-row">
      <div className="mini-stat island"><span>{t("Contas a pagar")}</span><strong>{formatMoney(openPayables.reduce((sum, payable) => sum + Number(payable.amount), 0))}</strong><small>{openPayables.length}{" "}{t("contas em aberto")}</small></div>
      <div className="mini-stat island"><span>{t("Contas a receber")}</span><strong>{formatMoney(openReceivables.reduce((sum, receivable) => sum + Number(receivable.remaining), 0))}</strong><small>{openReceivables.length}{" "}{t("recebimentos pendentes")}</small></div>
      <div className="mini-stat island"><span>{t("Créditos a conciliar")}</span><strong>{data.bankTransactions.filter((transaction) => !transaction.reconciled && Number(transaction.amount) > 0).length}</strong><small>{t("transações disponíveis no extrato")}</small></div>
    </div>
    {notice && <p className="form-success" role="status">{t(notice)}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <section className="island panel">
      <div className="panel-heading"><div><p className="section-label">{t("Fluxo financeiro")}</p><h2>{t("Acompanhe suas contas")}</h2></div><Wallet size={22} aria-hidden="true" /></div>
      <div className="module-tabs" role="tablist" aria-label={t("Seções do financeiro")}>{tabs.map((item) => <button key={item.id} id={`finance-tab-${item.id}`} role="tab" aria-controls="finance-panel" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setSearch(""); }}>{t(item.label)}</button>)}</div>
      <div id="finance-panel" role="tabpanel" aria-labelledby={`finance-tab-${tab}`}>
        {tab === "titles" ? <TitleList titles={data.titles} canWrite={canWrite} /> : <>
        {recordId && <p className="muted reconciliation-hint">{t("Exibindo o registro vinculado.")}{" "}<button className="text-button" onClick={() => { setTab(tab); setSearch(""); }}>{t("Mostrar todos os registros")}</button></p>}
        <div className="toolbar"><label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label={t("Buscar no financeiro")} placeholder={t("Buscar por parceiro, obra ou referência…")} value={search} onChange={(event) => setSearch(event.target.value)} /></label><span className="table-secondary">{count} {count === 1 ? t("registro") : t("registros")}</span></div>
        {count === 0 ? <EmptyState title={query ? t("Nenhum resultado encontrado") : tab === "payables" ? t("Nenhuma conta a pagar") : tab === "receivables" ? t("Nenhuma conta a receber") : t("Seu extrato começa aqui")} description={query ? t("Tente buscar por outro termo.") : tab === "payables" ? t("As contas são geradas ao aprovar medições de contratos ou registrar documentos recebidos de locações.") : tab === "receivables" ? t("Registre um serviço em Faturamento para gerar uma conta a receber.") : t("Importe um arquivo OFX do seu banco para conferir as transações e vincular os recebimentos.")} action={query ? <button className="secondary-button" onClick={() => setSearch("")}>{t("Limpar busca")}</button> : tab === "reconciliation" ? canWrite && <button className="secondary-button" disabled={busy} onClick={() => uploadInput.current?.click()}>{t("Importar extrato")}</button> : <div className="inline-actions"><Link className="secondary-button" href="/billing">{t("Abrir faturamento")}</Link>{tab === "payables" && <Link className="secondary-button" href="/rentals">{t("Abrir locações")}</Link>}</div>} /> : <div className="table-scroll">
          {tab === "payables" && <table className="data-table"><thead><tr><th>{t("Fornecedor")}</th><th>{t("Origem")}</th><th>{t("Obra")}</th><th>{t("Vencimento")}</th><th>{t("Valor")}</th><th>{t("Situação")}</th><th><span className="sr-only">{t("Ações")}</span></th></tr></thead><tbody>{payables.map((payable) => <tr key={payable.id}><td><Link className="table-primary text-button" href={`/finance/payables/${payable.id}`}>{payable.contractor}</Link></td><td><Link className="text-button" href={financialOriginHref(payable.origin)}>{payable.origin.number}</Link><span className="table-secondary">{t(financialOriginLabel(payable.origin))}</span>{payable.origin.type === "RENTAL" && <Link className="table-secondary text-button" href={`/rentals/${payable.origin.id}?tab=documents`}>{payable.origin.documentNumber}</Link>}</td><td>{payable.project}</td><td>{formatDate(payable.dueAt)}</td><td className="amount-cell">{formatMoney(payable.amount)}</td><td><span className="status-badge" data-tone={payable.status === "PAID" ? "success" : payable.status === "CANCELLED" ? "muted" : isOverdue(payable.dueAt) ? "warning" : "accent"}>{payable.status === "PAID" ? t("Pago") : payable.status !== "OPEN" ? t("Cancelado") : isOverdue(payable.dueAt) ? t("Vencido") : t("Em aberto")}</span>{payable.paidAt && <span className="table-secondary">{formatDate(payable.paidAt)}</span>}</td><td><div className="table-actions">{canWrite && payable.status === "OPEN" && <Link className="text-button" href={`/finance/payables/${payable.id}/pay`}>{t("Registrar pagamento")}</Link>}{titleLink("PAYABLE", payable.id, payable.status !== "CANCELLED")}</div></td></tr>)}</tbody></table>}
          {tab === "receivables" && <table className="data-table"><thead><tr><th>{t("Cliente / serviço")}</th><th>{t("Vencimento")}</th><th>{t("Valor líquido")}</th><th>{t("Recebido")}</th><th>{t("Em aberto")}</th><th>{t("Situação")}</th><th><span className="sr-only">{t("Ações")}</span></th></tr></thead><tbody>{receivables.map((receivable) => <tr key={receivable.id}><td><Link className="table-primary text-button" href={`/finance/receivables/${receivable.id}`}>{receivable.customer}</Link><span className="table-secondary">{receivable.invoiceNumber} · {receivable.project}</span></td><td>{formatDate(receivable.dueAt)}</td><td className="amount-cell">{formatMoney(receivable.amount)}</td><td className="amount-cell">{formatMoney(receivable.received)}</td><td className="amount-cell">{formatMoney(receivable.remaining)}</td><td><span className="status-badge" data-tone={Number(receivable.remaining) <= 0 ? "success" : isOverdue(receivable.dueAt) ? "warning" : "accent"}>{Number(receivable.remaining) <= 0 ? t("Recebido") : isOverdue(receivable.dueAt) ? t("Vencido") : Number(receivable.received) > 0 ? t("Parcial") : t("Em aberto")}</span></td><td><div className="table-actions">{canWrite && Number(receivable.remaining) > 0 && <Link className="text-button" href={`/finance/receivables/${receivable.id}/reconcile`}>{t("Conciliar")}</Link>}{titleLink("RECEIVABLE", receivable.id, !receivable.sourceCancelled)}</div></td></tr>)}</tbody></table>}
          {tab === "reconciliation" && <><p className="muted reconciliation-hint">{t("Vincule os créditos na aba")}{" "}<button className="text-button" onClick={() => { setTab("receivables"); setSearch(""); }}>{t("Contas a receber")}</button>{t(". Os débitos ficam disponíveis para conferência do extrato.")}</p><table className="data-table"><thead><tr><th>{t("Transação")}</th><th>{t("Data")}</th><th>{t("Valor")}</th><th>{t("Situação")}</th><th>{t("Serviço vinculado")}</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td><span className="table-primary">{transaction.description}</span><span className="table-secondary">{Number(transaction.amount) > 0 ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />} {Number(transaction.amount) > 0 ? t("Crédito") : t("Débito")}</span></td><td>{formatDate(transaction.postedAt)}</td><td className="amount-cell">{formatMoney(transaction.amount)}</td><td><span className="status-badge" data-tone={transaction.reconciled ? "success" : Number(transaction.amount) > 0 ? "warning" : "muted"}>{transaction.reconciled ? t("Conciliado") : Number(transaction.amount) > 0 ? t("A conciliar") : t("Conferência")}</span></td><td>{transaction.invoiceNumber ?? "—"}</td></tr>)}</tbody></table></>}
        </div>}
        </>}
      </div>
    </section>
  </div>;
}
