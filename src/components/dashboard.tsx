"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowDownLeft, ArrowUpRight, Building2, ChevronDown, ClipboardList, LayoutDashboard, Moon, ReceiptText, Sun, Wallet, HardHat, Layers3, LogOut } from "lucide-react";

type DashboardData = {
  companyName: string; role: string; invoiceTotal: number; openReceivables: number; openPayables: number; projectCount: number;
  monthly: { label: string; value: number }[];
  projects: { id: string; code: string; name: string }[];
  tasks: { title: string; month: string }[];
  entries: { id: string; description: string; project: string; amount: number; date: string; source: string }[];
};

const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function Dashboard({ data }: { data: DashboardData }) {
  const [dark, setDark] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(...data.monthly.map((item) => item.value), 1);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return <div className={`app-shell ${dark ? "theme-dark" : "theme-light"}`}>
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-mark"><Layers3 size={21} /></span><span>vetor<span className="brand-dot">.</span><small>ERP</small></span></div>
      <div className="workspace-chip"><Building2 size={17} /><span><small>ESPAÇO DE TRABALHO</small><strong>{data.companyName}</strong></span><ChevronDown size={15} /></div>
      <p className="nav-caption">VISÃO GERAL</p>
      <nav aria-label="Navegação principal">
        <Link className="nav-item active" href="/"><LayoutDashboard size={18} /> Painel</Link>
        <a className="nav-item" href="#projects"><HardHat size={18} /> Obras</a>
        <a className="nav-item" href="#activity"><Activity size={18} /> Atividade</a>
        <a className="nav-item" href="#tasks"><ClipboardList size={18} /> Fechamento</a>
      </nav>
      <div className="sidebar-bottom"><div className="avatar">{data.companyName.slice(0, 2).toUpperCase()}</div><span><strong>Minha conta</strong><small>{data.role}</small></span><button onClick={logout} aria-label="Sair" className="icon-button"><LogOut size={18} /></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>Painel</strong></div><div className="top-actions"><span className="live-indicator"><i /> Dados em tempo real</span><button className="theme-button" onClick={() => setDark(!dark)} aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><p className="eyebrow">VISÃO EXECUTIVA</p><h1>Visão geral<span className="heading-dot">.</span></h1><p>Indicadores da operação e dos lançamentos da empresa.</p></div><div className="date-pill">Últimos 12 meses</div></div>
        <section className="metrics-grid" aria-label="Indicadores">
          <Metric icon={<ReceiptText size={19} />} label="Receita de serviços · 12 meses" value={currency(data.invoiceTotal)} note="Notas registradas" tone="purple" />
          <Metric icon={<ArrowDownLeft size={19} />} label="A receber" value={currency(data.openReceivables)} note="Saldo em aberto" tone="cyan" />
          <Metric icon={<ArrowUpRight size={19} />} label="A pagar" value={currency(data.openPayables)} note="Contratos em aberto" tone="orange" />
          <Metric icon={<HardHat size={19} />} label="Obras cadastradas" value={String(data.projectCount).padStart(2, "0")} note="Centros de custo" tone="green" />
        </section>
        <div className="primary-grid">
          <section className="island chart-card"><div className="card-heading"><div><p className="eyebrow">PERFORMANCE</p><h2>Faturamento de serviços</h2></div><span className="subtle-tag">12 MESES</span></div><div className="chart-summary">{currency(data.invoiceTotal)}<span>Receita registrada no período</span></div><div className="chart" role="img" aria-label="Faturamento mensal de serviços">{data.monthly.map((month, index) => <div className="bar-column" key={index}><div className="bar-track"><div className="bar" title={`${month.label}: ${currency(month.value)}`} style={{ height: `${Math.max(4, (month.value / max) * 100)}%` }} /></div><span>{month.label}</span></div>)}</div></section>
          <section className="island side-card" id="tasks"><div className="card-heading"><div><p className="eyebrow">ROTINA</p><h2>Fechamento mensal</h2></div><span className="side-icon"><ClipboardList size={18} /></span></div><p className="section-description">Acompanhe os documentos pendentes para o contador.</p><div className="task-list">{data.tasks.length ? data.tasks.map((task, index) => <div className="task-row" key={index}><span className="task-ring" /><span>{task.title}<small>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(task.month))}</small></span></div>) : <div className="empty-state">Nenhuma tarefa pendente cadastrada.</div>}</div><div className="side-foot"><span className="soft-dot" /> {data.tasks.length} pendência{data.tasks.length === 1 ? "" : "s"}</div></section>
        </div>
        <div className="secondary-grid">
          <section className="island activity-card" id="activity"><div className="card-heading"><div><p className="eyebrow">CONTABILIDADE</p><h2>Lançamentos recentes</h2></div><button className="text-button" onClick={() => setExpanded(!expanded)}>{expanded ? "Recolher" : "Ver detalhes"}<ChevronDown size={16} className={expanded ? "rotate" : ""} /></button></div><div className="activity-list">{data.entries.length ? data.entries.slice(0, expanded ? 7 : 4).map((entry) => <div className="activity-row" key={entry.id}><span className="activity-icon"><Wallet size={17} /></span><span className="activity-main"><strong>{entry.description}</strong><small>{entry.project} · {new Intl.DateTimeFormat("pt-BR").format(new Date(entry.date))}</small></span><strong className="activity-amount">{currency(entry.amount)}</strong></div>) : <div className="empty-state">Os lançamentos aparecerão aqui.</div>}</div></section>
          <section className="island projects-card" id="projects"><div className="card-heading"><div><p className="eyebrow">OPERAÇÃO</p><h2>Obras</h2></div><span className="side-icon"><HardHat size={18} /></span></div><div className="project-list">{data.projects.length ? data.projects.map((project, index) => <div className="project-row" key={project.id}><span className={`project-symbol project-${index % 4}`}><Building2 size={17} /></span><span><strong>{project.name}</strong><small>Centro de custo {project.code}</small></span><ArrowUpRight size={16} /></div>) : <div className="empty-state">Nenhuma obra cadastrada.</div>}</div></section>
        </div>
        <footer className="footer">VETOR ERP <span>·</span> Controle com clareza.</footer>
      </div>
    </main>
  </div>;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="island metric-card"><div className={`metric-icon tone-${tone}`}>{icon}</div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-note">{note}</span></div>;
}
