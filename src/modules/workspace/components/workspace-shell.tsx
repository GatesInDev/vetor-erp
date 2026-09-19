"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Boxes, CircleHelp, Command, LayoutGrid, LogOut, Menu, Moon, Orbit, ReceiptText, Sparkles, Sun, UsersRound, WalletCards, X, ChartNoAxesCombined } from "lucide-react";

const navigation = [
  { href: "/", label: "Início", icon: LayoutGrid, caption: "Seu espaço de trabalho" },
  { href: "/dashboard", label: "Dashboard", icon: ChartNoAxesCombined, caption: "Uma visão da operação" },
  { href: "/billing", label: "Faturamento", icon: ReceiptText, caption: "Serviços, contratos e medições" },
  { href: "/finance", label: "Financeiro", icon: WalletCards, caption: "Recebimentos e pagamentos" },
  { href: "/inventory", label: "Estoque", icon: Boxes, caption: "Insumos e movimentações" },
  { href: "/registrations", label: "Cadastros", icon: UsersRound, caption: "A base da sua operação" },
];

const roleLabels: Record<string, string> = { ADMIN: "Administrador", ACCOUNTANT: "Contabilidade", FINANCE: "Financeiro", OPERATIONS: "Operações", VIEWER: "Consulta" };

export function WorkspaceShell({ companyName, email, role, children }: { companyName: string; email: string; role: string; children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState("dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const current = navigation.find((item) => item.href === pathname) ?? navigation[0];

  useEffect(() => {
    const saved = localStorage.getItem("vetor-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("vetor-theme", nextTheme);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      window.location.assign("/login");
    } catch { setLogoutError("Não foi possível sair. Tente novamente."); setLoggingOut(false); }
  }

  return <div className="workspace" data-theme={theme}>
    <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
    {menuOpen && <button className="navigation-backdrop" aria-label="Fechar navegação" onClick={() => setMenuOpen(false)} />}
    <aside className={`navigation-island ${menuOpen ? "is-open" : ""}`}>
      <Link href="/" className="wordmark" onClick={() => setMenuOpen(false)} aria-label="Vetor ERP · Início"><span className="brand-symbol"><Orbit size={28} strokeWidth={1.4} /></span><span>vetor<span className="wordmark-period">.</span><small>WORKSPACE</small></span></Link>
      <div className="organization"><div className="organization-avatar">{companyName.slice(0, 1).toUpperCase()}</div><div><small>SUA EMPRESA</small><strong title={companyName}>{companyName}</strong></div></div>
      <p className="navigation-label">EXPLORAR</p>
      <nav aria-label="Módulos da aplicação">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={pathname === href ? "page" : undefined} className={`navigation-link ${pathname === href ? "is-active" : ""}`}><Icon size={19} strokeWidth={1.65} /><span>{label}</span>{pathname === href && <span className="navigation-indicator" />}</Link>)}</nav>
      <div className="navigation-note"><Sparkles size={19} strokeWidth={1.3} /><strong>Tudo se conecta.</strong><p>Da primeira obra ao último lançamento.</p><Link href="/registrations" onClick={() => setMenuOpen(false)}>Organizar cadastros <ArrowUpRight size={15} /></Link></div>
      <div className="account-block"><div className="account-avatar">{email.slice(0, 2).toUpperCase()}</div><div><strong title={email}>{email.split("@")[0]}</strong><small>{roleLabels[role] ?? role}</small></div><button className="icon-button" title="Sair da conta" aria-label="Sair da conta" onClick={logout} disabled={loggingOut}><LogOut size={17} /></button></div>
      {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
    </aside>
    <div className="workspace-body">
      <header className="workspace-topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><span>Seu workspace</span><span className="breadcrumb-divider">/</span><strong>{current.label}</strong></div><div className="topbar-actions"><span className="workspace-caption"><Command size={14} /> A gestão ganha espaço.</span><button className="icon-button" aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><Link href="/" className="icon-button" title="Ver todos os módulos" aria-label="Ver todos os módulos"><CircleHelp size={18} /></Link></div></header>
      <main className="workspace-content" id="main-content">{children}</main>
      <footer className="workspace-footer"><span>VETOR <span className="footer-spark">✧</span> UM NOVO PONTO DE VISTA</span><span>Seu trabalho. Em órbita.</span></footer>
    </div>
  </div>;
}
