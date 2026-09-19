"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ArrowUpDown, Boxes, History, Package, Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDialog } from "@/components/ui/form-dialog";
import { apiRequest } from "@/lib/client-api";
import type { InventoryProductSummary, StockMovementSummary } from "@/modules/inventory/types";

type InventoryEditor = { type: "product"; product: InventoryProductSummary | null } | { type: "movement"; product: InventoryProductSummary | null };
type ProjectOption = { id: string; code: string; name: string };
const quantityFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

function stockStatus(product: InventoryProductSummary) {
  if (!product.active) return { label: "Inativo", tone: "muted" };
  if (Number(product.quantity) === 0) return { label: "Sem estoque", tone: "warning" };
  if (Number(product.quantity) <= Number(product.minimumQuantity)) return { label: "Reposição", tone: "warning" };
  return { label: "Disponível", tone: "success" };
}

export function InventoryWorkspace({ products, movements, projects, canWrite }: {
  products: InventoryProductSummary[];
  movements: StockMovementSummary[];
  projects: ProjectOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"products" | "movements">("products");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<InventoryEditor | null>(null);
  const [movementType, setMovementType] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mutationKey = useRef("");
  const searchTerm = search.trim().toLocaleLowerCase("pt-BR");
  const activeProducts = products.filter((product) => product.active);
  const filteredProducts = products.filter((product) => `${product.sku} ${product.name}`.toLocaleLowerCase("pt-BR").includes(searchTerm));
  const filteredMovements = movements.filter((movement) => `${movement.product.sku} ${movement.product.name} ${movement.reason} ${movement.project?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(searchTerm));
  const selectedProduct = products.find((product) => product.id === selectedProductId);

  function openEditor(nextEditor: InventoryEditor) {
    mutationKey.current = crypto.randomUUID();
    setEditor(nextEditor);
    setMovementType("ENTRY");
    setSelectedProductId(nextEditor.product?.id ?? "");
    setError("");
    setNotice("");
  }

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === "Home" ? "products" : event.key === "End" ? "movements" : tab === "products" ? "movements" : "products";
    setTab(nextTab);
    setSearch("");
    document.getElementById(`inventory-${nextTab}-tab`)?.focus();
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor?.type !== "product" || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/inventory/products${editor.product ? `/${editor.product.id}` : ""}`, {
        method: editor.product ? "PATCH" : "POST",
        body: {
          sku: String(form.get("sku")).trim(),
          name: String(form.get("name")).trim(),
          unit: String(form.get("unit")).trim(),
          minimumQuantity: String(form.get("minimumQuantity")).replace(",", "."),
          active: form.get("active") === "on",
        },
        idempotencyKey: mutationKey.current,
      });
      setNotice(editor.product ? "Produto atualizado com sucesso." : "Produto cadastrado. Registre uma entrada para informar o saldo inicial.");
      setEditor(null);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar o produto.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const quantity = String(form.get("quantity")).replace(",", ".");
    if (movementType === "EXIT" && selectedProduct && Number(quantity) > Number(selectedProduct.quantity)) {
      setError("A quantidade de saída é maior que o saldo disponível.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/inventory/movements", {
        method: "POST",
        body: {
          productId: selectedProductId,
          type: movementType,
          quantity,
          reason: String(form.get("reason")).trim(),
          ...(form.get("projectId") ? { projectId: String(form.get("projectId")) } : {}),
        },
        idempotencyKey: mutationKey.current,
      });
      setNotice(movementType === "ENTRY" ? "Entrada registrada. O saldo do produto foi atualizado." : "Saída registrada e vinculada à obra.");
      setEditor(null);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível registrar a movimentação.");
    } finally {
      setBusy(false);
    }
  }

  const createProductAction = canWrite ? <button type="button" className="primary-button" onClick={() => openEditor({ type: "product", product: null })}><Plus size={17} />Novo produto</button> : undefined;
  const createMovementAction = canWrite ? <button type="button" className="secondary-button" disabled={!activeProducts.length} onClick={() => openEditor({ type: "movement", product: null })}><ArrowUpDown size={17} />Movimentar estoque</button> : undefined;

  return <div className="page-stack">
    <PageHeader eyebrow="Materiais em movimento" title="Estoque" description="Cada material no seu lugar. Acompanhe saldos, entradas e consumo por obra." actions={<>{createMovementAction}{createProductAction}</>} />
    <div className="stats-row">
      <div className="island mini-stat"><Package size={19} /><span>Produtos cadastrados</span><strong>{products.length}</strong></div>
      <div className="island mini-stat"><Boxes size={19} /><span>Produtos ativos</span><strong>{activeProducts.length}</strong></div>
      <div className="island mini-stat"><ArrowDownLeft size={19} /><span>Precisam de reposição</span><strong>{activeProducts.filter((product) => Number(product.quantity) <= Number(product.minimumQuantity)).length}</strong></div>
    </div>
    {notice && <p className="form-success" role="status">{notice}</p>}
    <section className="island panel">
      <div className="toolbar">
        <div className="module-tabs" role="tablist" aria-label="Visões de estoque" onKeyDown={navigateTabs}>
          <button type="button" id="inventory-products-tab" role="tab" tabIndex={tab === "products" ? 0 : -1} aria-controls="inventory-panel" aria-selected={tab === "products"} onClick={() => { setTab("products"); setSearch(""); }}><Package size={16} />Produtos</button>
          <button type="button" id="inventory-movements-tab" role="tab" tabIndex={tab === "movements" ? 0 : -1} aria-controls="inventory-panel" aria-selected={tab === "movements"} onClick={() => { setTab("movements"); setSearch(""); }}><History size={16} />Movimentações</button>
        </div>
        <label className="search-field"><Search size={17} /><input aria-label={tab === "products" ? "Buscar produtos" : "Buscar movimentações"} placeholder={tab === "products" ? "Buscar produto ou código..." : "Buscar material, motivo ou obra..."} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      <div id="inventory-panel" role="tabpanel" aria-labelledby={`inventory-${tab}-tab`}>
        {tab === "products" && (filteredProducts.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Código / SKU</th><th>Produto</th><th>Saldo atual</th><th>Estoque mínimo</th><th>Situação</th>{canWrite && <th>Ações</th>}</tr></thead>
          <tbody>{filteredProducts.map((product) => {
            const status = stockStatus(product);
            return <tr key={product.id}><td><span className="table-code">{product.sku}</span></td><td><strong>{product.name}</strong></td><td><strong>{quantityFormat.format(Number(product.quantity))}</strong> <span className="field-optional">{product.unit}</span></td><td>{quantityFormat.format(Number(product.minimumQuantity))} {product.unit}</td><td><span className="status-badge" data-tone={status.tone}>{status.label}</span></td>{canWrite && <td><div className="table-actions"><button type="button" className="icon-button" aria-label={`Editar produto ${product.name}`} onClick={() => openEditor({ type: "product", product })}><Pencil size={16} /></button><button type="button" className="icon-button" disabled={!product.active} aria-label={`Movimentar produto ${product.name}`} onClick={() => openEditor({ type: "movement", product })}><ArrowUpDown size={16} /></button></div></td>}</tr>;
          })}</tbody>
        </table></div> : <EmptyState title={search ? "Nenhum produto encontrado" : "Dê espaço aos seus materiais"} description={search ? "Tente buscar por outro nome ou código." : "Cadastre o primeiro produto e registre uma entrada para começar a controlar o estoque."} action={!search ? createProductAction : undefined} />)}
        {tab === "movements" && <><p className="section-description">Últimas 100 movimentações registradas. Saídas são vinculadas às obras.</p>{filteredMovements.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Obra / destino</th><th>Motivo</th></tr></thead>
          <tbody>{filteredMovements.map((movement) => <tr key={movement.id}><td>{dateFormat.format(new Date(movement.createdAt))}</td><td><strong>{movement.product.name}</strong><small className="table-detail">{movement.product.sku}</small></td><td><span className="status-badge" data-tone={movement.type === "ENTRY" ? "success" : "accent"}>{movement.type === "ENTRY" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}{movement.type === "ENTRY" ? "Entrada" : "Saída"}</span></td><td>{quantityFormat.format(Number(movement.quantity))} {movement.product.unit}</td><td>{movement.project?.name ?? "Estoque geral"}</td><td>{movement.reason}</td></tr>)}</tbody>
        </table></div> : <EmptyState title={search ? "Nenhuma movimentação encontrada" : "Um histórico que acompanha sua operação"} description={search ? "Tente outro termo na busca." : "Registre entradas de materiais e saídas para suas obras. Cada movimentação fica salva aqui."} action={!search && activeProducts.length ? createMovementAction : undefined} />}</>}
      </div>
    </section>
    <FormDialog open={editor !== null} onClose={() => { if (!busy) setEditor(null); }} title={editor?.type === "product" ? editor.product ? "Editar produto" : "Novo produto" : "Movimentar estoque"} description={editor?.type === "product" ? "Defina como o material será identificado e controlado." : "O saldo é atualizado assim que a movimentação for registrada."}>
      {editor?.type === "product" && <form key={editor.product?.id ?? "new-product"} className="form-grid" onSubmit={saveProduct}>
        <label className="form-field">Código / SKU<input name="sku" required maxLength={60} defaultValue={editor.product?.sku ?? ""} placeholder="MAT-001" disabled={busy} /></label>
        <label className="form-field">Unidade<select name="unit" required defaultValue={editor.product?.unit ?? "UN"} disabled={busy || Boolean(editor.product)}>{Array.from(new Set(["UN", "KG", "M", "M2", "M3", "L", "CX", "SC", ...(editor.product ? [editor.product.unit] : [])])).map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>{editor.product && <><input type="hidden" name="unit" value={editor.product.unit} /><small>A unidade é preservada para manter o histórico consistente.</small></>}</label>
        <label className="form-field full-width">Nome do produto<input name="name" required maxLength={200} defaultValue={editor.product?.name ?? ""} placeholder="Cimento CP II 50 kg" disabled={busy} /></label>
        <label className="form-field">Estoque mínimo<input type="number" name="minimumQuantity" required min="0" step="0.001" max="999999999999.999" defaultValue={editor.product?.minimumQuantity ?? "0"} disabled={busy} /><small>Um aviso aparece quando o saldo atingir este valor.</small></label>
        <label className="checkbox-field"><input type="checkbox" name="active" defaultChecked={editor.product?.active ?? true} disabled={busy} /><span>Produto ativo<small>Disponível para movimentações.</small></span></label>
        {!editor.product && <p className="section-description full-width">O saldo inicial será zero. Após cadastrar, registre uma entrada com a quantidade disponível.</p>}
        {error && <p className="form-error full-width" role="alert">{error}</p>}
        <div className="form-actions full-width"><button type="button" className="secondary-button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button type="submit" className="primary-button" disabled={busy}>{busy ? "Salvando..." : editor.product ? "Salvar alterações" : "Cadastrar produto"}</button></div>
      </form>}
      {editor?.type === "movement" && <form className="form-grid" onSubmit={saveMovement}>
        <label className="form-field full-width">Produto<select name="productId" required value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} disabled={busy}><option value="">Selecione um produto</option>{activeProducts.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select>{selectedProduct && <small>Saldo disponível: {quantityFormat.format(Number(selectedProduct.quantity))} {selectedProduct.unit}</small>}</label>
        <label className="form-field">Tipo de movimentação<select name="type" value={movementType} onChange={(event) => { setMovementType(event.target.value as "ENTRY" | "EXIT"); setError(""); }} disabled={busy}><option value="ENTRY">Entrada de material</option><option value="EXIT">Saída para obra</option></select></label>
        <label className="form-field">Quantidade{selectedProduct ? ` (${selectedProduct.unit})` : ""}<input name="quantity" type="number" required min="0.001" step="0.001" max={movementType === "EXIT" ? selectedProduct?.quantity : "999999999999.999"} placeholder="0,000" disabled={busy} /></label>
        <label className="form-field full-width">Obra {movementType === "ENTRY" && <span className="field-optional">(opcional)</span>}<select name="projectId" required={movementType === "EXIT"} defaultValue="" disabled={busy}><option value="">{movementType === "EXIT" ? "Selecione a obra de destino" : "Estoque geral"}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></label>
        {movementType === "EXIT" && !projects.length && <p className="form-error full-width">Cadastre uma obra ativa para registrar saídas. <Link href="/registrations" className="text-button">Ir para cadastros</Link></p>}
        <label className="form-field full-width">Motivo<textarea name="reason" required minLength={3} maxLength={500} rows={3} placeholder={movementType === "ENTRY" ? "Ex.: Recebimento da compra de materiais" : "Ex.: Material destinado à execução da fundação"} disabled={busy} /></label>
        {error && <p className="form-error full-width" role="alert">{error}</p>}
        <div className="form-actions full-width"><button type="button" className="secondary-button" disabled={busy} onClick={() => setEditor(null)}>Cancelar</button><button type="submit" className="primary-button" disabled={busy || !selectedProductId || (movementType === "EXIT" && !projects.length)}>{busy ? "Registrando..." : "Registrar movimentação"}</button></div>
      </form>}
    </FormDialog>
  </div>;
}
