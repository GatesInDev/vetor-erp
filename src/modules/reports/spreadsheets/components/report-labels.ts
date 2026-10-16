import type { DateField, ReportFilters } from "../types";

export const dateLabels: Record<DateField, string> = {
  dueDate: "Vencimento",
  issuedAt: "Emissão",
  paidAt: "Pagamento",
  quotedAt: "Orçamento",
  approvedAt: "Aprovação",
  startsAt: "Início da obra",
  endsAt: "Fim da obra",
};

export const groupLabels: Record<ReportFilters["groupBy"], string> = {
  none: "Sem agrupamento",
  party: "Cliente / fornecedor",
  category: "Categoria",
  status: "Situação",
  month: "Mês da data selecionada",
  city: "Cidade",
};

export const sortLabels: Record<ReportFilters["sortBy"], string> = {
  date: "Data selecionada",
  amount: "Valor total",
  party: "Cliente / fornecedor",
};

export const dueLabels: Record<ReportFilters["dueStatus"], string> = {
  all: "Todos os vencimentos",
  overdue: "Vencidos em aberto",
  today: "Vencem na data de referência",
  upcoming: "A vencer após a referência",
};

const errorMessages: Record<string, string> = {
  FILE_EXTENSION_INVALID: "Selecione um arquivo no formato XLSX.",
  FILE_TOO_LARGE: "O arquivo excede o limite de 5 MiB. Reduza a planilha e tente novamente.",
  FILE_EMPTY: "O arquivo está vazio. Selecione uma planilha com dados.",
  WORKBOOK_INVALID: "Não foi possível abrir este XLSX. Abra no Excel, salve novamente e tente importar.",
  WORKBOOK_UNSAFE: "A planilha contém recursos não compatíveis com a importação. Salve uma cópia simples em XLSX.",
  WORKBOOK_TOO_LARGE: "A planilha tem dados demais para esta importação. Divida o arquivo em partes menores.",
  WORKBOOK_LIMIT_EXCEEDED: "A planilha excede o limite de abas, linhas ou colunas. Divida o arquivo e tente novamente.",
  NO_SUPPORTED_SHEETS: "Nenhuma aba de títulos ou obras foi reconhecida. Confira os cabeçalhos do modelo Boletos.xlsx.",
  INVALID_DIRECTION: "Tipo de título inválido. Informe pagar ou receber.",
  INVALID_DATE: "Uma data não foi reconhecida. Confira o valor na planilha.",
  INVALID_AMOUNT: "Um valor monetário está vazio ou inválido.",
  INVALID_AREA: "A área informada não é um número válido.",
  MISSING_REQUIRED_VALUE: "Falta uma informação obrigatória nesta linha.",
  FORMULA_VALUE_UNAVAILABLE: "Uma fórmula não tem resultado salvo. Recalcule e salve a planilha no Excel.",
  TOTAL_MISMATCH: "O valor total não corresponde ao valor nominal somado aos juros.",
  "Invalid reference date": "Informe uma data de referência válida.",
  "Invalid date range": "Informe datas válidas para o período.",
  "End date must not precede start date": "A data final deve ser igual ou posterior à data inicial.",
  "Invalid amount range": "Informe valores válidos, como 1500,00 ou 1.500,00.",
  "Maximum amount must not be less than minimum amount": "O valor máximo deve ser igual ou maior que o valor mínimo.",
};

export function spreadsheetErrorMessage(message: string): string {
  return errorMessages[message] ?? "Não foi possível ler a planilha. Confira se o arquivo é XLSX e segue as colunas do modelo Boletos.";
}
