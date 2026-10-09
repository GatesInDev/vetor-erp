"use client";

import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import type { EquipmentRentalDetail } from "../types";
import { rentalDocumentKinds } from "./rental-labels";
import { formatRentalTotal } from "./rental-total";

export function RentalDocuments({ rental, canCharge }: { rental: EquipmentRentalDetail | null; canCharge: boolean }) {
  const { t, locale, decimalPlaces, formatDate } = useLocale();
  const formatMoney = (amount: string) => formatRentalTotal([amount], locale, decimalPlaces);
  if (!rental) return <section className="island panel"><EmptyState title={t("Salve a locação primeiro")} description={t("Depois de cadastrar a locação, registre suas notas, recibos e cobranças nesta aba.")} /></section>;
  return <section className="island panel page-stack">
    <div className="panel-heading"><div><p className="section-label">{t("Documentos e títulos")}</p><h2>{t("Cobranças da locação")}</h2></div>{canCharge && <Link className="primary-button" href={`/rentals/${rental.id}/charges/new`}><Plus size={17} />{t("Registrar cobrança")}</Link>}</div>
    <div className="stats-row"><div className="mini-stat"><span>{t("Total cobrado")}</span><strong>{formatMoney(rental.totalCharged)}</strong></div><div className="mini-stat"><span>{t("Total pago")}</span><strong>{formatMoney(rental.totalPaid)}</strong></div><div className="mini-stat"><span>{t("Saldo a pagar")}</span><strong>{formatMoney(rental.totalOutstanding)}</strong></div></div>
    {!rental.charges.length ? <EmptyState title={t("Nenhum documento registrado")} description={t("Registre a nota ou o recibo recebido da locadora para gerar a conta a pagar vinculada.")} /> : <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{t("Documento")}</th><th>{t("Emissão / vencimento")}</th><th>{t("Valor")}</th><th>{t("Situação")}</th><th>{t("Arquivos")}</th><th>{t("Vínculos financeiros")}</th></tr></thead>
      <tbody>{rental.charges.map((charge) => <tr key={charge.id}>
        <td><span className="table-primary">{charge.documentNumber}</span><span className="table-secondary">{t(rentalDocumentKinds[charge.documentKind])}</span>{charge.notes && <span className="table-secondary">{charge.notes}</span>}</td>
        <td><span>{formatDate(charge.issuedAt)}</span><span className="table-secondary">{t("Vencimento")}: {formatDate(charge.dueAt)}</span></td><td className="amount-cell">{formatMoney(charge.amount)}</td>
        <td><span className="status-badge" data-tone={charge.payable?.status === "PAID" ? "success" : charge.payable?.status === "CANCELLED" ? "muted" : "accent"}>{t(charge.payable?.status === "PAID" ? "Pago" : charge.payable?.status === "CANCELLED" ? "Cancelado" : charge.payable ? "Em aberto" : "Sem conta vinculada")}</span>{charge.payable?.paidAt && <span className="table-secondary">{formatDate(charge.payable.paidAt)}</span>}</td>
        <td><div className="page-stack">{charge.documentUrl && <a className="text-button" href={charge.documentUrl} target="_blank" rel="noopener noreferrer">{t("Abrir documento externo")}</a>}{charge.files.map((file) => <a className="text-button" key={file.id} href={`/api/equipment-rentals/${rental.id}/charges/${charge.id}/files/${file.id}`}><Download size={15} />{file.fileName}</a>)}{!charge.documentUrl && !charge.files.length && <span className="muted">—</span>}</div></td>
        <td>{charge.payable && <div className="table-actions"><Link className="text-button" href={`/finance/payables/${charge.payable.id}`}>{t("Ver conta a pagar")}</Link>{charge.payable.financialTitleId ? <Link className="text-button" href={`/finance/titles/${charge.payable.financialTitleId}`}>{t("Ver título")}</Link> : canCharge && charge.payable.status !== "CANCELLED" && <Link className="text-button" href={`/finance/titles/new?accountType=PAYABLE&accountId=${charge.payable.id}`}>{t("Vincular título")}</Link>}</div>}</td>
      </tr>)}</tbody>
    </table></div>}
    <p className="muted">{t("Cada cobrança gera sua conta a pagar. O boleto pode ser vinculado depois, sem duplicar o valor financeiro.")}</p>
  </section>;
}
