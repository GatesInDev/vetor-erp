"use client";

import { type FormEvent } from "react";
import Link from "next/link";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/client-api";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import type { InventoryProductSummary } from "@/modules/inventory/types";
import { useLocale } from "@/modules/settings/components/preferences-provider";

type ProjectOption = { id: string; code: string; name: string };
type MovementValues = { productId: string; type: "ENTRY" | "EXIT"; quantity: string; projectId: string; reason: string };

export function MovementForm({ products, projects, initialProductId }: { products: InventoryProductSummary[]; projects: ProjectOption[]; initialProductId: string }) {
  const { t, formatNumber } = useLocale();
  const title = t("Movimentar estoque");
  const backHref = "/inventory?tab=movements";
  const { values, setField, error, setError, complete, mutationKey, pending: busy, setPending: setBusy } = useFormDraft<MovementValues>({
    productId: initialProductId,
    type: "ENTRY",
    quantity: "",
    projectId: "",
    reason: "",
  }, { title });
  const selectedProduct = products.find((product) => product.id === values.productId);

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!selectedProduct || !values.reason.trim()) {
      setError(t("Selecione um produto ativo e informe o motivo da movimentação."));
      return;
    }
    const quantity = values.quantity.replace(",", ".");
    if (values.type === "EXIT" && Number(quantity) > Number(selectedProduct.quantity)) {
      setError(t("A quantidade de saída é maior que o saldo disponível."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/inventory/movements", {
        method: "POST",
        body: { productId: values.productId, type: values.type, quantity, reason: values.reason.trim(), ...(values.projectId ? { projectId: values.projectId } : {}) },
        idempotencyKey: mutationKey,
      });
      complete(backHref, values.type === "ENTRY" ? t("Entrada registrada. O saldo do produto foi atualizado.") : t("Saída registrada e vinculada à obra."));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Não foi possível registrar a movimentação."));
    } finally {
      setBusy(false);
    }
  }

  return <FormPage title={title} description={t("Registre uma entrada ou destine materiais a uma obra. O saldo é atualizado ao salvar.")} backHref={backHref}>
    {!products.length ? <EmptyState title={t("Cadastre um produto para começar")} description={t("As movimentações precisam de um produto ativo no estoque.")} action={<Link className="primary-button" href="/inventory/products/new">{t("Cadastrar produto")}</Link>} /> : <form className="page-stack" onSubmit={saveMovement}>
      <FormSection title={t("Material e quantidade")} description={t("Selecione o produto e o tipo de movimentação.")} defaultOpen>
        <label className="form-field full-width">{t("Produto")}<select name="productId" required value={values.productId} onChange={(event) => setField("productId", event.target.value)} disabled={busy}><option value="">{t("Selecione um produto")}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select>{selectedProduct && <small>{t("Saldo disponível:")} {formatNumber(Number(selectedProduct.quantity))} {selectedProduct.unit}</small>}</label>
        <label className="form-field">{t("Tipo de movimentação")}<select name="type" value={values.type} onChange={(event) => { setField("type", event.target.value as "ENTRY" | "EXIT"); setError(""); }} disabled={busy}><option value="ENTRY">{t("Entrada de material")}</option><option value="EXIT">{t("Saída para obra")}</option></select></label>
        <label className="form-field">{t("Quantidade")}{selectedProduct ? ` (${selectedProduct.unit})` : ""}<input name="quantity" type="number" required min="0.001" step="0.001" max={values.type === "EXIT" ? selectedProduct?.quantity : "999999999999.999"} value={values.quantity} onChange={(event) => setField("quantity", event.target.value)} placeholder={formatNumber(0)} disabled={busy} /></label>
      </FormSection>
      <FormSection title={t("Destino e rastreabilidade")} description={t("Vincule o material à obra e registre o motivo.")} defaultOpen>
        <label className="form-field full-width">{t("Obra")} {values.type === "ENTRY" && <span className="field-optional">{t("(opcional)")}</span>}<select name="projectId" required={values.type === "EXIT"} value={values.projectId} onChange={(event) => setField("projectId", event.target.value)} disabled={busy}><option value="">{values.type === "EXIT" ? t("Selecione a obra de destino") : t("Estoque geral")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></label>
        {values.type === "EXIT" && !projects.length && <p className="form-error full-width">{t("Cadastre uma obra ativa para registrar saídas.")} <Link href="/registrations/projects/new" className="text-button">{t("Cadastrar obra")}</Link></p>}
        <label className="form-field full-width">{t("Motivo")}<textarea name="reason" required minLength={3} maxLength={500} rows={3} value={values.reason} onChange={(event) => setField("reason", event.target.value)} placeholder={values.type === "ENTRY" ? t("Ex.: Recebimento da compra de materiais") : t("Ex.: Material destinado à execução da fundação")} disabled={busy} /></label>
      </FormSection>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="form-actions"><Link className="secondary-button" href={backHref}>{t("Voltar à lista")}</Link><button type="submit" className="primary-button" disabled={busy || !selectedProduct || (values.type === "EXIT" && !projects.length)}>{busy ? t("Registrando...") : t("Registrar movimentação")}</button></div>
    </form>}
  </FormPage>;
}
