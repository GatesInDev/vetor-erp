"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/client-api";
import type { PartnerSummary, ProjectSummary } from "@/modules/registrations/types";
import { useLocale } from "@/modules/settings/components/preferences-provider";

type RegistrationTab = "projects" | "partners";

export function RegistrationsWorkspace({ projects, partners, canWrite, initialTab = "projects", recordId }: {
  projects: ProjectSummary[];
  partners: PartnerSummary[];
  canWrite: boolean;
  initialTab?: RegistrationTab;
  recordId?: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const tab = initialTab;
  function setTab(nextTab: RegistrationTab) { router.push(`/registrations?tab=${nextTab}`, { scroll: false }); }
  const [search, setSearch] = useState("");
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const searchTerm = search.toLocaleLowerCase(locale).trim();
  const filteredProjects = projects.filter((project) => (!recordId || project.id === recordId) && `${project.code} ${project.name}`.toLocaleLowerCase(locale).includes(searchTerm));
  const filteredPartners = partners.filter((partner) => (!recordId || partner.id === recordId) && partner.name.toLocaleLowerCase(locale).includes(searchTerm));

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === "Home" ? "projects" : event.key === "End" ? "partners" : tab === "projects" ? "partners" : "projects";
    setTab(nextTab);
    setSearch("");
    document.getElementById(`${nextTab}-tab`)?.focus();
  }

  async function toggleProject(project: ProjectSummary) {
    if (pendingProjectId) return;
    setPendingProjectId(project.id);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: { code: project.code, name: project.name, active: !project.active },
        idempotencyKey: crypto.randomUUID(),
      });
      setNotice(project.active ? t("Obra inativada. O histórico continua disponível.") : t("Obra ativada com sucesso."));
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Não foi possível alterar a situação da obra."));
    } finally {
      setPendingProjectId(null);
    }
  }

  const createAction = canWrite ? <Link className="primary-button" href={`/registrations/${tab}/new`}><Plus size={17} />{tab === "projects" ? t("Nova obra") : t("Novo cliente ou fornecedor")}</Link> : undefined;

  return <div className="page-stack">
    <PageHeader eyebrow={t("Organize a operação")} title={t("Cadastros")} description={t("Obras, clientes e fornecedores conectados à sua empresa.")} actions={createAction} />
    <div className="stats-row">
      <div className="island mini-stat"><Building2 size={19} /><span>{t("Obras ativas")}</span><strong>{projects.filter((project) => project.active).length}</strong></div>
      <div className="island mini-stat"><Users size={19} /><span>{t("Clientes")}</span><strong>{partners.filter((partner) => partner.customer).length}</strong></div>
      <div className="island mini-stat"><Users size={19} /><span>{t("Fornecedores")}</span><strong>{partners.filter((partner) => partner.supplier).length}</strong></div>
    </div>
    {notice && <p className="form-success" role="status">{t(notice)}</p>}
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <section className="island panel">
      <div className="toolbar">
        <div className="module-tabs" role="tablist" aria-label={t("Tipos de cadastro")} onKeyDown={navigateTabs}>
          <button type="button" id="projects-tab" role="tab" tabIndex={tab === "projects" ? 0 : -1} aria-controls="registrations-panel" aria-selected={tab === "projects"} onClick={() => { setTab("projects"); setSearch(""); }}><Building2 size={16} />{t("Obras")} <span>{projects.length}</span></button>
          <button type="button" id="partners-tab" role="tab" tabIndex={tab === "partners" ? 0 : -1} aria-controls="registrations-panel" aria-selected={tab === "partners"} onClick={() => { setTab("partners"); setSearch(""); }}><Users size={16} />{t("Clientes e fornecedores")} <span>{partners.length}</span></button>
        </div>
        <label className="search-field"><Search size={17} /><input aria-label={tab === "projects" ? t("Buscar obras") : t("Buscar clientes e fornecedores")} placeholder={tab === "projects" ? t("Buscar obra ou código...") : t("Buscar pelo nome...")} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      <div id="registrations-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
        {recordId && <p className="muted reconciliation-hint">{t("Exibindo o registro vinculado.")}{" "}<button className="text-button" onClick={() => { setTab(tab); setSearch(""); }}>{t("Mostrar todos os registros")}</button></p>}
        {tab === "projects" && (filteredProjects.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr><th>{t("Código")}</th><th>{t("Obra")}</th><th>{t("Situação")}</th>{canWrite && <th>{t("Ações")}</th>}</tr></thead>
          <tbody>{filteredProjects.map((project) => <tr key={project.id}><td><span className="table-code">{project.code}</span></td><td><strong>{project.name}</strong></td><td><span className="status-badge" data-tone={project.active ? "success" : "muted"}>{project.active ? t("Ativa") : t("Inativa")}</span></td>{canWrite && <td><div className="table-actions"><Link className="icon-button" aria-label={`${t("Editar obra")} ${project.name}`} href={`/registrations/projects/${project.id}`}><Pencil size={16} /></Link><button type="button" className="text-button" disabled={pendingProjectId !== null} onClick={() => toggleProject(project)}>{pendingProjectId === project.id ? t("Salvando...") : project.active ? t("Inativar") : t("Ativar")}</button></div></td>}</tr>)}</tbody>
        </table></div> : <EmptyState title={search ? t("Nenhuma obra encontrada") : t("Sua próxima obra começa aqui")} description={search ? t("Tente outro nome ou código na busca.") : t("Cadastre uma obra para vincular contratos, faturamento e movimentações de materiais.")} action={!search ? createAction : undefined} />)}
        {tab === "partners" && (filteredPartners.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr><th>{t("Nome ou razão social")}</th><th>{t("Perfil")}</th><th>{t("Documento")}</th>{canWrite && <th>{t("Ações")}</th>}</tr></thead>
          <tbody>{filteredPartners.map((partner) => <tr key={partner.id}><td><strong>{partner.name}</strong></td><td><div className="table-actions">{partner.customer && <span className="status-badge" data-tone="accent">{t("Cliente")}</span>}{partner.supplier && <span className="status-badge" data-tone="muted">{t("Fornecedor")}</span>}</div></td><td><span className="status-badge" data-tone={partner.hasTaxId ? "success" : "muted"}>{partner.hasTaxId ? t("Cadastrado") : t("Não informado")}</span></td>{canWrite && <td><Link className="icon-button" aria-label={`${t("Editar")} ${partner.name}`} href={`/registrations/partners/${partner.id}`}><Pencil size={16} /></Link></td>}</tr>)}</tbody>
        </table></div> : <EmptyState title={search ? t("Nenhum cadastro encontrado") : t("Boas relações, tudo organizado")} description={search ? t("Tente buscar por outro nome.") : t("Adicione seus clientes e fornecedores. Um mesmo cadastro pode ter os dois perfis.")} action={!search ? createAction : undefined} />)}
      </div>
    </section>
  </div>;
}
