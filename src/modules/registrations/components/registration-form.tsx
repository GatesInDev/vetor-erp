"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { apiRequest } from "@/lib/client-api";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import type { PartnerSummary, ProjectSummary } from "@/modules/registrations/types";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { RecordTabs } from "@/modules/finance/components/record-tabs";
import type { EquipmentRentalRow } from "@/modules/rentals/types";
import { RegistrationRentals } from "./registration-rentals";

type RegistrationFormProps =
  | { type: "projects"; record: ProjectSummary | null }
  | { type: "partners"; record: PartnerSummary | null };

type RegistrationValues = {
  name: string;
  code: string;
  active: boolean;
  customer: boolean;
  supplier: boolean;
  taxId: string;
};

export function RegistrationForm(props: RegistrationFormProps & { rentals?: EquipmentRentalRow[] }) {
  const { t } = useLocale();
  const [tab, setTab] = useState<"details" | "rentals">("details");
  const { type, record } = props;
  const project = props.type === "projects" ? props.record : null;
  const partner = props.type === "partners" ? props.record : null;
  const title = type === "projects"
    ? record ? `${t("Editar obra")}: ${record.name}` : t("Nova obra")
    : record ? `${t("Editar cadastro")}: ${record.name}` : t("Novo cliente ou fornecedor");
  const backHref = `/registrations?tab=${type}`;
  const { values, setField, error, setError, complete, mutationKey, pending: busy, setPending: setBusy } = useFormDraft<RegistrationValues>({
    name: record?.name ?? "",
    code: project?.code ?? "",
    active: project?.active ?? true,
    customer: partner?.customer ?? true,
    supplier: partner?.supplier ?? false,
    taxId: "",
  }, { title });

  async function saveRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const taxId = values.taxId.trim();
    if (!values.name.trim() || (type === "projects" && !values.code.trim())) {
      setError(t("Preencha os campos obrigatórios com um nome e código válidos."));
      return;
    }
    if (type === "partners" && !values.customer && !values.supplier) {
      setError(t("Selecione ao menos um perfil: cliente ou fornecedor."));
      return;
    }
    if (type === "partners" && taxId && (!/^[\d.\-/\s]+$/.test(taxId) || ![11, 14].includes(taxId.replace(/\D/g, "").length))) {
      setError(t("Informe um CPF com 11 dígitos ou um CNPJ com 14 dígitos."));
      return;
    }
    const body = type === "projects"
      ? { name: values.name.trim(), code: values.code.trim(), active: values.active }
      : { name: values.name.trim(), customer: values.customer, supplier: values.supplier, ...(taxId ? { taxId: taxId.replace(/\D/g, "") } : {}) };
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/${type}${record ? `/${record.id}` : ""}`, {
        method: record ? "PATCH" : "POST",
        body,
        idempotencyKey: mutationKey,
      });
      complete(backHref, record ? t("Cadastro atualizado com sucesso.") : t("Cadastro criado com sucesso."));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Não foi possível salvar o cadastro."));
    } finally {
      setBusy(false);
    }
  }

  const form = <form className="page-stack" onSubmit={saveRegistration}>
      <FormSection title={t("Identificação")} description={type === "projects" ? t("Informações usadas para localizar a obra nos demais módulos.") : t("Nome que identifica a pessoa ou empresa nos documentos.")} defaultOpen>
        <div className="form-grid">
          {type === "projects" && <label className="form-field">{t("Código da obra")}<input name="code" required maxLength={60} value={values.code} onChange={(event) => setField("code", event.target.value)} placeholder="OBR-001" disabled={busy} /></label>}
          <label className={`form-field ${type === "partners" ? "full-width" : ""}`}>{type === "projects" ? t("Nome da obra") : t("Nome ou razão social")}<input name="name" required maxLength={200} value={values.name} onChange={(event) => setField("name", event.target.value)} placeholder={type === "projects" ? t("Residencial Horizonte") : t("Nome da pessoa ou empresa")} disabled={busy} /></label>
        </div>
      </FormSection>
      {type === "projects" ? <FormSection title={t("Situação da obra")} description={t("Controle a disponibilidade para novos lançamentos.")} defaultOpen>
        <label className="checkbox-field"><input type="checkbox" name="active" checked={values.active} onChange={(event) => setField("active", event.target.checked)} disabled={busy} /><span>{t("Obra ativa")}<small>{t("Obras inativas preservam todo o histórico.")}</small></span></label>
      </FormSection> : <>
        <FormSection title={t("Relacionamento")} description={t("Um mesmo contato pode ser cliente e fornecedor.")} defaultOpen>
          <fieldset className="form-field"><legend>{t("Perfil do cadastro")}</legend><div className="checkbox-options">
            <label className="checkbox-field"><input type="checkbox" name="customer" checked={values.customer} onChange={(event) => setField("customer", event.target.checked)} disabled={busy} />{t("Cliente")}</label>
            <label className="checkbox-field"><input type="checkbox" name="supplier" checked={values.supplier} onChange={(event) => setField("supplier", event.target.checked)} disabled={busy} />{t("Fornecedor")}</label>
          </div></fieldset>
        </FormSection>
        <FormSection title={t("Documento fiscal")} description={partner?.hasTaxId ? t("Já existe um documento cadastrado. Preencha apenas para substituí-lo.") : t("Informação opcional para identificar o contato.")}>
          <label className="form-field">{t("CPF ou CNPJ")} <span className="field-optional">{t("(opcional)")}</span><input name="taxId" inputMode="numeric" maxLength={18} value={values.taxId} onChange={(event) => setField("taxId", event.target.value)} placeholder={partner?.hasTaxId ? t("Deixe em branco para manter o documento atual") : t("Apenas números")} disabled={busy} /></label>
        </FormSection>
      </>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="form-actions"><Link className="secondary-button" href={backHref}>{t("Voltar à lista")}</Link><button type="submit" className="primary-button" disabled={busy}>{busy ? t("Salvando...") : record ? t("Salvar alterações") : t("Criar cadastro")}</button></div>
    </form>;
  return <FormPage title={title} description={type === "projects" ? t("Organize os dados da obra e defina sua situação na operação.") : t("Organize os dados do contato e seu relacionamento com a empresa.")} backHref={backHref}>
    {record && props.rentals ? <RecordTabs label={t("Dados do cadastro")} value={tab} onChange={setTab} tabs={[
      { value: "details", label: t("Dados do cadastro"), content: form },
      { value: "rentals", label: t("Locações"), count: props.rentals.length, content: <RegistrationRentals rentals={props.rentals} type={type} recordId={record.id} /> },
    ]} /> : form}
  </FormPage>;
}
