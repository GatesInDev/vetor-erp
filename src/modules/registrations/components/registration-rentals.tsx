"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { rentalStatuses } from "@/modules/rentals/components/rental-labels";
import type { EquipmentRentalRow } from "@/modules/rentals/types";

export function RegistrationRentals({ rentals, type, recordId }: { rentals: EquipmentRentalRow[]; type: "projects" | "partners"; recordId: string }) {
  const { t, formatDate } = useLocale();
  return <section className="island panel page-stack">
    <div className="panel-heading"><h2>{t("Locações vinculadas")}</h2><Link className="primary-button" href={`/rentals/new?${type === "projects" ? "projectId" : "supplierId"}=${recordId}`}>{t("Nova locação")}</Link></div>
    {!rentals.length ? <EmptyState title={t("Nenhuma locação vinculada")} description={t("As locações desta obra ou locadora aparecerão aqui.")} /> : <div className="table-scroll"><table className="data-table">
      <thead><tr><th>{t("Equipamento / referência")}</th><th>{t("Obra")}</th><th>{t("Locadora")}</th><th>{t("Retirada")}</th><th>{t("Situação")}</th><th>{t("Documentos")}</th></tr></thead>
      <tbody>{rentals.map((rental) => <tr key={rental.id}><td><Link className="text-button table-primary" href={`/rentals/${rental.id}`}>{rental.equipmentName}</Link><span className="table-secondary">{rental.number}</span></td><td>{rental.project.name}</td><td>{rental.supplier.name}</td><td>{formatDate(rental.startsAt)}</td><td>{t(rentalStatuses[rental.status])}</td><td><Link className="text-button" href={`/rentals/${rental.id}?tab=documents`}>{rental.chargeCount} {t("documentos")}</Link></td></tr>)}</tbody>
    </table></div>}
  </section>;
}
