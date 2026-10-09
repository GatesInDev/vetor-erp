"use client";

import { useLocale } from "@/modules/settings/components/preferences-provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowUpRight, Copy, FileText, Pencil, Plus, Printer, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { apiRequest } from "@/lib/client-api";
import { reportPresets } from "@/modules/reports/presets";
import { reportSources } from "@/modules/reports/sources";
import type { ReportTemplate } from "@/modules/reports/schema";

type PendingAction = { template: ReportTemplate; active: boolean; key: string };
type StatusFilter = "active" | "archived" | "all";

export function ReportCatalog({ templates, canWrite, canReadAccounting }: { templates: ReportTemplate[]; canWrite: boolean; canReadAccounting: boolean }) {
  const { t, locale, formatDate } = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ name: string; active: boolean } | null>(null);
  const inFlight = useRef(false);
  const searchTerm = search.trim().toLocaleLowerCase(locale);
  const filtered = templates.filter((template) => (
    (status === "all" || template.active === (status === "active")) &&
    `${template.name} ${template.description}`.toLocaleLowerCase(locale).includes(searchTerm)
  ));

  function requestStatusChange(template: ReportTemplate) {
    setPendingAction({ template, active: !template.active, key: crypto.randomUUID() });
    setError("");
    setNotice(null);
  }

  async function changeStatus() {
    if (!pendingAction || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const { template, active, key } = pendingAction;
    try {
      await apiRequest<{ template: ReportTemplate }>(`/api/report-templates/${template.id}`, {
        method: "PATCH",
        idempotencyKey: key,
        body: { name: template.name, description: template.description, definition: template.definition, revision: template.revision, active },
      });
      setNotice({ name: template.name, active });
      setPendingAction(null);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível atualizar o modelo. Tente novamente.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <div className="page-stack report-catalog">
    <PageHeader eyebrow={t("Documentos do seu jeito")} title={t("Relatórios")} description={t("Crie modelos para sua operação, organize os campos na folha e imprima com dados do sistema ou espaços para preencher à mão.")} actions={canWrite ? <Link className="primary-button" href="/reports/new"><Plus size={17} />{t("Novo modelo")}</Link> : undefined} />
    {notice && <p className="form-success" role="status">“{notice.name}” {t(notice.active ? "reativado com sucesso." : "arquivado com sucesso.")}</p>}
    {canReadAccounting && <section aria-labelledby="accounting-reports-title"><div className="module-section-heading"><div><p className="section-label">{t("DEMONSTRATIVOS CONTÁBEIS")}</p><h2 id="accounting-reports-title">{t("Da escrituração para os demonstrativos")}</h2></div></div><div className="accounting-report-cards">
      <Link className="island report-preset-card" href="/reports/balance-sheet"><FileText size={24} strokeWidth={1.5} /><h3>{t("Balanço patrimonial")}<ArrowUpRight size={17} /></h3><p>{t("Consulte ativos, passivos e patrimônio líquido em uma data de referência.")}</p><span>{t("Consultar demonstrativo")}</span></Link>
      <Link className="island report-preset-card" href="/reports/trial-balance"><FileText size={24} strokeWidth={1.5} /><h3>{t("Balancete de verificação")}<ArrowUpRight size={17} /></h3><p>{t("Confira saldos iniciais, débitos, créditos e saldos finais de cada conta no período.")}</p><span>{t("Consultar demonstrativo")}</span></Link>
    </div></section>}
    {canWrite && <section aria-labelledby="report-presets-title">
      <div className="module-section-heading"><div><p className="section-label">{t("UM PONTO DE PARTIDA")}</p><h2 id="report-presets-title">{t("Comece por um modelo")}</h2></div></div>
      <div className="report-preset-grid">{reportPresets.map((preset) => <Link className="island report-preset-card" key={preset.id} href={`/reports/new?preset=${preset.id}`}>
        <FileText size={24} strokeWidth={1.5} /><h3>{t(preset.label)}<ArrowUpRight size={17} /></h3><p>{t(preset.description)}</p><span>{t("Personalizar modelo")}</span>
      </Link>)}</div>
    </section>}
    <section className="island panel" aria-labelledby="report-templates-title">
      <div className="report-catalog-toolbar"><div><p className="section-label">{t("BIBLIOTECA DA EMPRESA")}</p><h2 id="report-templates-title">{t("Modelos salvos")} <span className="count-pill">{filtered.length}</span></h2></div>
        <label className="search-field"><Search size={17} /><input aria-label={t("Buscar modelos de relatório")} placeholder={t("Nome ou descrição...")} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="report-status-filter">{t("Situação")}<select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="active">{t("Ativos")}</option><option value="archived">{t("Arquivados")}</option><option value="all">{t("Todos")}</option></select></label>
      </div>
      {pendingAction && <div className="report-inline-confirmation" role="alert">
        <div><strong>{t(pendingAction.active ? "Reativar" : "Arquivar")} “{pendingAction.template.name}”?</strong><p>{t(pendingAction.active ? "O modelo voltará à lista de relatórios ativos." : "O modelo continuará disponível no filtro Arquivados e poderá ser reativado.")}</p></div>
        {error && <p className="form-error">{t(error)}</p>}
        <div className="report-template-actions"><button className="secondary-button" disabled={busy} onClick={() => { setPendingAction(null); setError(""); }}>{t("Cancelar")}</button><button className="primary-button" disabled={busy} onClick={changeStatus}>{t(busy ? "Salvando..." : pendingAction.active ? "Reativar modelo" : "Arquivar modelo")}</button></div>
      </div>}
      {filtered.length ? <div className="report-template-list">{filtered.map((template) => <article className="report-template-card" key={template.id}>
        <div className="report-template-summary"><div className="report-template-heading"><h3>{template.name}</h3><span className="status-badge" data-tone={template.active ? "success" : "muted"}>{t(template.active ? "Ativo" : "Arquivado")}</span></div><p>{template.description || t("Modelo personalizado da empresa.")}</p>
          <div className="report-template-meta"><span>{t(reportSources.find((source) => source.id === template.definition.source)?.label ?? "Documento livre")}</span><span>{template.definition.page.size === "LETTER" ? t("Carta") : "A4"} · {t(template.definition.page.orientation === "portrait" ? "Retrato" : "Paisagem")}</span><span>{t("Revisão")} {template.revision}</span><span>{t("Atualizado em")} {formatDate(template.updatedAt, { dateStyle: "medium", timeZone: "America/Sao_Paulo" })}</span></div>
        </div>
        <div className="report-template-actions">
          <Link className="secondary-button" href={`/reports/${template.id}/preview`} aria-label={`${t("Visualizar relatório")} ${template.name}`}><Printer size={16} />{t("Visualizar")}</Link>
          {canWrite && <><Link className="secondary-button" href={`/reports/${template.id}/edit`} aria-label={`${t("Editar modelo")} ${template.name}`}><Pencil size={16} />{t("Editar")}</Link><Link className="icon-button" href={`/reports/new?copy=${template.id}`} aria-label={`${t("Duplicar modelo")} ${template.name}`} title={t("Duplicar modelo")}><Copy size={17} /></Link><button className="icon-button" disabled={busy} onClick={() => requestStatusChange(template)} aria-label={`${t(template.active ? "Arquivar modelo" : "Reativar modelo")} ${template.name}`} title={t(template.active ? "Arquivar modelo" : "Reativar modelo")}>{template.active ? <Archive size={17} /> : <ArchiveRestore size={17} />}</button></>}
        </div>
      </article>)}</div> : <EmptyState title={t(searchTerm ? "Nenhum modelo encontrado" : status === "archived" ? "Nenhum modelo arquivado" : "Sua biblioteca está pronta para começar")} description={t(searchTerm ? "Tente outro nome ou escolha uma situação diferente." : status === "archived" ? "Os modelos arquivados aparecerão aqui." : "Salve seu primeiro modelo ou personalize uma ficha de abastecimento para sua rotina.")} action={searchTerm ? <button className="secondary-button" onClick={() => { setSearch(""); setStatus("all"); }}>{t("Limpar filtros")}</button> : canWrite && status !== "archived" ? <Link className="primary-button" href="/reports/new?preset=fuel">{t("Criar ficha de abastecimento")}</Link> : undefined} />}
    </section>
  </div>;
}
