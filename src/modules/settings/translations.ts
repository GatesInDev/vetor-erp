import type { UserPreferences } from "./schema";
import { moduleTranslations } from "./module-translations";
import { operationsTranslations } from "./operations-translations";
import { financeTranslations } from "./finance-translations";
import { reportTranslations } from "./report-translations";
import { accountingTranslations } from "./accounting-translations";
import { rentalTranslations } from "./rental-translations";
import { mailTranslations } from "./mail-translations";

const messages: Record<string, string> = {
  "Locações": "Rentals", "Equipamentos alugados": "Rented equipment", "Nova locação": "New rental", "Locação": "Rental", "Registrar cobrança": "Record charge",
  "Obras · Equipamentos": "Projects · Equipment", "Locadoras e documentos": "Rental companies and documents", "Relacione equipamentos alugados, obras, locadoras e cobranças.": "Connect rented equipment, projects, rental companies, and charges.",
  "Dados do cadastro": "Registration details", "Locações vinculadas": "Linked rentals", "Nenhuma locação vinculada": "No linked rentals", "As locações desta obra ou locadora aparecerão aqui.": "Rentals for this project or rental company will appear here.", "Ver locação": "View rental",
  "Exibindo o registro vinculado.": "Showing the linked record.", "Mostrar todos os registros": "Show all records",
  "Início": "Home", "Dashboard": "Dashboard", "Faturamento": "Billing", "Financeiro": "Finance", "Estoque": "Inventory", "Cadastros": "Registrations", "Relatórios": "Reports", "Configurações": "Settings",
  "Serviços": "Services", "Contratos": "Contracts", "Medições": "Measurements", "Registrar serviço": "Record service", "Novo contrato": "New contract", "Nova medição": "New measurement", "Aprovar medição": "Approve measurement",
  "Contas a pagar": "Accounts payable", "Contas a receber": "Accounts receivable", "Conciliação bancária": "Bank reconciliation", "Produtos": "Products", "Movimentações": "Movements", "Novo produto": "New product", "Editar produto": "Edit product", "Movimentar estoque": "Record stock movement",
  "Obras": "Projects", "Clientes e fornecedores": "Customers and suppliers", "Nova obra": "New project", "Editar obra": "Edit project", "Novo parceiro": "New partner", "Editar parceiro": "Edit partner", "Biblioteca de relatórios": "Report library", "Novo relatório": "New report", "Editar relatório": "Edit report", "Visualizar relatório": "View report", "Ficha de abastecimento": "Fuel form", "Documento livre": "Blank document",
  "Registrar pagamento": "Record payment", "Conciliar recebimento": "Reconcile receipt", "Área de trabalho": "Workspace", "Administrador": "Administrator", "Contabilidade": "Accounting", "Operações": "Operations", "Consulta": "Read only",
  "Abrir menu": "Open menu", "Fechar menu": "Close menu", "Fechar navegação": "Close navigation", "Navegação do workspace": "Workspace navigation", "Caminho de navegação": "Breadcrumb", "Módulos da aplicação": "Application modules", "SUA EMPRESA": "YOUR COMPANY", "MÓDULOS": "MODULES", "EXPLORAR MÓDULO": "EXPLORE MODULE", "Sair da conta": "Sign out", "Ver todos os módulos": "View all modules", "Ir para o conteúdo": "Skip to content", "A gestão ganha espaço.": "Give your work room to grow.", "Ativar tema claro": "Switch to light theme", "Ativar tema escuro": "Switch to dark theme",
  "Telas abertas": "Open screens", "telas prontas para alternar": "screens ready to switch", "Alterações não salvas": "Unsaved changes", "Manter aberta": "Keep open", "Descartar e fechar": "Discard and close", "Os campos preenchidos serão perdidos ao fechar esta aba.": "Unsaved fields will be lost when this tab is closed.", "Fechar mensagem": "Dismiss message", "UM NOVO PONTO DE VISTA": "A NEW POINT OF VIEW", "Seu trabalho. Em órbita.": "Your work. In orbit.",
  "PREFERÊNCIAS DO SISTEMA": "SYSTEM PREFERENCES", "Seu ambiente de trabalho": "Your workspace", "Ajuste a aparência, o idioma e a exibição de dados. Suas preferências acompanham sua conta.": "Adjust appearance, language, and data display. Your preferences follow your account.",
  "Geral": "General", "Números": "Numbers", "Navegação": "Navigation", "Aparência e idioma": "Appearance and language", "Tema": "Theme", "Escuro": "Dark", "Claro": "Light", "Idioma": "Language", "Português (Brasil)": "Portuguese (Brazil)", "Inglês (Estados Unidos)": "English (United States)",
  "Exibição de números": "Number display", "Casas decimais": "Decimal places", "Exemplo numérico": "Number example", "Exemplo monetário": "Currency example", "Essa preferência muda apenas a exibição. Os valores e cálculos armazenados mantêm sua precisão original.": "This preference only changes display. Stored values and calculations keep their original precision.",
  "Telas mantidas em memória": "Screens kept in memory", "Limite de telas carregadas": "Loaded screen limit", "As telas usadas mais recentemente ficam prontas para alternar. As demais abas continuam abertas e recarregam ao voltar, preservando os rascunhos dos formulários.": "Recently used screens stay ready to switch. Other tabs remain open and reload when selected, preserving form drafts.",
  "Salvar preferências": "Save preferences", "Salvando...": "Saving...", "Preferências salvas.": "Preferences saved.", "Não foi possível salvar suas preferências. Tente novamente.": "Could not save your preferences. Please try again.", "Não foi possível sair. Tente novamente.": "Could not sign out. Please try again.", "Preferências pessoais": "Personal preferences",
};

export function translate(locale: UserPreferences["locale"], source: string): string {
  return locale === "en-US" ? messages[source] ?? moduleTranslations[source] ?? operationsTranslations[source] ?? financeTranslations[source] ?? reportTranslations[source] ?? accountingTranslations[source] ?? rentalTranslations[source] ?? mailTranslations[source] ?? source : source;
}
