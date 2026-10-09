"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { apiRequest } from "@/lib/client-api";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useWorkspaceScreenActive } from "@/modules/workspace/components/workspace-screen";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import type { MailConnectionView } from "../types";

function connectionValues(connection: MailConnectionView | null) {
  return {
    username: connection?.username ?? "", folder: connection?.folder ?? "INBOX", enabled: connection?.enabled ?? true,
    autoSync: connection?.autoSync ?? false, importSince: connection?.importSince.slice(0, 10) ?? new Date().toLocaleDateString("en-CA"),
    revision: connection?.revision,
  };
}

export function MailConnectionSettings() {
  const { t } = useLocale();
  const active = useWorkspaceScreenActive();
  const [connection, setConnection] = useState<MailConnectionView | null>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    apiRequest<{ connection: MailConnectionView | null }>("/api/mail/connection", { signal: controller.signal }).then((result) => { setConnection(result.connection); setError(""); }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível carregar a conexão de e-mail."); });
    return () => controller.abort();
  }, [attempt, active]);
  if (connection === undefined) return <section className="island panel page-stack" aria-busy={!error}><p role={error ? "alert" : "status"}>{t(error || "Carregando conexão de e-mail…")}</p>{error && <button type="button" className="secondary-button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>{t("Tentar novamente")}</button>}</section>;
  return <ConnectionForm connection={connection} onSaved={setConnection} />;
}

function ConnectionForm({ connection, onSaved }: { connection: MailConnectionView | null; onSaved: (connection: MailConnectionView) => void }) {
  const { t, formatDate } = useLocale();
  const active = useWorkspaceScreenActive();
  const passwordInput = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const draft = useFormDraft(connectionValues(connection), { title: t("E-mail da empresa") });

  useEffect(() => { if (!active && passwordInput.current) passwordInput.current.value = ""; }, [active]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.pending) return;
    const password = passwordInput.current?.value ?? "";
    if (passwordInput.current) passwordInput.current.value = "";
    draft.setPending(true);
    draft.setError("");
    setSaved(false);
    try {
      const result = await apiRequest<{ connection: MailConnectionView }>("/api/mail/connection", { method: "PUT", body: { ...draft.values, username: draft.values.username.trim(), folder: draft.values.folder.trim(), ...(password ? { password } : {}) } });
      onSaved(result.connection);
      draft.acceptValues(connectionValues(result.connection));
      setSaved(true);
    } catch (failure) { draft.setError(failure instanceof Error ? failure.message : t("Não foi possível salvar a conexão de e-mail.")); }
    finally { draft.setPending(false); }
  }

  return <FormPage title={t("E-mail da empresa")} description={t("Receba XML e PDF do Gmail em uma caixa de revisão antes de registrar as cobranças.")} backHref="/settings">
    <form className="page-stack" onSubmit={submit}>
      <FormSection title={t("Conexão com o Gmail")} description="imap.gmail.com · IMAP · TLS · 993">
        <label className="form-field">{t("Endereço do Gmail")}<input name="username" type="email" autoComplete="username" maxLength={254} required value={draft.values.username} disabled={draft.pending} onChange={(event) => draft.setField("username", event.target.value)} /></label>
        <label className="form-field">{t("Senha de app do Google")}<input ref={passwordInput} name="password" type="password" autoComplete="new-password" required={!connection?.hasPassword || draft.values.username.trim().toLowerCase() !== connection.username.toLowerCase()} disabled={draft.pending} maxLength={128} /><small>{t(connection?.hasPassword ? "Deixe em branco para manter a senha salva. Ao trocar de conta, informe uma nova senha de app." : "Use uma senha de app gerada na Conta Google.")}</small></label>
        <p className="muted full-width">{t("A senha digitada é limpa ao enviar ou sair desta aba. Ela não faz parte do rascunho.")}{" "}<a className="text-button" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">{t("Abrir senhas de app do Google")}</a></p>
        <label className="form-field">{t("Pasta de e-mail")}<input required maxLength={200} value={draft.values.folder} disabled={draft.pending} onChange={(event) => draft.setField("folder", event.target.value)} /><small>{t("Use INBOX para a caixa de entrada ou o nome da pasta que recebe os documentos.")}</small></label>
        <label className="form-field">{t("Importar mensagens desde")}<input type="date" required value={draft.values.importSince} disabled={draft.pending} onChange={(event) => draft.setField("importSince", event.target.value)} /></label>
      </FormSection>
      <FormSection title={t("Recebimento e revisão")} description={t("Os anexos recebidos ficam disponíveis para conferência. A conta a pagar é criada somente ao confirmar uma cobrança.")}>
        <label className="checkbox-field"><input type="checkbox" checked={draft.values.enabled} disabled={draft.pending} onChange={(event) => draft.setField("enabled", event.target.checked)} />{t("Conexão ativa")}</label>
        <label className="checkbox-field"><input type="checkbox" checked={draft.values.autoSync} disabled={draft.pending} onChange={(event) => draft.setField("autoSync", event.target.checked)} />{t("Receber documentos automaticamente")}</label>
        <p className="muted full-width">{t("A sincronização automática depende do agendamento configurado no servidor. Você também pode sincronizar pela caixa de entrada.")}</p>
        {connection?.lastSyncedAt && <div className="form-field"><span>{t("Última sincronização")}</span><strong>{formatDate(connection.lastSyncedAt, { dateStyle: "short", timeStyle: "short" })}</strong></div>}
        {connection?.syncing && <p className="muted full-width" role="status">{t("Sincronização em andamento…")}</p>}
        {connection?.lastSyncError && <p className="form-error full-width" role="alert">{t("Última sincronização não concluída")}: {connection.lastSyncError}</p>}
      </FormSection>
      {draft.error && <p className="form-error" role="alert">{t(draft.error)}</p>}
      {saved && !draft.dirty && <p className="form-success" role="status">{t("Conexão de e-mail salva.")}</p>}
      <div className="form-actions"><Link className="secondary-button" href="/mail">{t("Abrir caixa de revisão")}</Link><button className="primary-button" type="submit" disabled={draft.pending}>{t(draft.pending ? "Salvando…" : "Salvar conexão de e-mail")}</button></div>
    </form>
  </FormPage>;
}
