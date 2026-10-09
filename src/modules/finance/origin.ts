import type { FinancialAccountOrigin } from "./titles/types";

export function financialOriginHref(origin: FinancialAccountOrigin): string {
  return origin.type === "RENTAL" ? `/rentals/${origin.id}` : `/billing?tab=${origin.type === "INVOICE" ? "invoices" : "contracts"}&recordId=${origin.id}`;
}

export function financialOriginLabel(origin: FinancialAccountOrigin): string {
  return origin.type === "RENTAL" ? "Locação vinculada" : origin.type === "INVOICE" ? "Serviço vinculado" : "Contrato vinculado";
}

export function financialOriginReference(origin: FinancialAccountOrigin): string {
  return origin.type === "RENTAL" ? `${origin.number} · ${origin.documentNumber}` : origin.number;
}
