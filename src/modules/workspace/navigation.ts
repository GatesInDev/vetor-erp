import { Boxes, ChartNoAxesCombined, FileText, LayoutGrid, Mail, ReceiptText, Settings, UsersRound, WalletCards, Wrench, type LucideIcon } from "lucide-react";

export type WorkspaceNavigationItem = {
  label: string;
  href: string;
  roles?: string[];
};

export type WorkspaceNavigationModule = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
  items?: WorkspaceNavigationItem[];
};

const managementRoles = ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"];
const financialRoles = ["ADMIN", "ACCOUNTANT", "FINANCE"];
const financialReportRoles = [...financialRoles, "VIEWER"];
const measurementRoles = ["ADMIN", "ACCOUNTANT", "OPERATIONS"];

export const workspaceNavigation: WorkspaceNavigationModule[] = [
  { id: "home", label: "Início", href: "/", icon: LayoutGrid },
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: ChartNoAxesCombined },
  { id: "settings", label: "Configurações", href: "/settings", icon: Settings, items: [
    { label: "Preferências pessoais", href: "/settings" },
    { label: "Conexão de e-mail", href: "/settings/email", roles: ["ADMIN"] },
  ] },
  { id: "mail", label: "Caixa de entrada", href: "/mail", icon: Mail, roles: financialRoles, items: [
    { label: "Documentos recebidos", href: "/mail", roles: financialRoles },
    { label: "Conexão de e-mail", href: "/settings/email", roles: ["ADMIN"] },
  ] },
  {
    id: "billing",
    label: "Faturamento",
    href: "/billing",
    icon: ReceiptText,
    items: [
      { label: "Serviços", href: "/billing?tab=invoices" },
      { label: "Contratos", href: "/billing?tab=contracts" },
      { label: "Medições", href: "/billing?tab=measurements" },
      { label: "Registrar serviço", href: "/billing/invoices/new", roles: financialRoles },
      { label: "Novo contrato", href: "/billing/contracts/new", roles: managementRoles },
      { label: "Nova medição", href: "/billing/measurements/new", roles: measurementRoles },
    ],
  },
  {
    id: "finance",
    label: "Financeiro",
    href: "/finance",
    icon: WalletCards,
    items: [
      { label: "Contas a pagar", href: "/finance?tab=payables" },
      { label: "Contas a receber", href: "/finance?tab=receivables" },
      { label: "Títulos", href: "/finance?tab=titles" },
      { label: "Conciliação bancária", href: "/finance?tab=reconciliation" },
      { label: "Novo título", href: "/finance/titles/new", roles: financialRoles },
    ],
  },
  {
    id: "rentals",
    label: "Locações",
    href: "/rentals",
    icon: Wrench,
    items: [
      { label: "Equipamentos alugados", href: "/rentals" },
      { label: "Nova locação", href: "/rentals/new", roles: managementRoles },
    ],
  },
  {
    id: "inventory",
    label: "Estoque",
    href: "/inventory",
    icon: Boxes,
    items: [
      { label: "Produtos", href: "/inventory?tab=products" },
      { label: "Movimentações", href: "/inventory?tab=movements" },
      { label: "Novo produto", href: "/inventory/products/new", roles: managementRoles },
      { label: "Movimentar estoque", href: "/inventory/movements/new", roles: managementRoles },
    ],
  },
  {
    id: "registrations",
    label: "Cadastros",
    href: "/registrations",
    icon: UsersRound,
    items: [
      { label: "Obras", href: "/registrations?tab=projects" },
      { label: "Parceiros", href: "/registrations?tab=partners" },
      { label: "Nova obra", href: "/registrations/projects/new", roles: managementRoles },
      { label: "Novo parceiro", href: "/registrations/partners/new", roles: managementRoles },
    ],
  },
  {
    id: "reports",
    label: "Relatórios",
    href: "/reports",
    icon: FileText,
    items: [
      { label: "Biblioteca de modelos", href: "/reports" },
      { label: "Relatórios de planilhas", href: "/reports/spreadsheets", roles: financialReportRoles },
      { label: "Novo modelo", href: "/reports/new?preset=blank", roles: managementRoles },
      { label: "Modelo de abastecimento", href: "/reports/new?preset=fuel", roles: managementRoles },
      { label: "Balanço patrimonial", href: "/reports/balance-sheet", roles: financialReportRoles },
      { label: "Balancete", href: "/reports/trial-balance", roles: financialReportRoles },
    ],
  },
];

export function navigationForRole(role: string): WorkspaceNavigationModule[] {
  return workspaceNavigation.filter((module) => !module.roles || module.roles.includes(role)).map((module) => ({
    ...module,
    items: module.items?.filter((item) => !item.roles || item.roles.includes(role)),
  }));
}
