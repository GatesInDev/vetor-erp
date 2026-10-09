"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Search, Settings } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { apiRequest } from "@/lib/client-api";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useWorkspaceScreenActive } from "@/modules/workspace/components/workspace-screen";
import type { MailMessageRow, MailSyncResult } from "../types";

type MessagePage = { messages: MailMessageRow[]; nextCursor: string | null };

export function MailWorkspace({ role }: { role: string }) {
  const { t, formatDate } = useLocale();
  const active = useWorkspaceScreenActive();
  const paginationRequest = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<MailMessageRow[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<MailSyncResult | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    paginationRequest.current?.abort();
    setLoadingMore(false);
    if (!active) return;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (status) params.set("status", status);
    setLoading(true);
    setError("");
    apiRequest<MessagePage>(`/api/mail/messages?${params}`, { signal: controller.signal }).then((result) => { setMessages(result.messages); setNextCursor(result.nextCursor); }).catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível carregar as mensagens."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); paginationRequest.current?.abort(); };
  }, [query, status, revision, active]);

  async function loadMore() {
    if (!nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    setError("");
    const controller = new AbortController();
    paginationRequest.current = controller;
    const params = new URLSearchParams({ cursor: nextCursor });
    if (query) params.set("search", query);
    if (status) params.set("status", status);
    try {
      const result = await apiRequest<MessagePage>(`/api/mail/messages?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setMessages((previous) => Array.from(new Map([...previous, ...result.messages].map((message) => [message.id, message])).values()));
      setNextCursor(result.nextCursor);
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : t("Não foi possível carregar as mensagens.")); }
    finally { if (!controller.signal.aborted) setLoadingMore(false); }
  }

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    setError("");
    setSyncResult(null);
    try {
      setSyncResult(await apiRequest<MailSyncResult>("/api/mail/sync", { method: "POST", body: {} }));
      setRevision((value) => value + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("Não foi possível sincronizar o e-mail.")); }
    finally { setSyncing(false); }
  }

  return <div className="page-stack">
    <PageHeader eyebrow={t("Documentos recebidos")} title={t("Caixa de revisão")} description={t("Confira os anexos recebidos e vincule as cobranças às locações e obras.")} actions={<div className="inline-actions">{role === "ADMIN" && <Link className="secondary-button" href="/settings/email"><Settings size={17} />{t("Configurar Gmail")}</Link>}<button type="button" className="primary-button" disabled={syncing} onClick={sync}><RefreshCw size={17} />{t(syncing ? "Sincronizando…" : "Sincronizar Gmail")}</button></div>} />
    {syncResult && <div className="island panel page-stack" role="status"><p>{t("Novas mensagens recebidas")}: <strong>{syncResult.imported}</strong> · {t("Mensagens ignoradas")}: <strong>{syncResult.skipped}</strong></p>{syncResult.hasMore && <p className="muted">{t("Ainda há mensagens para buscar. Sincronize novamente para continuar.")}</p>}</div>}
    <section className="island panel page-stack" aria-busy={loading}>
      <div className="toolbar"><label className="search-field"><Search size={17} /><input maxLength={120} aria-label={t("Buscar mensagens")} placeholder={t("Buscar por assunto ou remetente…")} value={search} disabled={loadingMore} onChange={(event) => setSearch(event.target.value)} /></label><label className="form-field">{t("Situação")}<select value={status} disabled={loadingMore} onChange={(event) => setStatus(event.target.value)}><option value="">{t("Todas as mensagens")}</option><option value="PENDING">{t("Com anexos para revisar")}</option><option value="IMPORTED">{t("Importadas")}</option></select></label><button className="secondary-button" type="button" disabled={loading || loadingMore} onClick={() => setRevision((value) => value + 1)}>{t("Atualizar lista")}</button></div>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      {loading ? <p className="muted" role="status">{t("Carregando mensagens…")}</p> : !messages.length ? <EmptyState title={t("Nenhuma mensagem encontrada")} description={t("Sincronize a conta configurada ou ajuste os filtros para consultar os documentos recebidos.")} /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>{t("Assunto / remetente")}</th><th>{t("Recebido em")}</th><th>{t("Anexos")}</th><th>{t("Situação")}</th><th>{t("Ações")}</th></tr></thead><tbody>{messages.map((message) => {
        const imported = message.importedAttachmentCount >= message.attachmentCount && message.attachmentCount > 0;
        return <tr key={message.id}><td><Link className="text-button table-primary" href={`/mail/${message.id}`}>{message.subject || t("Sem assunto")}</Link><span className="table-secondary">{message.from}</span></td><td>{formatDate(message.receivedAt, { dateStyle: "short", timeStyle: "short" })}</td><td>{message.importedAttachmentCount} / {message.attachmentCount}<span className="table-secondary">{t("anexos importados")}</span></td><td><span className="status-badge" data-tone={imported ? "success" : "accent"}>{t(imported ? "Importada" : message.importedAttachmentCount ? "Importação parcial" : "A revisar")}</span></td><td><Link className="text-button" href={`/mail/${message.id}`}>{t(imported ? "Ver mensagem" : "Revisar documentos")}</Link></td></tr>;
      })}</tbody></table></div>}
      {nextCursor && !loading && <div className="inline-actions"><button type="button" className="secondary-button" disabled={loadingMore} onClick={loadMore}>{t(loadingMore ? "Carregando…" : "Carregar mais mensagens")}</button></div>}
    </section>
  </div>;
}
