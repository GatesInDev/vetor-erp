"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Command, Menu, Moon, Settings, Sun } from "lucide-react";
import { WorkspaceContent, WorkspaceTabBar } from "./workspace-tabs";
import { NavigationDrawer } from "./navigation-drawer";
import { WorkspaceBreadcrumbs } from "./workspace-breadcrumbs";
import { useLocale, usePreferences } from "@/modules/settings/components/preferences-provider";

const roleLabels: Record<string, string> = { ADMIN: "Administrador", ACCOUNTANT: "Contabilidade", FINANCE: "Financeiro", OPERATIONS: "Operações", VIEWER: "Consulta" };

export function WorkspaceShell({ companyName, email, role, children }: { companyName: string; email: string; role: string; children: ReactNode }) {
  const { preferences, savePreferences } = usePreferences();
  const { t } = useLocale();
  const theme = preferences.theme;
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeError, setThemeError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const workspaceHeader = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    const header = workspaceHeader.current;
    const container = workspace.current;
    if (!header || !container) return;
    const updateHeaderHeight = () => container.style.setProperty("--workspace-header-height", `${header.getBoundingClientRect().height}px`);
    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  async function toggleTheme() {
    if (savingTheme) return;
    setSavingTheme(true);
    setThemeError("");
    try { await savePreferences({ theme: theme === "dark" ? "light" : "dark" }); }
    catch { setThemeError(t("Não foi possível salvar suas preferências. Tente novamente.")); }
    finally { setSavingTheme(false); }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.assign("/login");
    } catch { setLogoutError(t("Não foi possível sair. Tente novamente.")); setLoggingOut(false); }
  }

  return <div ref={workspace} className="workspace has-drawer" data-theme={theme}>
    <a className="skip-link" href="#main-content">{t("Ir para o conteúdo")}</a>
    {menuOpen && <NavigationDrawer companyName={companyName} email={email} role={role} roleLabel={t(roleLabels[role] ?? role)} loggingOut={loggingOut} logoutError={logoutError} onLogout={logout} onClose={closeMenu} triggerRef={menuTrigger} />}
    <div className="workspace-body" inert={menuOpen}>
      <div ref={workspaceHeader} className="workspace-header">
        <header className="workspace-topbar">
          <div className="workspace-navigation-path">
            <button type="button" ref={menuTrigger} className="icon-button drawer-toggle" aria-label={t("Abrir menu")} aria-controls="workspace-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
            <WorkspaceBreadcrumbs />
          </div>
          <div className="topbar-actions"><span className="workspace-caption"><Command size={14} />{t("A gestão ganha espaço.")}</span><button className="icon-button" disabled={savingTheme} aria-label={t(theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro")} onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><Link href="/settings" className="icon-button" title={t("Configurações")} aria-label={t("Configurações")}><Settings size={18} /></Link></div>
        </header>
        <WorkspaceTabBar />
        {themeError && <p className="form-error" role="alert">{themeError}</p>}
      </div>
      <WorkspaceContent>{children}</WorkspaceContent>
      <footer className="workspace-footer"><span>VETOR <span className="footer-spark">✧</span> {t("UM NOVO PONTO DE VISTA")}</span><span>{t("Seu trabalho. Em órbita.")}</span></footer>
    </div>
  </div>;
}
