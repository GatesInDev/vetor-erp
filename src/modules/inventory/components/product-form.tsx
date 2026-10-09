"use client";

import { type FormEvent } from "react";
import Link from "next/link";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { apiRequest } from "@/lib/client-api";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import type { InventoryProductSummary } from "@/modules/inventory/types";
import { useLocale } from "@/modules/settings/components/preferences-provider";

type ProductValues = { sku: string; name: string; unit: string; minimumQuantity: string; active: boolean };

export function ProductForm({ product }: { product: InventoryProductSummary | null }) {
  const { t } = useLocale();
  const title = product ? `${t("Editar produto")}: ${product.name}` : t("Novo produto");
  const backHref = "/inventory";
  const { values, setField, error, setError, complete, mutationKey, pending: busy, setPending: setBusy } = useFormDraft<ProductValues>({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    unit: product?.unit ?? "UN",
    minimumQuantity: product?.minimumQuantity ?? "0",
    active: product?.active ?? true,
  }, { title });
  const units = Array.from(new Set(["UN", "KG", "M", "M2", "M3", "L", "CX", "SC", ...(product ? [product.unit] : [])]));

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!values.name.trim() || !values.sku.trim()) {
      setError(t("Preencha o código e o nome do produto."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/inventory/products${product ? `/${product.id}` : ""}`, {
        method: product ? "PATCH" : "POST",
        body: { sku: values.sku.trim(), name: values.name.trim(), unit: values.unit, minimumQuantity: values.minimumQuantity.replace(",", "."), active: values.active },
        idempotencyKey: mutationKey,
      });
      complete(backHref, product ? t("Produto atualizado com sucesso.") : t("Produto cadastrado. Registre uma entrada para informar o saldo inicial."));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Não foi possível salvar o produto."));
    } finally {
      setBusy(false);
    }
  }

  return <FormPage title={title} description={t("Defina como o material será identificado e controlado na operação.")} backHref={backHref}>
    <form className="page-stack" onSubmit={saveProduct}>
      <FormSection title={t("Identificação do material")} description={t("Dados usados nas listas e movimentações de estoque.")} defaultOpen>
        <label className="form-field">{t("Código / SKU")}<input name="sku" required maxLength={60} value={values.sku} onChange={(event) => setField("sku", event.target.value)} placeholder="MAT-001" disabled={busy} /></label>
        <label className="form-field">{t("Unidade de medida")}<select name="unit" required value={values.unit} onChange={(event) => setField("unit", event.target.value)} disabled={busy || Boolean(product)}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>{product && <small>{t("A unidade é preservada para manter o histórico consistente.")}</small>}</label>
        <label className="form-field full-width">{t("Nome do produto")}<input name="name" required maxLength={200} value={values.name} onChange={(event) => setField("name", event.target.value)} placeholder={t("Cimento CP II 50 kg")} disabled={busy} /></label>
      </FormSection>
      <FormSection title={t("Controle de estoque")} description={t("Defina o ponto de reposição e a disponibilidade do produto.")} defaultOpen>
        <label className="form-field">{t("Estoque mínimo")}<input type="number" name="minimumQuantity" required min="0" step="0.001" max="999999999999.999" value={values.minimumQuantity} onChange={(event) => setField("minimumQuantity", event.target.value)} disabled={busy} /><small>{t("Um aviso aparece quando o saldo atingir este valor.")}</small></label>
        <label className="checkbox-field"><input type="checkbox" name="active" checked={values.active} onChange={(event) => setField("active", event.target.checked)} disabled={busy} /><span>{t("Produto ativo")}<small>{t("Disponível para movimentações.")}</small></span></label>
        {!product && <p className="section-description full-width">{t("O saldo inicial será zero. Após cadastrar, registre uma entrada com a quantidade disponível.")}</p>}
      </FormSection>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="form-actions"><Link className="secondary-button" href={backHref}>{t("Voltar à lista")}</Link><button type="submit" className="primary-button" disabled={busy}>{busy ? t("Salvando...") : product ? t("Salvar alterações") : t("Cadastrar produto")}</button></div>
    </form>
  </FormPage>;
}
