"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentDialog } from "./document-dialog";
import { MeasurementDialog } from "./measurement-dialog";
import { formatDate, formatMoney, type BillingData, type MeasurementRow } from "./types";

type Tab = "invoices" | "contracts" | "measurements";
type Dialog = "invoice" | "contract" | "measurement" | null;
const invoiceStatuses: Record<string, string> = { DRAFT: "Registrado", EXPORTED: "Exportado", ISSUED: "Emitido", CANCELLED: "Cancelado" };

export function BillingWorkspace({ data, role }: { data: BillingData; role: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("invoices");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>();
  const [approval, setApproval] = useState<MeasurementRow>();
  const [success, setSuccess] = useState("");
  const canBill = ["ADMIN", "ACCOUNTANT", "FINANCE"].includes(role);
  const canContract = ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(role);
  const canMeasure = ["ADMIN", "ACCOUNTANT", "OPERATIONS"].includes(role);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const matches = (...values: string[]) => values.some((value) => value.toLocaleLowerCase("pt-BR").includes(query));
  const invoices = data.invoices.filter((invoice) => matches(invoice.number, invoice.customer, invoice.project));
  const contracts = data.contracts.filter((contract) => matches(contract.number, contract.contractor, contract.project, contract.description));
  const measurements = data.measurements.filter((measurement) => matches(measurement.contractNumber, measurement.contractor, measurement.project));
  const count = tab === "invoices" ? invoices.length : tab === "contracts" ? contracts.length : measurements.length;
  const canCreate = tab === "invoices" ? canBill : tab === "contracts" ? canContract : canMeasure;
  const openDialog = () => { setSelectedContractId(undefined); setDialog(tab === "invoices" ? "invoice" : tab === "contracts" ? "contract" : "measurement"); };

  function complete(message: string) {
    setDialog(null);
    setApproval(undefined);
    setSuccess(message);
    router.refresh();
  }

  return <div className="page-stack">
    <PageHeader eyebrow="Da execução à receita" title="Faturamento" description="Serviços, contratos e medições conectados ao financeiro." actions={canCreate ? <button className="primary-button" onClick={openDialog}><Plus size={17} />{tab === "invoices" ? "Registrar serviço" : tab === "contracts" ? "Novo contrato" : "Nova medição"}</button> : undefined} />
    <div className="stats-row">
      <div className="mini-stat island"><span className="section-label">Serviços registrados</span><strong>{formatMoney(data.invoices.filter((invoice) => invoice.status !== "CANCELLED").reduce((sum, invoice) => sum + Number(invoice.amount), 0))}</strong><small>{data.invoices.length} registros de serviço</small></div>
      <div className="mini-stat island"><span className="section-label">Valor contratado</span><strong>{formatMoney(data.contracts.reduce((sum, contract) => sum + Number(contract.amount), 0))}</strong><small>{data.contracts.length} contratos cadastrados</small></div>
      <div className="mini-stat island"><span className="section-label">Aguardando aprovação</span><strong>{data.measurements.filter((measurement) => !measurement.approved).length}</strong><small>medições para revisar</small></div>
    </div>
    {success && <p className="form-success" role="status">{success}</p>}
    <section className="island panel">
      <div className="panel-heading"><div><span className="section-label">Operação</span><h2>Seu faturamento, organizado</h2></div><FileText size={22} aria-hidden="true" /></div>
      <div className="module-tabs" role="tablist" aria-label="Seções de faturamento">
        <button role="tab" id="billing-tab-invoices" aria-controls="billing-panel" aria-selected={tab === "invoices"} onClick={() => { setTab("invoices"); setSearch(""); }}>Serviços <span>{data.invoices.length}</span></button>
        <button role="tab" id="billing-tab-contracts" aria-controls="billing-panel" aria-selected={tab === "contracts"} onClick={() => { setTab("contracts"); setSearch(""); }}>Contratos <span>{data.contracts.length}</span></button>
        <button role="tab" id="billing-tab-measurements" aria-controls="billing-panel" aria-selected={tab === "measurements"} onClick={() => { setTab("measurements"); setSearch(""); }}>Medições <span>{data.measurements.length}</span></button>
      </div>
      <div id="billing-panel" role="tabpanel" aria-labelledby={`billing-tab-${tab}`}>
        <div className="toolbar"><label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Buscar no faturamento" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por referência, parceiro ou obra…" /></label><span className="table-secondary">{count} {count === 1 ? "registro" : "registros"}</span></div>
        {count === 0 ? <EmptyState title={query ? "Nenhum resultado encontrado" : tab === "invoices" ? "Seu primeiro serviço começa aqui" : tab === "contracts" ? "Organize seus contratos" : "Acompanhe a execução dos contratos"} description={query ? "Tente outro termo para localizar o registro." : tab === "invoices" ? "Cadastre um cliente e uma obra, depois registre o serviço para gerar a receita e a conta a receber." : tab === "contracts" ? "Cadastre o fornecedor, vincule uma obra e defina o valor do contrato." : "Registre o valor executado em um contrato. A aprovação da medição gera uma conta a pagar."} action={query ? <button className="secondary-button" onClick={() => setSearch("")}>Limpar busca</button> : <Link className="secondary-button" href={tab === "measurements" ? "/billing" : "/registrations"} onClick={tab === "measurements" ? (event) => { event.preventDefault(); setTab("contracts"); } : undefined}>{tab === "measurements" ? "Ver contratos" : "Abrir cadastros"}</Link>} /> : <div className="table-scroll">
          {tab === "invoices" && <table className="data-table"><thead><tr><th>Serviço / cliente</th><th>Obra</th><th>Data</th><th>Valor bruto</th><th>Valor líquido</th><th>Situação</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><span className="table-primary">{invoice.number}</span><span className="table-secondary">{invoice.customer}</span></td><td>{invoice.project}</td><td>{formatDate(invoice.serviceDate)}</td><td className="amount-cell">{formatMoney(invoice.amount)}</td><td className="amount-cell">{formatMoney(invoice.net)}</td><td><span className="status-badge" data-tone={invoice.status === "CANCELLED" ? "muted" : "accent"}>{invoiceStatuses[invoice.status] ?? invoice.status}</span></td></tr>)}</tbody></table>}
          {tab === "contracts" && <table className="data-table"><thead><tr><th>Contrato / prestador</th><th>Obra</th><th>Contratado</th><th>Medido</th><th>Saldo a medir</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{contracts.map((contract) => <tr key={contract.id}><td><span className="table-primary">{contract.number} · {contract.contractor}</span><span className="table-secondary">{contract.description}</span></td><td>{contract.project}</td><td className="amount-cell">{formatMoney(contract.amount)}</td><td className="amount-cell">{formatMoney(contract.measured)}</td><td className="amount-cell">{formatMoney(contract.remaining)}</td><td>{canMeasure && Number(contract.remaining) > 0 && <button className="text-button" onClick={() => { setSelectedContractId(contract.id); setDialog("measurement"); }}>Medir</button>}</td></tr>)}</tbody></table>}
          {tab === "measurements" && <table className="data-table"><thead><tr><th>Contrato / prestador</th><th>Obra</th><th>Data</th><th>Valor</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{measurements.map((measurement) => <tr key={measurement.id}><td><span className="table-primary">{measurement.contractNumber}</span><span className="table-secondary">{measurement.contractor}</span></td><td>{measurement.project}</td><td>{formatDate(measurement.measuredAt)}</td><td className="amount-cell">{formatMoney(measurement.amount)}</td><td><span className="status-badge" data-tone={measurement.approved ? "success" : "warning"}>{measurement.approved ? "Aprovada" : "Aguardando aprovação"}</span></td><td>{canBill && !measurement.approved && <button className="text-button" onClick={() => setApproval(measurement)}>Aprovar</button>}</td></tr>)}</tbody></table>}
        </div>}
      </div>
    </section>
    {(dialog === "invoice" || dialog === "contract") && <DocumentDialog kind={dialog} partners={dialog === "invoice" ? data.customers : data.suppliers} projects={data.projects} onClose={() => setDialog(null)} onSuccess={complete} />}
    {(dialog === "measurement" || approval) && <MeasurementDialog contracts={data.contracts} measurement={approval} initialContractId={selectedContractId} onClose={() => { setDialog(null); setApproval(undefined); }} onSuccess={complete} />}
  </div>;
}
