"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDialog } from "@/components/ui/form-dialog";
import { apiRequest } from "@/lib/client-api";
import type { PartnerSummary, ProjectSummary } from "@/modules/registrations/types";

type RegistrationTab = "projects" | "partners";
type Editor = { type: "projects"; item: ProjectSummary | null } | { type: "partners"; item: PartnerSummary | null };

export function RegistrationsWorkspace({ projects, partners, canWrite, initialTab = "projects", initialEditor = null }: {
  projects: ProjectSummary[];
  partners: PartnerSummary[];
  canWrite: boolean;
  initialTab?: RegistrationTab;
  initialEditor?: RegistrationTab | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<RegistrationTab>(initialTab);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(() => initialEditor ? { type: initialEditor, item: null } : null);
  const [busy, setBusy] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mutationKey = useRef("");
  const searchTerm = search.toLocaleLowerCase("pt-BR").trim();
  const filteredProjects = projects.filter((project) => `${project.code} ${project.name}`.toLocaleLowerCase("pt-BR").includes(searchTerm));
  const filteredPartners = partners.filter((partner) => partner.name.toLocaleLowerCase("pt-BR").includes(searchTerm));

  function openEditor(nextEditor: Editor) {
    mutationKey.current = crypto.randomUUID();
    setEditor(nextEditor);
    setError("");
    setNotice("");
  }

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === "Home" ? "projects" : event.key === "End" ? "partners" : tab === "projects" ? "partners" : "projects";
    setTab(nextTab);
    setSearch("");
    document.getElementById(`${nextTab}-tab`)?.focus();
  }

  async function saveRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    const form = new FormData(event.currentTarget);
    const taxId = String(form.get("taxId") ?? "").trim();
    if (editor.type === "partners" && taxId && (!/^[\d.\-/\s]+$/.test(taxId) || ![11, 14].includes(taxId.replace(/\D/g, "").length))) {
      setError("Informe um CPF com 11 dígitos ou um CNPJ com 14 dígitos.");
      return;
    }
    const body = editor.type === "projects"
      ? { code: String(form.get("code")).trim(), name: String(form.get("name")).trim(), active: form.get("active") === "on" }
      : { name: String(form.get("name")).trim(), customer: form.get("customer") === "on", supplier: form.get("supplier") === "on", ...(taxId ? { taxId: taxId.replace(/\D/g, "") } : {}) };
    if (editor.type === "partners" && !("customer" in body && (body.customer || body.supplier))) {
      setError("Selecione ao menos um perfil: cliente ou fornecedor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      mutationKey.current ||= crypto.randomUUID();
      await apiRequest(`/api/${editor.type}${editor.item ? `/${editor.item.id}` : ""}`, {
        method: editor.item ? "PATCH" : "POST",
        body,
        idempotencyKey: mutationKey.current,
      });
      setNotice(editor.item ? "Cadastro atualizado com sucesso." : "Cadastro criado com sucesso.");
      setEditor(null);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar o cadastro.");
    } finally {
      setBusy(false);
    }
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
      setNotice(project.active ? "Obra inativada. O histórico continua disponível." : "Obra ativada com sucesso.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível alterar a situação da obra.");
    } finally {
      setPendingProjectId(null);
    }
  }

  const createAction = canWrite ? <button type="button" className="primary-button" onClick={() => openEditor(tab === "projects" ? { type: "projects", item: null } : { type: "partners", item: null })}><Plus size={17} />{tab === "projects" ? "Nova obra" : "Novo cliente ou fornecedor"}</button> : undefined;

  return <div className="page-stack">
    <PageHeader eyebrow="Organize a operação" title="Cadastros" description="Obras, clientes e fornecedores conectados à sua empresa." actions={createAction} />
    <div className="stats-row">
      <div className="island mini-stat"><Building2 size={19} /><span>Obras ativas</span><strong>{projects.filter((project) => project.active).length}</strong></div>
      <div className="island mini-stat"><Users size={19} /><span>Clientes</span><strong>{partners.filter((partner) => partner.customer).length}</strong></div>
      <div className="island mini-stat"><Users size={19} /><span>Fornecedores</span><strong>{partners.filter((partner) => partner.supplier).length}</strong></div>
    </div>
    {notice && <p className="form-success" role="status">{notice}</p>}
    {!editor && error && <p className="form-error" role="alert">{error}</p>}
    <section className="island panel">
      <div className="toolbar">
        <div className="module-tabs" role="tablist" aria-label="Tipos de cadastro" onKeyDown={navigateTabs}>
          <button type="button" id="projects-tab" role="tab" tabIndex={tab === "projects" ? 0 : -1} aria-controls="registrations-panel" aria-selected={tab === "projects"} onClick={() => { setTab("projects"); setSearch(""); }}><Building2 size={16} />Obras <span>{projects.length}</span></button>
          <button type="button" id="partners-tab" role="tab" tabIndex={tab === "partners" ? 0 : -1} aria-controls="registrations-panel" aria-selected={tab === "partners"} onClick={() => { setTab("partners"); setSearch(""); }}><Users size={16} />Clientes e fornecedores <span>{partners.length}</span></button>
        </div>
        <label className="search-field"><Search size={17} /><input aria-label={tab === "projects" ? "Buscar obras" : "Buscar clientes e fornecedores"} placeholder={tab === "projects" ? "Buscar obra ou código..." : "Buscar pelo nome..."} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      <div id="registrations-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
        {tab === "projects" && (filteredProjects.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Código</th><th>Obra</th><th>Situação</th>{canWrite && <th>Ações</th>}</tr></thead>
          <tbody>{filteredProjects.map((project) => <tr key={project.id}><td><span className="table-code">{project.code}</span></td><td><strong>{project.name}</strong></td><td><span className="status-badge" data-tone={project.active ? "success" : "muted"}>{project.active ? "Ativa" : "Inativa"}</span></td>{canWrite && <td><div className="table-actions"><button type="button" className="icon-button" aria-label={`Editar obra ${project.name}`} onClick={() => openEditor({ type: "projects", item: project })}><Pencil size={16} /></button><button type="button" className="text-button" disabled={pendingProjectId !== null} onClick={() => toggleProject(project)}>{pendingProjectId === project.id ? "Salvando..." : project.active ? "Inativar" : "Ativar"}</button></div></td>}</tr>)}</tbody>
        </table></div> : <EmptyState title={search ? "Nenhuma obra encontrada" : "Sua próxima obra começa aqui"} description={search ? "Tente outro nome ou código na busca." : "Cadastre uma obra para vincular contratos, faturamento e movimentações de materiais."} action={!search ? createAction : undefined} />)}
        {tab === "partners" && (filteredPartners.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Nome ou razão social</th><th>Perfil</th><th>Documento</th>{canWrite && <th>Ações</th>}</tr></thead>
          <tbody>{filteredPartners.map((partner) => <tr key={partner.id}><td><strong>{partner.name}</strong></td><td><div className="table-actions">{partner.customer && <span className="status-badge" data-tone="accent">Cliente</span>}{partner.supplier && <span className="status-badge" data-tone="muted">Fornecedor</span>}</div></td><td><span className="status-badge" data-tone={partner.hasTaxId ? "success" : "muted"}>{partner.hasTaxId ? "Cadastrado" : "Não informado"}</span></td>{canWrite && <td><button type="button" className="icon-button" aria-label={`Editar ${partner.name}`} onClick={() => openEditor({ type: "partners", item: partner })}><Pencil size={16} /></button></td>}</tr>)}</tbody>
        </table></div> : <EmptyState title={search ? "Nenhum cadastro encontrado" : "Boas relações, tudo organizado"} description={search ? "Tente buscar por outro nome." : "Adicione seus clientes e fornecedores. Um mesmo cadastro pode ter os dois perfis."} action={!search ? createAction : undefined} />)}
      </div>
    </section>
    <FormDialog open={editor !== null} onClose={() => { if (!busy) setEditor(null); }} title={editor?.type === "projects" ? editor.item ? "Editar obra" : "Nova obra" : editor?.item ? "Editar cliente ou fornecedor" : "Novo cliente ou fornecedor"} description={editor?.type === "projects" ? "Use um código único para identificar a obra em toda a operação." : "Defina como este contato participa da sua operação."}>
      {editor && <form key={`${editor.type}-${editor.item?.id ?? "new"}`} className="form-grid" onSubmit={saveRegistration}>
        {editor.type === "projects" && <label className="form-field">Código<input name="code" required maxLength={60} defaultValue={editor.item?.code ?? ""} placeholder="OBR-001" disabled={busy} /></label>}
        <label className={`form-field ${editor.type === "partners" ? "full-width" : ""}`}>{editor.type === "projects" ? "Nome da obra" : "Nome ou razão social"}<input name="name" required maxLength={200} defaultValue={editor.item?.name ?? ""} placeholder={editor.type === "projects" ? "Residencial Horizonte" : "Nome da pessoa ou empresa"} disabled={busy} /></label>
        {editor.type === "projects" ? <label className="checkbox-field full-width"><input type="checkbox" name="active" defaultChecked={editor.item?.active ?? true} disabled={busy} /><span>Obra ativa<small>Obras inativas preservam todo o histórico.</small></span></label> : <>
          <label className="form-field full-width">CPF ou CNPJ <span className="field-optional">(opcional)</span><input name="taxId" inputMode="numeric" maxLength={18} placeholder={editor.item?.hasTaxId ? "Deixe em branco para manter o documento atual" : "Apenas números"} disabled={busy} /><small>O documento é armazenado de forma criptografada.</small></label>
          <fieldset className="form-field full-width"><legend>Perfil do cadastro</legend><div className="checkbox-options"><label className="checkbox-field"><input type="checkbox" name="customer" defaultChecked={editor.item?.customer ?? true} disabled={busy} />Cliente</label><label className="checkbox-field"><input type="checkbox" name="supplier" defaultChecked={editor.item?.supplier ?? false} disabled={busy} />Fornecedor</label></div></fieldset>
        </>}
        {error && <p className="form-error full-width" role="alert">{error}</p>}
        <div className="form-actions full-width"><button type="button" className="secondary-button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button type="submit" className="primary-button" disabled={busy}>{busy ? "Salvando..." : editor.item ? "Salvar alterações" : "Criar cadastro"}</button></div>
      </form>}
    </FormDialog>
  </div>;
}
