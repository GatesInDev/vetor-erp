"use client";

import { useLocale } from "@/modules/settings/components/preferences-provider";
import { isOverdue } from "@/modules/finance/types";
import type { FinancialTitleRow } from "../types";

export const titleKinds: Record<FinancialTitleRow["kind"], string> = {
  BOLETO: "Boleto",
  DUPLICATE: "Duplicata",
  PROMISSORY_NOTE: "Nota promissória",
  OTHER: "Outro título",
};

export const titleStatuses: Record<FinancialTitleRow["status"], string> = {
  OPEN: "Em aberto",
  PARTIAL: "Parcial",
  SETTLED: "Liquidado",
  CANCELLED: "Cancelado",
};

export function TitleStatus({ status, dueAt }: Pick<FinancialTitleRow, "status" | "dueAt">) {
  const { t } = useLocale();
  const overdue = (status === "OPEN" || status === "PARTIAL") && isOverdue(dueAt);
  return <span className="status-badge" data-tone={status === "SETTLED" ? "success" : status === "CANCELLED" ? "muted" : overdue ? "warning" : "accent"}>{t(titleStatuses[status])}{overdue && ` · ${t("Vencido")}`}</span>;
}
