"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from "react";
import { CheckCircle2, Circle, Home, X } from "lucide-react";
import { visitWorkspaceTab, workspaceTabAfterClose, workspaceTabKey, workspaceTabTitle, type WorkspaceTab } from "../tab-state";
import { WorkspaceScreenOutlet, useWorkspaceScreenKey, useWorkspaceScreens } from "./workspace-screen";
import { useLocale, usePreferences } from "@/modules/settings/components/preferences-provider";

type Draft = { values: unknown; baseline: unknown; dirty: boolean; mutationKey: string; pending: boolean; error: string };
type Notice = { message: string; destination: string };
type WorkspaceTabsContextValue = {
  activeKey: string;
  tabs: WorkspaceTab[];
  drafts: Record<string, Draft>;
  notice: Notice | null;
  pendingClose: string | null;
  renameTab: (key: string, title: string) => void;
  ensureDraft: (key: string, initialValues: unknown, mutationKey: string) => void;
  updateDraft: (key: string, update: (previous: unknown) => unknown, initialValues: unknown, mutationKey: string) => void;
  clearDraft: (key: string) => void;
  acceptValues: (key: string, values: unknown) => void;
  setPending: (key: string, pending: boolean) => void;
  setError: (key: string, error: string) => void;
  complete: (key: string, returnHref: string, message: string) => void;
  requestClose: (key: string) => void;
  confirmClose: () => void;
  cancelClose: () => void;
  dismissNotice: () => void;
};

const WorkspaceTabsContext = createContext<WorkspaceTabsContextValue | null>(null);

function tabElementId(key: string) {
  return `workspace-tab-${encodeURIComponent(key)}`;
}

function useWorkspaceTabs() {
  const context = useContext(WorkspaceTabsContext);
  if (!context) throw new Error("Workspace tabs provider is required");
  return context;
}

export function WorkspaceTabsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const { release, navigate, protect } = useWorkspaceScreens();
  const activeKey = workspaceTabKey(pathname, search);
  const activeHref = search ? `${pathname}?${search}` : pathname;
  const [storedTabs, setTabs] = useState<WorkspaceTab[]>([{ key: "/", href: "/", title: "Início" }]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingClose, setPendingClose] = useState<string | null>(null);
  const tabs = visitWorkspaceTab(storedTabs, { key: activeKey, href: activeHref, title: workspaceTabTitle(pathname) });
  const closingKey = useRef<string | null>(null);
  const currentKey = useRef(activeKey);
  useEffect(() => { currentKey.current = activeKey; }, [activeKey]);

  useEffect(() => {
    if (closingKey.current === activeKey) return;
    closingKey.current = null;
    setTabs((previous) => visitWorkspaceTab(previous, { key: activeKey, href: activeHref, title: workspaceTabTitle(pathname) }));
  }, [activeKey, activeHref, pathname]);

  const hasUnsavedChanges = Object.values(drafts).some((draft) => draft.dirty || draft.pending);
  useEffect(() => { protect(Object.entries(drafts).filter(([, draft]) => draft.dirty || draft.pending).map(([key]) => key)); }, [drafts, protect]);
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const renameTab = useCallback((key: string, title: string) => {
    setTabs((previous) => previous.some((tab) => tab.key === key)
      ? previous.map((tab) => tab.key === key && tab.title !== title ? { ...tab, title } : tab)
      : [...previous, { key, href: key, title }]);
  }, []);

  const ensureDraft = useCallback((key: string, initialValues: unknown, mutationKey: string) => {
    setDrafts((previous) => previous[key] ? previous : { ...previous, [key]: { values: initialValues, baseline: initialValues, mutationKey, dirty: false, pending: false, error: "" } });
  }, []);

  const updateDraft = useCallback((key: string, update: (previous: unknown) => unknown, initialValues: unknown, mutationKey: string) => {
    setDrafts((previous) => {
      const draft = previous[key] ?? { values: initialValues, baseline: initialValues, mutationKey, dirty: false, pending: false, error: "" };
      const values = update(draft.values);
      return { ...previous, [key]: { ...draft, values, dirty: JSON.stringify(values) !== JSON.stringify(draft.baseline) } };
    });
  }, []);

  const clearDraft = useCallback((key: string) => {
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }, []);

  const acceptValues = useCallback((key: string, values: unknown) => {
    setDrafts((previous) => ({ ...previous, [key]: { values, baseline: values, dirty: false, pending: false, error: "", mutationKey: crypto.randomUUID() } }));
  }, []);

  const setPending = useCallback((key: string, pending: boolean) => {
    setDrafts((previous) => previous[key] ? { ...previous, [key]: { ...previous[key], pending } } : previous);
  }, []);

  const setError = useCallback((key: string, error: string) => {
    setDrafts((previous) => previous[key] ? { ...previous, [key]: { ...previous[key], error } } : previous);
  }, []);

  function closeTab(key: string) {
    if (key === "/" || drafts[key]?.pending) return;
    if (key === activeKey) {
      closingKey.current = key;
      navigate(workspaceTabAfterClose(tabs, key));
    }
    setTabs((previous) => previous.filter((tab) => tab.key !== key));
    clearDraft(key);
    release(key);
    setPendingClose(null);
  }

  function requestClose(key: string) {
    if (drafts[key]?.dirty) setPendingClose(key);
    else closeTab(key);
  }

  function complete(key: string, returnHref: string, message: string) {
    clearDraft(key);
    release(key);
    closingKey.current = key;
    setTabs((previous) => previous.filter((tab) => tab.key !== key));
    setPendingClose(null);
    setNotice({ message, destination: returnHref.split("?")[0] });
    if (currentKey.current === key) navigate(returnHref);
    else router.refresh();
  }

  return <WorkspaceTabsContext.Provider value={{ activeKey, tabs, drafts, notice, pendingClose, renameTab, ensureDraft, updateDraft, clearDraft, acceptValues, setPending, setError, complete, requestClose, confirmClose: () => { if (pendingClose) closeTab(pendingClose); }, cancelClose: () => setPendingClose(null), dismissNotice: () => setNotice(null) }}>{children}</WorkspaceTabsContext.Provider>;
}

export function WorkspaceTabBar() {
  const { activeKey, tabs, drafts, pendingClose, requestClose, confirmClose, cancelClose } = useWorkspaceTabs();
  const { screens, navigate } = useWorkspaceScreens();
  const { t, locale } = useLocale();
  const { preferences } = usePreferences();
  const activeLink = useRef<HTMLAnchorElement>(null);
  const pendingTab = tabs.find((tab) => tab.key === pendingClose);

  useEffect(() => { activeLink.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [activeKey]);

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab") return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.key === activeKey);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    document.getElementById(tabElementId(next.key))?.focus();
    navigate(next.href);
  }

  return <div className="workspace-tabs-area">
    <div className="workspace-tabs-heading"><span>{t("Telas abertas")}</span><small>{screens.length}/{preferences.loadedScreenLimit} {t("telas prontas para alternar")}</small></div>
    <div className="workspace-tabs" role="tablist" aria-label={t("Telas abertas")} onKeyDown={navigateTabs}>
      {tabs.map((tab) => <div className={`workspace-tab ${tab.key === activeKey ? "is-active" : ""}`} key={tab.key} role="presentation">
        <Link ref={tab.key === activeKey ? activeLink : undefined} href={tab.href} prefetch={false} onClick={(event) => { if (!event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(tab.href); } }} role="tab" id={tabElementId(tab.key)} aria-controls="main-content" aria-selected={tab.key === activeKey} tabIndex={tab.key === activeKey ? 0 : -1} title={tab.title}>
          {tab.key === "/" && <Home size={17} aria-hidden="true" />}<span>{t(tab.title)}</span>{drafts[tab.key]?.dirty && <><Circle size={7} className="draft-indicator" aria-hidden="true" /><span className="sr-only">{t("Alterações não salvas")}</span></>}
        </Link>
        {tab.key !== "/" && <button type="button" className="workspace-tab-close" disabled={drafts[tab.key]?.pending} aria-label={`${locale === "en-US" ? "Close tab" : "Fechar aba"} ${t(tab.title)}`} onClick={() => requestClose(tab.key)}><X size={16} /></button>}
      </div>)}
    </div>
    {pendingTab && <div className="tab-close-confirmation" role="alert"><div><strong>{locale === "en-US" ? `Discard changes to “${t(pendingTab.title)}”?` : `Descartar as alterações de “${pendingTab.title}”?`}</strong><p>{t("Os campos preenchidos serão perdidos ao fechar esta aba.")}</p></div><div className="inline-actions"><button type="button" className="secondary-button" onClick={cancelClose}>{t("Manter aberta")}</button><button type="button" className="primary-button" onClick={confirmClose}>{t("Descartar e fechar")}</button></div></div>}
  </div>;
}

export function WorkspaceContent({ children }: { children: ReactNode }) {
  const { activeKey, notice, dismissNotice } = useWorkspaceTabs();
  const pathname = usePathname();
  return <main className="workspace-content" id="main-content" role="tabpanel" aria-labelledby={tabElementId(activeKey)}>
    {notice?.destination === pathname && <div className="workspace-notice form-success" role="status"><CheckCircle2 size={20} aria-hidden="true" /><p>{notice.message}</p><button type="button" className="icon-button" aria-label="Fechar mensagem" onClick={dismissNotice}><X size={17} /></button></div>}
    <WorkspaceScreenOutlet activeKey={activeKey}>{children}</WorkspaceScreenOutlet>
  </main>;
}

export function useFormDraft<T extends object>(initialValues: T, { title }: { title: string }) {
  const { activeKey, drafts, ensureDraft, updateDraft, clearDraft, acceptValues, setPending, setError, complete, renameTab } = useWorkspaceTabs();
  const screenKey = useWorkspaceScreenKey();
  const draftKey = screenKey ?? activeKey;
  const initial = useRef(initialValues);
  const generatedKey = useRef(crypto.randomUUID());
  const draft = drafts[draftKey];
  const values = (draft?.values ?? initial.current) as T;
  const acceptDraftValues = useCallback((next: T) => acceptValues(draftKey, next), [draftKey, acceptValues]);

  useEffect(() => { ensureDraft(draftKey, initial.current, generatedKey.current); }, [draftKey, ensureDraft]);
  useEffect(() => { renameTab(draftKey, title); }, [draftKey, title, renameTab]);
  useEffect(() => {
    initial.current = initialValues;
    if (draft && !draft.dirty && !draft.pending && JSON.stringify(draft.baseline) !== JSON.stringify(initialValues)) acceptValues(draftKey, initialValues);
  }, [initialValues, draft, draftKey, acceptValues]);

  const setValues: Dispatch<SetStateAction<T>> = (update) => {
    updateDraft(draftKey, (previous) => typeof update === "function" ? (update as (value: T) => T)(previous as T) : update, initial.current, generatedKey.current);
  };

  function setField<K extends keyof T>(key: K, value: T[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  return {
    values,
    setValues,
    setField,
    dirty: draft?.dirty ?? false,
    pending: draft?.pending ?? false,
    error: draft?.error ?? "",
    setError: (error: string) => setError(draftKey, error),
    setPending: (pending: boolean) => setPending(draftKey, pending),
    mutationKey: draft?.mutationKey ?? generatedKey.current,
    clearDraft: () => clearDraft(draftKey),
    acceptValues: acceptDraftValues,
    complete: (returnHref: string, message: string) => complete(draftKey, returnHref, message),
  };
}
