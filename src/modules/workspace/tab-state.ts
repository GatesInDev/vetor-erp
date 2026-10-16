export type WorkspaceTab = { key: string; href: string; title: string };

export const workspaceModules = [
  { href: "/", title: "Início" },
  { href: "/dashboard", title: "Dashboard" },
  { href: "/billing", title: "Faturamento" },
  { href: "/finance", title: "Financeiro" },
  { href: "/rentals", title: "Locações" },
  { href: "/mail", title: "Caixa de entrada" },
  { href: "/inventory", title: "Estoque" },
  { href: "/registrations", title: "Cadastros" },
  { href: "/reports", title: "Relatórios" },
  { href: "/settings", title: "Configurações" },
];

export function workspaceTabKey(pathname: string, search: string): string {
  if (workspaceModules.some((module) => module.href === pathname)) return pathname;
  const params = new URLSearchParams(search);
  params.sort();
  return params.size ? `${pathname}?${params}` : pathname;
}

export function workspaceTabTitle(pathname: string): string {
  const currentModule = workspaceModules.find((item) => item.href === pathname);
  if (currentModule) return currentModule.title;
  if (pathname === "/settings/email") return "Conexão de e-mail";
  if (pathname.startsWith("/mail/")) return "Revisar e-mail";
  if (pathname.startsWith("/registrations/projects/")) return pathname.endsWith("/new") ? "Nova obra" : "Editar obra";
  if (pathname.startsWith("/registrations/partners/")) return pathname.endsWith("/new") ? "Novo parceiro" : "Editar parceiro";
  if (pathname.startsWith("/inventory/products/")) return pathname.endsWith("/new") ? "Novo produto" : "Editar produto";
  if (pathname.startsWith("/inventory/movements/")) return "Movimentar estoque";
  if (pathname.startsWith("/billing/invoices/")) return "Registrar serviço";
  if (pathname.startsWith("/billing/contracts/")) return "Novo contrato";
  if (pathname.startsWith("/billing/measurements/")) return pathname.endsWith("/approve") ? "Aprovar medição" : "Nova medição";
  if (pathname.startsWith("/finance/payables/")) return pathname.endsWith("/pay") ? "Registrar pagamento" : "Conta a pagar";
  if (pathname.startsWith("/finance/receivables/")) return pathname.endsWith("/reconcile") ? "Conciliar recebimento" : "Conta a receber";
  if (pathname.startsWith("/finance/titles/")) return pathname.endsWith("/new") ? "Novo título" : "Título";
  if (pathname.startsWith("/rentals/")) return pathname.endsWith("/charges/new") ? "Registrar cobrança" : pathname === "/rentals/new" ? "Nova locação" : "Locação";
  if (pathname === "/reports/new") return "Novo relatório";
  if (pathname === "/reports/spreadsheets") return "Relatórios de planilhas";
  if (pathname === "/reports/balance-sheet") return "Balanço patrimonial";
  if (pathname === "/reports/trial-balance") return "Balancete";
  if (pathname.startsWith("/reports/") && pathname.endsWith("/edit")) return "Editar relatório";
  if (pathname.startsWith("/reports/") && pathname.endsWith("/preview")) return "Visualizar relatório";
  return "Área de trabalho";
}

export function visitWorkspaceTab(tabs: WorkspaceTab[], incoming: WorkspaceTab): WorkspaceTab[] {
  const existing = tabs.find((tab) => tab.key === incoming.key);
  if (!existing) return [...tabs, incoming];
  if (existing.href === incoming.href) return tabs;
  return tabs.map((tab) => tab.key === incoming.key ? { ...tab, href: incoming.href } : tab);
}

export function workspaceTabAfterClose(tabs: WorkspaceTab[], closingKey: string): string {
  const index = tabs.findIndex((tab) => tab.key === closingKey);
  return tabs[index - 1]?.href ?? tabs[index + 1]?.href ?? "/";
}
