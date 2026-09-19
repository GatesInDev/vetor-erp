"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Boxes, ChartNoAxesCombined, CirclePlus, HardHat, Orbit, ReceiptText, Search, UsersRound, WalletCards } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

type LauncherProps = { companyName: string; projectCount: number; customerCount: number; invoiceCount: number; payableCount: number; role: string };

export function ModuleLauncher({ companyName, projectCount, customerCount, invoiceCount, payableCount, role }: LauncherProps) {
  const [search, setSearch] = useState("");
  const modules = [
    { title: "Dashboard", number: "01", href: "/dashboard", description: "Enxergue o todo. Indicadores, receitas e os próximos passos da operação.", icon: ChartNoAxesCombined, tone: "lilac", tags: "Indicadores · Resultados", stat: "Visão integrada" },
    { title: "Faturamento", number: "02", href: "/billing", description: "Transforme o trabalho em resultado. Serviços, contratos e medições em um só lugar.", icon: ReceiptText, tone: "sand", tags: "Serviços · Contratos", stat: `${invoiceCount} serviço${invoiceCount === 1 ? "" : "s"} registrado${invoiceCount === 1 ? "" : "s"}` },
    { title: "Financeiro", number: "03", href: "/finance", description: "Cuide de cada movimento. Acompanhe títulos e concilie os recebimentos.", icon: WalletCards, tone: "sage", tags: "Contas · Conciliação", stat: `${payableCount} pagamento${payableCount === 1 ? "" : "s"} em aberto` },
    { title: "Estoque", number: "04", href: "/inventory", description: "Os insumos certos, na hora certa. Produtos, saldos e movimentações por obra.", icon: Boxes, tone: "blue", tags: "Produtos · Movimentações", stat: "Controle de materiais" },
  ];
  const filtered = modules.filter((module) => `${module.title} ${module.description} ${module.tags}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));

  return <div className="page-stack launcher-page">
    <section className="welcome-island island"><div className="welcome-copy"><p className="section-label"><span className="tiny-star">✧</span> SEU ESPAÇO DE TRABALHO</p><h1>Mais clareza.<br /><span>Novas possibilidades.</span></h1><p>A operação da <strong>{companyName}</strong>, conectada.<br />Escolha um módulo e continue de onde precisa.</p><Link className="welcome-link" href="/dashboard">Explorar meus resultados <ArrowRight size={17} /></Link></div><div className="orbital-scene" aria-hidden="true"><div className="orbit-ring orbit-one" /><div className="orbit-ring orbit-two" /><div className="orbit-ring orbit-three" /><div className="astral-sphere" /><span className="satellite satellite-one" /><span className="satellite satellite-two" /><span className="scene-star scene-star-one">✧</span><span className="scene-star scene-star-two">+</span><div className="orbit-caption"><span>V</span><small>TUDO EM<br />SEU LUGAR.</small></div></div></section>
    <section className="launcher-modules"><div className="module-section-heading"><div><p className="section-label">CONECTADOS À SUA ROTINA</p><h2>Seus módulos<span className="count-pill">04</span></h2></div><label className="search-field"><Search size={17} /><input aria-label="Buscar módulo" placeholder="Encontre um módulo..." value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <div className="module-grid">{filtered.map(({ title, number, href, description, icon: Icon, tone, tags, stat }) => <Link href={href} key={href} className="module-card island" data-tone={tone}><div className="module-card-top"><span className="module-icon"><Icon size={25} strokeWidth={1.4} /></span><span className="module-number">{number}</span></div><h3>{title}<ArrowUpRight size={20} /></h3><p>{description}</p><span className="module-tags">{tags}</span><div className="module-card-foot"><span>{stat}</span><span className="module-enter"><ArrowRight size={16} /></span></div></Link>)}</div>
      {!filtered.length && <div className="island"><EmptyState title="Nenhum módulo encontrado" description="Tente buscar por faturamento, financeiro, estoque ou dashboard." action={<button className="secondary-button" onClick={() => setSearch("")}>Limpar busca</button>} /></div>}
    </section>
    <section className="registrations-island island"><div className="registration-symbol"><UsersRound size={25} strokeWidth={1.4} /></div><div className="registration-copy"><p className="section-label">COMECE PELA BASE</p><h2>Cadastros que conectam tudo.</h2><p>Organize suas obras, clientes e fornecedores para dar os próximos passos.</p></div><div className="registration-counts"><span><strong>{projectCount}</strong> obras ativas</span><span><strong>{customerCount}</strong> clientes</span></div><Link href="/registrations" className="secondary-button">Abrir cadastros <ArrowUpRight size={16} /></Link></section>
    <div className="launcher-bottom"><p><Orbit size={17} strokeWidth={1.3} /> Cada módulo, uma parte do mesmo universo.</p>{role !== "VIEWER" && <Link href="/registrations?tab=projects&new=true"><CirclePlus size={16} /><HardHat size={16} /> Cadastrar a próxima obra</Link>}</div>
  </div>;
}
