"use client";

import Link from "next/link";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import type { TitleLinkOption } from "../types";
import { financialOriginHref, financialOriginLabel } from "../../origin";
import { TitleStatus } from "./title-status";

type LinkedAccount = Omit<TitleLinkOption, "label">;

export function TitleAccountDetails({ account, canWrite, showAccountLink = true, showSettlementActions = true }: { account: LinkedAccount; canWrite: boolean; showAccountLink?: boolean; showSettlementActions?: boolean }) {
  const { t, formatDate, formatMoney } = useLocale();
  const isPayable = account.accountType === "PAYABLE";
  const hasOpenBalance = account.status === "OPEN" || account.status === "PARTIAL";
  return <div className="page-stack full-width">
    <div className="form-grid">
      <div className="form-field"><span>{t(isPayable ? "Fornecedor" : "Cliente")}</span><Link className="text-button" href={`/registrations?tab=partners&recordId=${account.partner.id}`}>{account.partner.name}</Link></div>
      <div className="form-field"><span>{t("Obra")}</span><Link className="text-button" href={`/registrations?tab=projects&recordId=${account.project.id}`}>{account.project.name}</Link></div>
      <div className="form-field"><span>{t(financialOriginLabel(account.origin))}</span><Link className="text-button" href={financialOriginHref(account.origin)}>{account.origin.number}</Link></div>
      {account.origin.type === "RENTAL" && <><div className="form-field"><span>{t("Documento recebido")}</span><Link className="text-button" href={`/rentals/${account.origin.id}?tab=documents`}>{account.origin.documentNumber}</Link></div><div className="form-field"><span>{t("Equipamento locado")}</span><strong>{account.origin.equipmentName}</strong></div></>}
      <div className="form-field"><span>{t("Situação")}</span><div><TitleStatus status={account.status} dueAt={account.dueAt} /></div></div>
      <div className="form-field"><span>{t("Valor")}</span><strong>{formatMoney(account.amount)}</strong></div>
      <div className="form-field"><span>{t("Valor liquidado")}</span><strong>{formatMoney(account.settledAmount)}</strong></div>
      <div className="form-field"><span>{t("Saldo em aberto")}</span><strong>{formatMoney(account.remaining)}</strong></div>
      <div className="form-field"><span>{t("Vencimento")}</span><strong>{formatDate(account.dueAt)}</strong></div>
    </div>
    <div className="inline-actions">
      {showAccountLink && <Link className="secondary-button" href={`/finance/${isPayable ? "payables" : "receivables"}/${account.accountId}`}>{t("Ver conta vinculada")}</Link>}
      {account.measurementId && <Link className="secondary-button" href={`/billing?tab=measurements&recordId=${account.measurementId}`}>{t("Ver medição")}</Link>}
      {canWrite && showSettlementActions && hasOpenBalance && <Link className="secondary-button" href={isPayable ? `/finance/payables/${account.accountId}/pay` : `/finance/receivables/${account.accountId}/reconcile`}>{t(isPayable ? "Registrar pagamento" : "Conciliar recebimento")}</Link>}
    </div>
  </div>;
}
