"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { type BillingData } from "./types";

type Tab = "invoices" | "contracts" | "measurements";
const invoiceStatuses: Record<string, string> = { DRAFT: "Registrado", EXPORTED: "Exportado", ISSUED: "Emitido", CANCELLED: "Cancelado" };

export function BillingWorkspace({ data, role, initialTab = "invoices", recordId }: { data: BillingData; role: string; initialTab?: Tab; recordId?: string }) {
  const { t, locale, formatDate, formatMoney } = useLocale();
  const router = useRouter();
  const tab = initialTab;
  const [search, setSearch] = useState("");
  const canBill = ["ADMIN", "ACCOUNTANT", "FINANCE"].includes(role);
  const canContract = ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(role);
  const canMeasure = ["ADMIN", "ACCOUNTANT", "OPERATIONS"].includes(role);
  const query = search.trim().toLocaleLowerCase(locale);
  const matches = (...values: string[]) => values.some((value) => value.toLocaleLowerCase(locale).includes(query));
  const invoices = data.invoices.filter((invoice) => (!recordId || invoice.id === recordId) && matches(invoice.number, invoice.customer, invoice.project));
  const contracts = data.contracts.filter((contract) => (!recordId || contract.id === recordId) && matches(contract.number, contract.contractor, contract.project, contract.description));
  const measurements = data.measurements.filter((measurement) => (!recordId || measurement.id === recordId) && matches(measurement.contractNumber, measurement.contractor, measurement.project));
  const count = tab === "invoices" ? invoices.length : tab === "contracts" ? contracts.length : measurements.length;
  const canCreate = tab === "invoices" ? canBill : tab === "contracts" ? canContract : canMeasure;
  function setTab(nextTab: Tab) {
    router.push(`/billing?tab=${nextTab}`, { scroll: false });
  }

  return <div className="page-stack">
    <PageHeader eyebrow={t("Da execução à receita")} title={t("Faturamento")} description={t("Serviços, contratos e medições conectados ao financeiro.")} actions={canCreate ? <Link className="primary-button" href={`/billing/${tab}/new`}><Plus size={17} />{tab === "invoices" ? t("Registrar serviço") : tab === "contracts" ? t("Novo contrato") : t("Nova medição")}</Link> : undefined} />
    <div className="stats-row">
      <div className="mini-stat island"><span className="section-label">{t("Serviços registrados")}</span><strong>{formatMoney(data.invoices.filter((invoice) => invoice.status !== "CANCELLED").reduce((sum, invoice) => sum + Number(invoice.amount), 0))}</strong><small>{data.invoices.length}{" "}{t("registros de serviço")}</small></div>
      <div className="mini-stat island"><span className="section-label">{t("Valor contratado")}</span><strong>{formatMoney(data.contracts.reduce((sum, contract) => sum + Number(contract.amount), 0))}</strong><small>{data.contracts.length}{" "}{t("contratos cadastrados")}</small></div>
      <div className="mini-stat island"><span className="section-label">{t("Aguardando aprovação")}</span><strong>{data.measurements.filter((measurement) => !measurement.approved).length}</strong><small>{t("medições para revisar")}</small></div>
    </div>
    <section className="island panel">
      <div className="panel-heading"><div><span className="section-label">{t("Operação")}</span><h2>{t("Seu faturamento, organizado")}</h2></div><FileText size={22} aria-hidden="true" /></div>
      <div className="module-tabs" role="tablist" aria-label={t("Seções de faturamento")}>
        <button role="tab" id="billing-tab-invoices" aria-controls="billing-panel" aria-selected={tab === "invoices"} onClick={() => { setTab("invoices"); setSearch(""); }}>{t("Serviços")}{" "}<span>{data.invoices.length}</span></button>
        <button role="tab" id="billing-tab-contracts" aria-controls="billing-panel" aria-selected={tab === "contracts"} onClick={() => { setTab("contracts"); setSearch(""); }}>{t("Contratos")}{" "}<span>{data.contracts.length}</span></button>
        <button role="tab" id="billing-tab-measurements" aria-controls="billing-panel" aria-selected={tab === "measurements"} onClick={() => { setTab("measurements"); setSearch(""); }}>{t("Medições")}{" "}<span>{data.measurements.length}</span></button>
      </div>
      <div id="billing-panel" role="tabpanel" aria-labelledby={`billing-tab-${tab}`}>
        {recordId && <p className="muted reconciliation-hint">{t("Exibindo o registro vinculado.")}{" "}<button className="text-button" onClick={() => { setTab(tab); setSearch(""); }}>{t("Mostrar todos os registros")}</button></p>}
        <div className="toolbar"><label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label={t("Buscar no faturamento")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Buscar por referência, parceiro ou obra…")} /></label><span className="table-secondary">{count} {count === 1 ? t("registro") : t("registros")}</span></div>
        {count === 0 ? <EmptyState title={query ? t("Nenhum resultado encontrado") : tab === "invoices" ? t("Seu primeiro serviço começa aqui") : tab === "contracts" ? t("Organize seus contratos") : t("Acompanhe a execução dos contratos")} description={query ? t("Tente outro termo para localizar o registro.") : tab === "invoices" ? t("Cadastre um cliente e uma obra, depois registre o serviço para gerar a receita e a conta a receber.") : tab === "contracts" ? t("Cadastre o fornecedor, vincule uma obra e defina o valor do contrato.") : t("Registre o valor executado em um contrato. A aprovação da medição gera uma conta a pagar.")} action={query ? <button className="secondary-button" onClick={() => setSearch("")}>{t("Limpar busca")}</button> : <Link className="secondary-button" href={tab === "measurements" ? "/billing" : "/registrations"} onClick={tab === "measurements" ? (event) => { event.preventDefault(); setTab("contracts"); } : undefined}>{tab === "measurements" ? t("Ver contratos") : t("Abrir cadastros")}</Link>} /> : <div className="table-scroll">
          {tab === "invoices" && <table className="data-table"><thead><tr><th>{t("Serviço / cliente")}</th><th>{t("Obra")}</th><th>{t("Data")}</th><th>{t("Valor bruto")}</th><th>{t("Valor líquido")}</th><th>{t("Situação")}</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><span className="table-primary">{invoice.number}</span><span className="table-secondary">{invoice.customer}</span></td><td>{invoice.project}</td><td>{formatDate(invoice.serviceDate)}</td><td className="amount-cell">{formatMoney(invoice.amount)}</td><td className="amount-cell">{formatMoney(invoice.net)}</td><td><span className="status-badge" data-tone={invoice.status === "CANCELLED" ? "muted" : "accent"}>{t(invoiceStatuses[invoice.status] ?? invoice.status)}</span></td></tr>)}</tbody></table>}
          {tab === "contracts" && <table className="data-table"><thead><tr><th>{t("Contrato / prestador")}</th><th>{t("Obra")}</th><th>{t("Contratado")}</th><th>{t("Medido")}</th><th>{t("Saldo a medir")}</th><th><span className="sr-only">{t("Ações")}</span></th></tr></thead><tbody>{contracts.map((contract) => <tr key={contract.id}><td><span className="table-primary">{contract.number} · {contract.contractor}</span><span className="table-secondary">{contract.description}</span></td><td>{contract.project}</td><td className="amount-cell">{formatMoney(contract.amount)}</td><td className="amount-cell">{formatMoney(contract.measured)}</td><td className="amount-cell">{formatMoney(contract.remaining)}</td><td>{canMeasure && Number(contract.remaining) > 0 && <Link className="text-button" href={`/billing/measurements/new?contractId=${contract.id}`}>{t("Medir")}</Link>}</td></tr>)}</tbody></table>}
          {tab === "measurements" && <table className="data-table"><thead><tr><th>{t("Contrato / prestador")}</th><th>{t("Obra")}</th><th>{t("Data")}</th><th>{t("Valor")}</th><th>{t("Situação")}</th><th><span className="sr-only">{t("Ações")}</span></th></tr></thead><tbody>{measurements.map((measurement) => <tr key={measurement.id}><td><span className="table-primary">{measurement.contractNumber}</span><span className="table-secondary">{measurement.contractor}</span></td><td>{measurement.project}</td><td>{formatDate(measurement.measuredAt)}</td><td className="amount-cell">{formatMoney(measurement.amount)}</td><td><span className="status-badge" data-tone={measurement.approved ? "success" : "warning"}>{measurement.approved ? t("Aprovada") : t("Aguardando aprovação")}</span></td><td>{canBill && !measurement.approved && <Link className="text-button" href={`/billing/measurements/${measurement.id}/approve`}>{t("Aprovar")}</Link>}</td></tr>)}</tbody></table>}
        </div>}
      </div>
    </section>
  </div>;
}
