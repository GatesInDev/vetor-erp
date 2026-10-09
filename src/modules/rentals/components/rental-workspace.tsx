"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import type { EquipmentRentalRow } from "../types";
import { rentalStatuses } from "./rental-labels";
import { formatRentalTotal } from "./rental-total";

export function RentalWorkspace({ rentals, role }: { rentals: EquipmentRentalRow[]; role: string }) {
  const { t, locale, decimalPlaces, formatDate, formatNumber } = useLocale();
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("");
  const canWrite = ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(role);
  const projects = Array.from(new Map(rentals.map((rental) => [rental.project.id, rental.project])).values());
  const suppliers = Array.from(new Map(rentals.map((rental) => [rental.supplier.id, rental.supplier])).values());
  const query = search.trim().toLocaleLowerCase(locale);
  const filtered = rentals.filter((rental) => (!projectId || rental.project.id === projectId) && (!supplierId || rental.supplier.id === supplierId) && (!status || rental.status === status) && [rental.number, rental.equipmentName, rental.equipmentIdentifier, rental.project.name, rental.supplier.name].some((value) => value.toLocaleLowerCase(locale).includes(query)));
  const hasFilters = Boolean(query || projectId || supplierId || status);

  function clearFilters() { setSearch(""); setProjectId(""); setSupplierId(""); setStatus(""); }

  return <div className="page-stack">
    <PageHeader eyebrow={t("Equipamentos na operação")} title={t("Locações")} description={t("Acompanhe equipamentos alugados, devoluções e documentos financeiros por obra.")} actions={canWrite ? <Link className="primary-button" href="/rentals/new"><Plus size={17} />{t("Nova locação")}</Link> : undefined} />
    <div className="stats-row">
      <div className="mini-stat island"><span>{t("Em locação")}</span><strong>{rentals.filter((rental) => rental.status === "ACTIVE").length}</strong><small>{t("locações em andamento")}</small></div>
      <div className="mini-stat island"><span>{t("Documentos de locação")}</span><strong>{rentals.reduce((total, rental) => total + rental.chargeCount, 0)}</strong><small>{t("cobranças registradas")}</small></div>
      <div className="mini-stat island"><span>{t("Saldo a pagar")}</span><strong>{formatRentalTotal(rentals.map((rental) => rental.totalOutstanding), locale, decimalPlaces)}</strong><small>{t("saldo das contas vinculadas")}</small></div>
    </div>
    <section className="island panel page-stack">
      <div className="toolbar"><label className="search-field"><Search size={17} /><input aria-label={t("Buscar locações")} placeholder={t("Buscar por equipamento, referência ou locadora…")} value={search} onChange={(event) => setSearch(event.target.value)} /></label><span className="table-secondary">{filtered.length} {t("locações")}</span></div>
      <div className="form-grid">
        <label className="form-field">{t("Obra")}<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{t("Todas as obras")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        <label className="form-field">{t("Locadora")}<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">{t("Todas as locadoras")}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label className="form-field">{t("Situação da locação")}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t("Todas as situações")}</option>{Object.entries(rentalStatuses).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label>
        {hasFilters && <div className="inline-actions"><button type="button" className="text-button" onClick={clearFilters}>{t("Limpar filtros")}</button></div>}
      </div>
      {!filtered.length ? <EmptyState title={hasFilters ? t("Nenhum resultado encontrado") : t("Organize suas locações")} description={hasFilters ? t("Tente outro termo ou ajuste os filtros.") : t("Cadastre a retirada de um equipamento e acompanhe sua devolução e cobranças.")} action={hasFilters ? <button className="secondary-button" onClick={clearFilters}>{t("Limpar filtros")}</button> : canWrite ? <Link className="secondary-button" href="/rentals/new">{t("Nova locação")}</Link> : undefined} /> : <div className="table-scroll"><table className="data-table">
        <thead><tr><th>{t("Equipamento / referência")}</th><th>{t("Obra / locadora")}</th><th>{t("Quantidade")}</th><th>{t("Retirada")}</th><th>{t("Previsão de devolução")}</th><th>{t("Situação")}</th><th>{t("Documentos")}</th></tr></thead>
        <tbody>{filtered.map((rental) => <tr key={rental.id}><td><Link className="text-button table-primary" href={`/rentals/${rental.id}`}>{rental.equipmentName}</Link><span className="table-secondary">{rental.number}{rental.equipmentIdentifier ? ` · ${rental.equipmentIdentifier}` : ""}</span></td><td><span className="table-primary">{rental.project.name}</span><span className="table-secondary">{rental.supplier.name}</span></td><td>{formatNumber(rental.quantity)}</td><td>{formatDate(rental.startsAt)}</td><td>{rental.expectedReturnAt ? formatDate(rental.expectedReturnAt) : "—"}</td><td><span className="status-badge" data-tone={rental.status === "RETURNED" ? "success" : rental.status === "SCHEDULED" ? "muted" : "accent"}>{t(rentalStatuses[rental.status])}</span>{rental.returnedAt && <span className="table-secondary">{formatDate(rental.returnedAt)}</span>}</td><td><Link className="text-button" href={`/rentals/${rental.id}?tab=documents`}>{rental.chargeCount} {t("documentos")}</Link></td></tr>)}</tbody>
      </table></div>}
    </section>
  </div>;
}
