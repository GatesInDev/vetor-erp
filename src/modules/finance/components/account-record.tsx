"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSection } from "@/components/ui/form-page";
import { PageHeader } from "@/components/ui/page-header";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import type { FinancialAccountRecord } from "../types";
import type { FinancialTitleRow } from "../titles/types";
import { TitleAccountDetails } from "../titles/components/title-account-details";
import { titleKinds, TitleStatus } from "../titles/components/title-status";
import { RecordTabs } from "./record-tabs";
import { financialOriginReference } from "../origin";

export function AccountRecord({ account, titles, role }: { account: FinancialAccountRecord; titles: FinancialTitleRow[]; role: string }) {
  const { t, formatDate, formatMoney } = useLocale();
  const [tab, setTab] = useState<"details" | "titles">("details");
  const isPayable = account.accountType === "PAYABLE";
  const canWrite = ["ADMIN", "ACCOUNTANT", "FINANCE"].includes(role);
  const canSettle = canWrite && (account.status === "OPEN" || account.status === "PARTIAL");
  const canCreateTitle = canWrite && !titles.length && account.status !== "CANCELLED";
  const backHref = `/finance?tab=${isPayable ? "payables" : "receivables"}`;
  const createTitle = canCreateTitle ? <Link className="primary-button" href={`/finance/titles/new?accountType=${account.accountType}&accountId=${account.accountId}`}><Plus size={17} />{t("Vincular título")}</Link> : undefined;

  const details = <FormSection title={t("Dados da conta")} description={t("Confira os valores e os registros que deram origem à conta.")}>
    <TitleAccountDetails account={account} canWrite={canWrite} showAccountLink={false} showSettlementActions={false} />
    {account.paidAt && <div className="form-field"><span>{t("Pago em")}</span><strong>{formatDate(account.paidAt)}</strong></div>}
  </FormSection>;

  const linkedTitles = <section className="island panel page-stack">
    <div className="panel-heading"><div><p className="section-label">{t("Documentos vinculados")}</p><h2>{t("Títulos desta conta")}</h2></div>{createTitle}</div>
    {!titles.length ? <EmptyState title={t("Nenhum título vinculado")} description={account.status === "CANCELLED" ? t("A conta está cancelada e não aceita novos títulos.") : t("Vincule um boleto, duplicata ou outro documento a esta conta para acompanhar seus dados.")} /> : <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{t("Título")}</th><th>{t("Banco / instituição")}</th><th>{t("Vencimento")}</th><th>{t("Valor")}</th><th>{t("Saldo em aberto")}</th><th>{t("Situação")}</th><th><span className="sr-only">{t("Ações")}</span></th></tr></thead>
      <tbody>{titles.map((title) => <tr key={title.id}>
        <td><Link className="text-button table-primary" href={`/finance/titles/${title.id}`}>{title.number}</Link><span className="table-secondary">{t(titleKinds[title.kind])}</span></td>
        <td>{title.bankName || "—"}</td><td>{formatDate(title.dueAt)}</td><td className="amount-cell">{formatMoney(title.amount)}</td><td className="amount-cell">{formatMoney(title.remaining)}</td><td><TitleStatus status={title.status} dueAt={title.dueAt} /></td>
        <td><Link className="text-button" href={`/finance/titles/${title.id}`}>{t(canWrite ? "Editar título" : "Ver título")}</Link></td>
      </tr>)}</tbody>
    </table></div>}
    <p className="muted">{t("Os títulos acompanham o saldo e a situação da conta vinculada. O cadastro não altera os totais financeiros.")}</p>
  </section>;

  return <div className="page-stack">
    <div><Link href={backHref} className="text-button"><ArrowLeft size={18} />{t("Voltar à lista")}</Link></div>
    <PageHeader eyebrow={t("Financeiro")} title={`${t(isPayable ? "Conta a pagar" : "Conta a receber")}: ${financialOriginReference(account.origin)}`} description={t("Consulte a conta, seus vínculos e os títulos associados.")} actions={canSettle ? <Link className="primary-button" href={isPayable ? `/finance/payables/${account.accountId}/pay` : `/finance/receivables/${account.accountId}/reconcile`}>{t(isPayable ? "Registrar pagamento" : "Conciliar recebimento")}</Link> : undefined} />
    <RecordTabs label={t("Seções da conta")} value={tab} onChange={setTab} tabs={[{ value: "details", label: t("Dados da conta"), content: details }, { value: "titles", label: t("Títulos"), count: titles.length, content: linkedTitles }]} />
  </div>;
}
