"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Boxes, ChartNoAxesCombined, CirclePlus, FileText, HardHat, Mail, Orbit, ReceiptText, Search, Settings, UsersRound, WalletCards, Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useLocale } from "@/modules/settings/components/preferences-provider";

type LauncherProps = { companyName: string; projectCount: number; customerCount: number; invoiceCount: number; payableCount: number; role: string };

export function ModuleLauncher({ companyName, projectCount, customerCount, invoiceCount, payableCount, role }: LauncherProps) {
  const { t, locale } = useLocale();
  const [search, setSearch] = useState("");
  const modules = [
    { title: t("Dashboard"), number: "01", href: "/dashboard", description: t("Enxergue o todo. Indicadores, receitas e os próximos passos da operação."), icon: ChartNoAxesCombined, tone: "lilac", tags: t("Indicadores · Resultados"), stat: t("Visão integrada") },
    { title: t("Faturamento"), number: "02", href: "/billing", description: t("Transforme o trabalho em resultado. Serviços, contratos e medições em um só lugar."), icon: ReceiptText, tone: "sand", tags: t("Serviços · Contratos"), stat: `${invoiceCount} ${invoiceCount === 1 ? t("serviço registrado") : t("serviços registrados")}` },
    { title: t("Financeiro"), number: "03", href: "/finance", description: t("Cuide de cada movimento. Acompanhe títulos e concilie os recebimentos."), icon: WalletCards, tone: "sage", tags: t("Contas · Conciliação"), stat: `${payableCount} ${payableCount === 1 ? t("pagamento em aberto") : t("pagamentos em aberto")}` },
    { title: t("Estoque"), number: "04", href: "/inventory", description: t("Os insumos certos, na hora certa. Produtos, saldos e movimentações por obra."), icon: Boxes, tone: "blue", tags: t("Produtos · Movimentações"), stat: t("Controle de materiais") },
    { title: t("Relatórios"), number: "05", href: "/reports", description: t("Desenhe seus documentos. Campos, tabelas e espaços para preencher após a impressão."), icon: FileText, tone: "lilac", tags: t("Modelos · Impressão"), stat: t("Documentos personalizados") },
    { title: t("Configurações"), number: "06", href: "/settings", description: t("Ajuste seu espaço de trabalho. Idioma, aparência e preferências de exibição."), icon: Settings, tone: "blue", tags: t("Idioma · Aparência"), stat: t("Suas preferências") },
    { title: t("Locações"), number: "07", href: "/rentals", description: t("Relacione equipamentos alugados, obras, locadoras e cobranças."), icon: Wrench, tone: "sand", tags: t("Obras · Equipamentos"), stat: t("Locadoras e documentos") },
    ...(["ADMIN", "ACCOUNTANT", "FINANCE"].includes(role) ? [{ title: t("Caixa de entrada"), number: "08", href: "/mail", description: t("Receba documentos do Gmail na caixa de entrada do sistema."), icon: Mail, tone: "blue", tags: t("E-mail · Documentos"), stat: t("Importar para revisão") }] : []),
  ];
  const filtered = modules.filter((module) => `${module.title} ${module.description} ${module.tags}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)));

  return <div className="page-stack launcher-page">
    <section className="welcome-island island"><div className="welcome-copy"><p className="section-label"><span className="tiny-star">✧</span>{" "}{t("SEU ESPAÇO DE TRABALHO")}</p><h1>{t("Mais clareza.")}<br /><span>{t("Novas possibilidades.")}</span></h1><p>{t("A operação da")}{" "}<strong>{companyName}</strong>{t(", conectada.")}<br />{t("Escolha um módulo e continue de onde precisa.")}</p><Link className="welcome-link" href="/dashboard">{t("Explorar meus resultados")}{" "}<ArrowRight size={17} /></Link></div><div className="orbital-scene" aria-hidden="true"><div className="orbit-ring orbit-one" /><div className="orbit-ring orbit-two" /><div className="orbit-ring orbit-three" /><div className="astral-sphere" /><span className="satellite satellite-one" /><span className="satellite satellite-two" /><span className="scene-star scene-star-one">✧</span><span className="scene-star scene-star-two">+</span><div className="orbit-caption"><span>V</span><small>{t("TUDO EM")}<br />{t("SEU LUGAR.")}</small></div></div></section>
    <section className="launcher-modules"><div className="module-section-heading"><div><p className="section-label">{t("CONECTADOS À SUA ROTINA")}</p><h2>{t("Seus módulos")}<span className="count-pill">{String(modules.length).padStart(2, "0")}</span></h2></div><label className="search-field"><Search size={17} /><input aria-label={t("Buscar módulo")} placeholder={t("Encontre um módulo...")} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <div className="module-grid">{filtered.map(({ title, number, href, description, icon: Icon, tone, tags, stat }) => <Link href={href} key={href} className="module-card island" data-tone={tone}><div className="module-card-top"><span className="module-icon"><Icon size={25} strokeWidth={1.4} /></span><span className="module-number">{number}</span></div><h3>{title}<ArrowUpRight size={20} /></h3><p>{description}</p><span className="module-tags">{tags}</span><div className="module-card-foot"><span>{stat}</span><span className="module-enter"><ArrowRight size={16} /></span></div></Link>)}</div>
      {!filtered.length && <div className="island"><EmptyState title={t("Nenhum módulo encontrado")} description={t("Tente buscar por faturamento, financeiro, estoque, relatórios, dashboard ou configurações.")} action={<button className="secondary-button" onClick={() => setSearch("")}>{t("Limpar busca")}</button>} /></div>}
    </section>
    <section className="registrations-island island"><div className="registration-symbol"><UsersRound size={25} strokeWidth={1.4} /></div><div className="registration-copy"><p className="section-label">{t("COMECE PELA BASE")}</p><h2>{t("Cadastros que conectam tudo.")}</h2><p>{t("Organize suas obras, clientes e fornecedores para dar os próximos passos.")}</p></div><div className="registration-counts"><span><strong>{projectCount}</strong>{" "}{t("obras ativas")}</span><span><strong>{customerCount}</strong>{" "}{t("clientes")}</span></div><Link href="/registrations" className="secondary-button">{t("Abrir cadastros")}{" "}<ArrowUpRight size={16} /></Link></section>
    <div className="launcher-bottom"><p><Orbit size={17} strokeWidth={1.3} />{" "}{t("Cada módulo, uma parte do mesmo universo.")}</p>{role !== "VIEWER" && <Link href="/registrations/projects/new"><CirclePlus size={16} /><HardHat size={16} />{" "}{t("Cadastrar a próxima obra")}</Link>}</div>
  </div>;
}
