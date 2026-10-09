"use client";

import Link from "next/link";
import { type FormEvent } from "react";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { apiRequest } from "@/lib/client-api";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import { dateInputToIso, today, type SelectOption } from "./types";

type DocumentValues = {
  number: string; description: string; amount: string; partnerId: string; projectId: string;
  serviceDate: string; dueAt: string; taxAnnex: string; issAmount: string; inssAmount: string;
};

export function DocumentForm({ kind, partners, projects }: { kind: "invoice" | "contract"; partners: SelectOption[]; projects: SelectOption[] }) {
  const { t } = useLocale();
  const isInvoice = kind === "invoice";
  const title = isInvoice ? t("Registrar serviço") : t("Novo contrato");
  const backHref = `/billing?tab=${isInvoice ? "invoices" : "contracts"}`;
  const { values, setField, error, setError, pending, setPending, mutationKey, complete } = useFormDraft<DocumentValues>({
    number: "", description: "", amount: "", partnerId: "", projectId: "", serviceDate: today(), dueAt: today(), taxAnnex: "III", issAmount: "0", inssAmount: "0",
  }, { title });
  const canSubmit = partners.length > 0 && projects.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!values.number.trim() || (!isInvoice && !values.description.trim())) {
      setError(isInvoice ? t("Informe o número ou a referência do serviço.") : t("Informe o número e a descrição do contrato."));
      return;
    }
    if (Number(values.issAmount) + Number(values.inssAmount) >= Number(values.amount)) {
      setError(t("As retenções devem ser menores que o valor bruto."));
      return;
    }
    const common = { number: values.number.trim(), projectId: values.projectId, amount: values.amount, issAmount: values.issAmount || "0", inssAmount: values.inssAmount || "0" };
    const body = isInvoice
      ? { ...common, customerId: values.partnerId, serviceDate: dateInputToIso(values.serviceDate), dueAt: dateInputToIso(values.dueAt), taxAnnex: values.taxAnnex }
      : { ...common, contractorId: values.partnerId, description: values.description.trim() };
    setPending(true);
    setError("");
    try {
      await apiRequest(isInvoice ? "/api/invoices" : "/api/contracts", { method: "POST", body, idempotencyKey: mutationKey });
      complete(backHref, isInvoice ? t("Serviço registrado. O título a receber já está no Financeiro.") : t("Contrato cadastrado. Registre uma medição para acompanhar a execução."));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Não foi possível salvar."));
    } finally { setPending(false); }
  }

  return <FormPage title={title} backHref={backHref} description={isInvoice ? t("Registre a receita e gere o título a receber. A emissão fiscal da NFS-e é feita fora deste cadastro.") : t("Vincule um prestador à obra. O valor a pagar será gerado ao aprovar uma medição.")}>
    {!canSubmit && <p className="form-error">{t("Cadastre")}{" "}{partners.length ? t("uma obra ativa") : isInvoice ? t("um cliente") : t("um fornecedor")}{" "}{t("para continuar.")}{" "}<Link className="text-button" href={partners.length ? "/registrations/projects/new" : "/registrations/partners/new"}>{t("Abrir cadastro")}</Link></p>}
    <form onSubmit={submit}>
      <FormSection title={t("Identificação e vínculo")} description={t("Referência do documento, parceiro e obra vinculada.")}>
        <label className="form-field">{t("Número / referência")}<input name="number" required maxLength={60} value={values.number} onChange={(event) => setField("number", event.target.value)} disabled={pending} /></label>
        <label className="form-field">{isInvoice ? t("Cliente") : t("Fornecedor")}<select name="partnerId" required value={values.partnerId} onChange={(event) => setField("partnerId", event.target.value)} disabled={pending}><option value="">{t("Selecione")}</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>
        <label className="form-field full-width">{t("Obra / centro de custo")}<select name="projectId" required value={values.projectId} onChange={(event) => setField("projectId", event.target.value)} disabled={pending}><option value="">{t("Selecione")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        {!isInvoice && <label className="form-field full-width">{t("Descrição do contrato")}<textarea name="description" required maxLength={500} value={values.description} onChange={(event) => setField("description", event.target.value)} disabled={pending} /></label>}
      </FormSection>
      <FormSection title={t("Valores e prazos")} description={isInvoice ? t("Informe o valor bruto e as datas do serviço.") : t("Informe o valor bruto contratado.")}>
        <label className="form-field">{t("Valor bruto (R$)")}<input name="amount" type="number" required step="0.01" min="0.01" max="999999999999.99" value={values.amount} onChange={(event) => setField("amount", event.target.value)} disabled={pending} /></label>
        {isInvoice && <>
          <label className="form-field">{t("Anexo tributário")}<select name="taxAnnex" value={values.taxAnnex} onChange={(event) => setField("taxAnnex", event.target.value)} disabled={pending}><option value="III">{t("Anexo III")}</option><option value="IV">{t("Anexo IV")}</option></select></label>
          <label className="form-field">{t("Data do serviço")}<input name="serviceDate" type="date" required value={values.serviceDate} onChange={(event) => setField("serviceDate", event.target.value)} disabled={pending} /></label>
          <label className="form-field">{t("Vencimento")}<input name="dueAt" type="date" required value={values.dueAt} onChange={(event) => setField("dueAt", event.target.value)} disabled={pending} /></label>
        </>}
      </FormSection>
      <FormSection title={t("Retenções")} description={t("Valores opcionais de ISS e INSS retidos.")} defaultOpen={false}>
        <label className="form-field">{t("ISS retido (R$)")}<input name="issAmount" type="number" step="0.01" min="0" max={values.amount || undefined} value={values.issAmount} onChange={(event) => setField("issAmount", event.target.value)} disabled={pending} /></label>
        <label className="form-field">{t("INSS retido (R$)")}<input name="inssAmount" type="number" step="0.01" min="0" max={values.amount || undefined} value={values.inssAmount} onChange={(event) => setField("inssAmount", event.target.value)} disabled={pending} /></label>
      </FormSection>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="form-actions"><Link href={backHref} className="secondary-button">{t("Voltar à lista")}</Link><button className="primary-button" disabled={pending || !canSubmit}>{pending ? t("Salvando…") : isInvoice ? t("Registrar serviço") : t("Cadastrar contrato")}</button></div>
    </form>
  </FormPage>;
}
