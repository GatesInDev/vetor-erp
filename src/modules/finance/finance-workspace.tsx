"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Search, Upload, Wallet } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { apiRequest } from "@/lib/client-api";
import { SettlementDialog, type Settlement } from "./settlement-dialog";
import { formatDate, formatMoney, isOverdue, type FinanceData } from "./types";

export type FinanceTab = "payables" | "receivables" | "reconciliation";
const tabs: { id: FinanceTab; label: string }[] = [{ id: "payables", label: "Contas a pagar" }, { id: "receivables", label: "Contas a receber" }, { id: "reconciliation", label: "Conciliação bancária" }];

export function FinanceWorkspace({ data, role, initialTab = "payables" }: { data: FinanceData; role: string; initialTab?: FinanceTab }) {
  const router = useRouter();
  const [tab, setTab] = useState<FinanceTab>(initialTab);
  const [search, setSearch] = useState("");
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const canWrite = ["ADMIN", "ACCOUNTANT", "FINANCE"].includes(role);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const matches = (...values: string[]) => values.some((value) => value.toLocaleLowerCase("pt-BR").includes(query));
  const payables = data.payables.filter((payable) => matches(payable.contractor, payable.contractNumber, payable.project));
  const receivables = data.receivables.filter((receivable) => matches(receivable.customer, receivable.invoiceNumber, receivable.project));
  const transactions = data.bankTransactions.filter((transaction) => matches(transaction.description, transaction.invoiceNumber ?? ""));
  const count = tab === "payables" ? payables.length : tab === "receivables" ? receivables.length : transactions.length;
  const openPayables = data.payables.filter((payable) => payable.status === "OPEN");
  const openReceivables = data.receivables.filter((receivable) => Number(receivable.remaining) > 0);

  async function importStatement(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setError("");
    setNotice("");
    if (file.size > 2_000_000) { setError("Selecione um arquivo OFX de até 2 MB."); return; }
    setBusy(true);
    try {
      const result = await apiRequest<{ transactionCount?: number; replayed?: boolean }>("/api/bank-statements/ofx", { method: "POST", rawBody: await file.text() });
      setNotice(result.replayed ? "Este extrato já foi importado. As transações continuam disponíveis para conferência." : `${result.transactionCount} transações importadas. Confira os créditos e concilie na aba Contas a receber.`);
      setTab("reconciliation");
      setSearch("");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível importar o extrato.");
    } finally { setBusy(false); }
  }

  function complete(message: string) { setSettlement(null); setNotice(message); setError(""); router.refresh(); }

  return <div className="page-stack">
    <PageHeader eyebrow="Clareza em cada movimento" title="Financeiro" description="Contas, recebimentos e conciliação em um só lugar." actions={canWrite ? <><a href="/api/exports/accounting" className="secondary-button"><Download size={16} />Exportar razão</a><button className="primary-button" disabled={busy} onClick={() => uploadInput.current?.click()}><Upload size={16} />{busy ? "Importando…" : "Importar OFX"}</button><input ref={uploadInput} className="sr-only" tabIndex={-1} aria-label="Arquivo OFX" type="file" accept=".ofx" onChange={importStatement} /></> : undefined} />
    <div className="stats-row">
      <div className="mini-stat island"><span>Contas a pagar</span><strong>{formatMoney(openPayables.reduce((sum, payable) => sum + Number(payable.amount), 0))}</strong><small>{openPayables.length} contas em aberto</small></div>
      <div className="mini-stat island"><span>Contas a receber</span><strong>{formatMoney(openReceivables.reduce((sum, receivable) => sum + Number(receivable.remaining), 0))}</strong><small>{openReceivables.length} recebimentos pendentes</small></div>
      <div className="mini-stat island"><span>Créditos a conciliar</span><strong>{data.bankTransactions.filter((transaction) => !transaction.reconciled && Number(transaction.amount) > 0).length}</strong><small>transações disponíveis no extrato</small></div>
    </div>
    {notice && <p className="form-success" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="island panel">
      <div className="panel-heading"><div><p className="section-label">Fluxo financeiro</p><h2>Acompanhe suas contas</h2></div><Wallet size={22} aria-hidden="true" /></div>
      <div className="module-tabs" role="tablist" aria-label="Seções do financeiro">{tabs.map((item) => <button key={item.id} id={`finance-tab-${item.id}`} role="tab" aria-controls="finance-panel" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setSearch(""); }}>{item.label}</button>)}</div>
      <div id="finance-panel" role="tabpanel" aria-labelledby={`finance-tab-${tab}`}>
        <div className="toolbar"><label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Buscar no financeiro" placeholder="Buscar por parceiro, obra ou referência…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><span className="table-secondary">{count} {count === 1 ? "registro" : "registros"}</span></div>
        {count === 0 ? <EmptyState title={query ? "Nenhum resultado encontrado" : tab === "payables" ? "Nenhuma conta a pagar" : tab === "receivables" ? "Nenhuma conta a receber" : "Seu extrato começa aqui"} description={query ? "Tente buscar por outro termo." : tab === "payables" ? "As contas são geradas ao aprovar medições de contratos em Faturamento." : tab === "receivables" ? "Registre um serviço em Faturamento para gerar uma conta a receber." : "Importe um arquivo OFX do seu banco para conferir as transações e vincular os recebimentos."} action={query ? <button className="secondary-button" onClick={() => setSearch("")}>Limpar busca</button> : tab === "reconciliation" ? canWrite && <button className="secondary-button" disabled={busy} onClick={() => uploadInput.current?.click()}>Importar extrato</button> : <Link className="secondary-button" href="/billing">Abrir faturamento</Link>} /> : <div className="table-scroll">
          {tab === "payables" && <table className="data-table"><thead><tr><th>Fornecedor / contrato</th><th>Obra</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{payables.map((payable) => <tr key={payable.id}><td><span className="table-primary">{payable.contractor}</span><span className="table-secondary">{payable.contractNumber}</span></td><td>{payable.project}</td><td>{formatDate(payable.dueAt)}</td><td className="amount-cell">{formatMoney(payable.amount)}</td><td><span className="status-badge" data-tone={payable.status === "PAID" ? "success" : payable.status === "CANCELLED" ? "muted" : isOverdue(payable.dueAt) ? "warning" : "accent"}>{payable.status === "PAID" ? "Pago" : payable.status !== "OPEN" ? "Cancelado" : isOverdue(payable.dueAt) ? "Vencido" : "Em aberto"}</span>{payable.paidAt && <span className="table-secondary">{formatDate(payable.paidAt)}</span>}</td><td>{canWrite && payable.status === "OPEN" && <button className="text-button" onClick={() => setSettlement({ type: "payment", payable })}>Registrar pagamento</button>}</td></tr>)}</tbody></table>}
          {tab === "receivables" && <table className="data-table"><thead><tr><th>Cliente / serviço</th><th>Vencimento</th><th>Valor líquido</th><th>Recebido</th><th>Em aberto</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{receivables.map((receivable) => <tr key={receivable.id}><td><span className="table-primary">{receivable.customer}</span><span className="table-secondary">{receivable.invoiceNumber} · {receivable.project}</span></td><td>{formatDate(receivable.dueAt)}</td><td className="amount-cell">{formatMoney(receivable.amount)}</td><td className="amount-cell">{formatMoney(receivable.received)}</td><td className="amount-cell">{formatMoney(receivable.remaining)}</td><td><span className="status-badge" data-tone={Number(receivable.remaining) <= 0 ? "success" : isOverdue(receivable.dueAt) ? "warning" : "accent"}>{Number(receivable.remaining) <= 0 ? "Recebido" : isOverdue(receivable.dueAt) ? "Vencido" : Number(receivable.received) > 0 ? "Parcial" : "Em aberto"}</span></td><td>{canWrite && Number(receivable.remaining) > 0 && <button className="text-button" onClick={() => setSettlement({ type: "receipt", receivable })}>Conciliar</button>}</td></tr>)}</tbody></table>}
          {tab === "reconciliation" && <><p className="muted reconciliation-hint">Vincule os créditos na aba <button className="text-button" onClick={() => { setTab("receivables"); setSearch(""); }}>Contas a receber</button>. Os débitos ficam disponíveis para conferência do extrato.</p><table className="data-table"><thead><tr><th>Transação</th><th>Data</th><th>Valor</th><th>Situação</th><th>Serviço vinculado</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td><span className="table-primary">{transaction.description}</span><span className="table-secondary">{Number(transaction.amount) > 0 ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />} {Number(transaction.amount) > 0 ? "Crédito" : "Débito"}</span></td><td>{formatDate(transaction.postedAt)}</td><td className="amount-cell">{formatMoney(transaction.amount)}</td><td><span className="status-badge" data-tone={transaction.reconciled ? "success" : Number(transaction.amount) > 0 ? "warning" : "muted"}>{transaction.reconciled ? "Conciliado" : Number(transaction.amount) > 0 ? "A conciliar" : "Conferência"}</span></td><td>{transaction.invoiceNumber ?? "—"}</td></tr>)}</tbody></table></>}
        </div>}
      </div>
    </section>
    {settlement && <SettlementDialog settlement={settlement} transactions={data.bankTransactions} onClose={() => setSettlement(null)} onSuccess={complete} />}
  </div>;
}
