"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ArrowUpDown, Boxes, History, Package, Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import type { InventoryProductSummary, StockMovementSummary } from "@/modules/inventory/types";
import { useLocale } from "@/modules/settings/components/preferences-provider";


function stockStatus(product: InventoryProductSummary) {
  if (!product.active) return { label: "Inativo", tone: "muted" };
  if (Number(product.quantity) === 0) return { label: "Sem estoque", tone: "warning" };
  if (Number(product.quantity) <= Number(product.minimumQuantity)) return { label: "Reposição", tone: "warning" };
  return { label: "Disponível", tone: "success" };
}

export function InventoryWorkspace({ products, movements, canWrite, initialTab = "products" }: {
  products: InventoryProductSummary[];
  movements: StockMovementSummary[];
  initialTab?: "products" | "movements";
  canWrite: boolean;
}) {
  const { t, locale, formatNumber, formatDate } = useLocale();
  const router = useRouter();
  const tab = initialTab;
  function setTab(nextTab: "products" | "movements") { router.push(`/inventory?tab=${nextTab}`, { scroll: false }); }
  const [search, setSearch] = useState("");
  const searchTerm = search.trim().toLocaleLowerCase(locale);
  const activeProducts = products.filter((product) => product.active);
  const filteredProducts = products.filter((product) => `${product.sku} ${product.name}`.toLocaleLowerCase(locale).includes(searchTerm));
  const filteredMovements = movements.filter((movement) => `${movement.product.sku} ${movement.product.name} ${movement.reason} ${movement.project?.name ?? ""}`.toLocaleLowerCase(locale).includes(searchTerm));
  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === "Home" ? "products" : event.key === "End" ? "movements" : tab === "products" ? "movements" : "products";
    setTab(nextTab);
    setSearch("");
    document.getElementById(`inventory-${nextTab}-tab`)?.focus();
  }

  const createProductAction = canWrite ? <Link className="primary-button" href="/inventory/products/new"><Plus size={17} />{t("Novo produto")}</Link> : undefined;
  const createMovementAction = canWrite ? <Link className="secondary-button" href="/inventory/movements/new"><ArrowUpDown size={17} />{t("Movimentar estoque")}</Link> : undefined;

  return <div className="page-stack">
    <PageHeader eyebrow={t("Materiais em movimento")} title={t("Estoque")} description={t("Cada material no seu lugar. Acompanhe saldos, entradas e consumo por obra.")} actions={<>{createMovementAction}{createProductAction}</>} />
    <div className="stats-row">
      <div className="island mini-stat"><Package size={19} /><span>{t("Produtos cadastrados")}</span><strong>{products.length}</strong></div>
      <div className="island mini-stat"><Boxes size={19} /><span>{t("Produtos ativos")}</span><strong>{activeProducts.length}</strong></div>
      <div className="island mini-stat"><ArrowDownLeft size={19} /><span>{t("Precisam de reposição")}</span><strong>{activeProducts.filter((product) => Number(product.quantity) <= Number(product.minimumQuantity)).length}</strong></div>
    </div>
    <section className="island panel">
      <div className="toolbar">
        <div className="module-tabs" role="tablist" aria-label={t("Visões de estoque")} onKeyDown={navigateTabs}>
          <button type="button" id="inventory-products-tab" role="tab" tabIndex={tab === "products" ? 0 : -1} aria-controls="inventory-panel" aria-selected={tab === "products"} onClick={() => { setTab("products"); setSearch(""); }}><Package size={16} />{t("Produtos")}</button>
          <button type="button" id="inventory-movements-tab" role="tab" tabIndex={tab === "movements" ? 0 : -1} aria-controls="inventory-panel" aria-selected={tab === "movements"} onClick={() => { setTab("movements"); setSearch(""); }}><History size={16} />{t("Movimentações")}</button>
        </div>
        <label className="search-field"><Search size={17} /><input aria-label={tab === "products" ? t("Buscar produtos") : t("Buscar movimentações")} placeholder={tab === "products" ? t("Buscar produto ou código...") : t("Buscar material, motivo ou obra...")} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      <div id="inventory-panel" role="tabpanel" aria-labelledby={`inventory-${tab}-tab`}>
        {tab === "products" && (filteredProducts.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr><th>{t("Código / SKU")}</th><th>{t("Produto")}</th><th>{t("Saldo atual")}</th><th>{t("Estoque mínimo")}</th><th>{t("Situação")}</th>{canWrite && <th>{t("Ações")}</th>}</tr></thead>
          <tbody>{filteredProducts.map((product) => {
            const status = stockStatus(product);
            return <tr key={product.id}><td><span className="table-code">{product.sku}</span></td><td><strong>{product.name}</strong></td><td><strong>{formatNumber(Number(product.quantity))}</strong> <span className="field-optional">{product.unit}</span></td><td>{formatNumber(Number(product.minimumQuantity))} {product.unit}</td><td><span className="status-badge" data-tone={status.tone}>{t(status.label)}</span></td>{canWrite && <td><div className="table-actions"><Link className="icon-button" aria-label={`${t("Editar produto")} ${product.name}`} href={`/inventory/products/${product.id}`}><Pencil size={16} /></Link>{product.active && <Link className="icon-button" aria-label={`${t("Movimentar produto")} ${product.name}`} href={`/inventory/movements/new?productId=${product.id}`}><ArrowUpDown size={16} /></Link>}</div></td>}</tr>;
          })}</tbody>
        </table></div> : <EmptyState title={search ? t("Nenhum produto encontrado") : t("Dê espaço aos seus materiais")} description={search ? t("Tente buscar por outro nome ou código.") : t("Cadastre o primeiro produto e registre uma entrada para começar a controlar o estoque.")} action={!search ? createProductAction : undefined} />)}
        {tab === "movements" && <><p className="section-description">{t("Últimas 100 movimentações registradas. Saídas são vinculadas às obras.")}</p>{filteredMovements.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr><th>{t("Data")}</th><th>{t("Produto")}</th><th>{t("Tipo")}</th><th>{t("Quantidade")}</th><th>{t("Obra / destino")}</th><th>{t("Motivo")}</th></tr></thead>
          <tbody>{filteredMovements.map((movement) => <tr key={movement.id}><td>{formatDate(movement.createdAt, { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" })}</td><td><strong>{movement.product.name}</strong><small className="table-detail">{movement.product.sku}</small></td><td><span className="status-badge" data-tone={movement.type === "ENTRY" ? "success" : "accent"}>{movement.type === "ENTRY" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}{movement.type === "ENTRY" ? t("Entrada") : t("Saída")}</span></td><td>{formatNumber(Number(movement.quantity))} {movement.product.unit}</td><td>{movement.project?.name ?? t("Estoque geral")}</td><td>{movement.reason}</td></tr>)}</tbody>
        </table></div> : <EmptyState title={search ? t("Nenhuma movimentação encontrada") : t("Um histórico que acompanha sua operação")} description={search ? t("Tente outro termo na busca.") : t("Registre entradas de materiais e saídas para suas obras. Cada movimentação fica salva aqui.")} action={!search && activeProducts.length ? createMovementAction : undefined} />}</>}
      </div>
    </section>
  </div>;
}
