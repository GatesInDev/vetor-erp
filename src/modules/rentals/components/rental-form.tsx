"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { PageHeader } from "@/components/ui/page-header";
import { apiRequest } from "@/lib/client-api";
import { RecordTabs } from "@/modules/finance/components/record-tabs";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import type { EquipmentRentalDetail, RentalOptions } from "../types";
import { RentalDocuments } from "./rental-documents";

export function RentalForm({ rental, options, role, initialTab = "details", initialProjectId = "", initialSupplierId = "" }: { rental: EquipmentRentalDetail | null; options: RentalOptions; role: string; initialTab?: "details" | "documents"; initialProjectId?: string; initialSupplierId?: string }) {
  const { t } = useLocale();
  const [tab, setTab] = useState(initialTab);
  const canWrite = ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(role);
  const canCharge = ["ADMIN", "ACCOUNTANT", "FINANCE"].includes(role);
  const title = rental ? `${t(canWrite ? "Editar locação" : "Locação")}: ${rental.number}` : t("Nova locação");
  const draft = useFormDraft({
    number: rental?.number ?? "", equipmentName: rental?.equipmentName ?? "", equipmentIdentifier: rental?.equipmentIdentifier ?? "", quantity: String(rental?.quantity ?? 1),
    projectId: rental?.project.id ?? initialProjectId, supplierId: rental?.supplier.id ?? initialSupplierId, startsAt: rental?.startsAt ?? new Date().toLocaleDateString("en-CA"),
    expectedReturnAt: rental?.expectedReturnAt ?? "", returnedAt: rental?.returnedAt ?? "", notes: rental?.notes ?? "", revision: rental?.revision ?? 0,
  }, { title });
  const disabled = draft.pending || !canWrite;
  const linksLocked = Boolean(rental?.chargeCount);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const { revision, ...values } = draft.values;
    if ((values.expectedReturnAt && values.expectedReturnAt < values.startsAt) || (values.returnedAt && values.returnedAt < values.startsAt)) { setTab("details"); draft.setError(t("As datas de devolução não podem ser anteriores à retirada.")); return; }
    draft.setPending(true);
    draft.setError("");
    try {
      const result = await apiRequest<{ rental: EquipmentRentalDetail }>(`/api/equipment-rentals${rental ? `/${rental.id}` : ""}`, { method: rental ? "PATCH" : "POST", idempotencyKey: draft.mutationKey, body: { ...values, number: values.number.trim(), equipmentName: values.equipmentName.trim(), equipmentIdentifier: values.equipmentIdentifier.trim(), notes: values.notes.trim(), quantity: Number(values.quantity), expectedReturnAt: values.expectedReturnAt || null, returnedAt: values.returnedAt || null, ...(rental ? { revision } : {}) } });
      draft.complete(rental ? "/rentals" : `/rentals/${result.rental.id}`, t(rental ? "Locação atualizada com sucesso." : "Locação cadastrada com sucesso."));
    } catch (failure) { draft.setError(failure instanceof Error ? failure.message : t("Não foi possível salvar a locação.")); }
    finally { draft.setPending(false); }
  }

  const details = <div className="page-stack">
    <FormSection title={t("Equipamento e identificação")} description={t("Identifique o equipamento alugado e a referência da locação.")}>
      <label className="form-field">{t("Número / referência")}<input required maxLength={80} value={draft.values.number} onChange={(event) => draft.setField("number", event.target.value)} disabled={disabled} /></label>
      <label className="form-field">{t("Equipamento")}<input required maxLength={160} value={draft.values.equipmentName} onChange={(event) => draft.setField("equipmentName", event.target.value)} disabled={disabled} /></label>
      <label className="form-field">{t("Identificador / número de série")}<input maxLength={120} value={draft.values.equipmentIdentifier} onChange={(event) => draft.setField("equipmentIdentifier", event.target.value)} disabled={disabled} /></label>
      <label className="form-field">{t("Quantidade")}<input type="number" required min={1} max={9999} step={1} value={draft.values.quantity} onChange={(event) => draft.setField("quantity", event.target.value)} disabled={disabled} /></label>
    </FormSection>
    <FormSection title={t("Obra e locadora")} description={t("Vincule a locação à obra e ao fornecedor responsável.")}>
      <label className="form-field">{t("Obra")}<select required value={draft.values.projectId} onChange={(event) => draft.setField("projectId", event.target.value)} disabled={disabled || linksLocked}><option value="">{t("Selecione uma obra")}</option>{options.projects.map((project) => <option value={project.id} key={project.id}>{project.code} · {project.name}</option>)}</select></label>
      <label className="form-field">{t("Locadora")}<select required value={draft.values.supplierId} onChange={(event) => draft.setField("supplierId", event.target.value)} disabled={disabled || linksLocked}><option value="">{t("Selecione uma locadora")}</option>{options.suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select><small>{t("As locadoras são os parceiros cadastrados como fornecedores.")}</small></label>
      {linksLocked && <p className="muted full-width">{t("A obra e a locadora permanecem vinculadas após o registro da primeira cobrança.")}</p>}
      {(!options.projects.length || !options.suppliers.length) && canWrite && <p className="form-error full-width">{t("Cadastre uma obra ativa e um fornecedor para registrar a locação.")}{" "}<Link className="text-button" href="/registrations">{t("Abrir cadastros")}</Link></p>}
    </FormSection>
    <FormSection title={t("Retirada e devolução")} description={t("A situação da locação acompanha as datas informadas.")}>
      <label className="form-field">{t("Data de retirada")}<input type="date" required value={draft.values.startsAt} onChange={(event) => draft.setField("startsAt", event.target.value)} disabled={disabled} /></label>
      <label className="form-field">{t("Previsão de devolução")}<input type="date" min={draft.values.startsAt} value={draft.values.expectedReturnAt} onChange={(event) => draft.setField("expectedReturnAt", event.target.value)} disabled={disabled} /></label>
      <label className="form-field">{t("Devolvido em")}<input type="date" min={draft.values.startsAt} value={draft.values.returnedAt} onChange={(event) => draft.setField("returnedAt", event.target.value)} disabled={disabled} /><small>{t("Preencha quando o equipamento for devolvido.")}</small></label>
    </FormSection>
    <FormSection title={t("Observações")} defaultOpen={Boolean(draft.values.notes)}><label className="form-field full-width">{t("Observações da locação")}<textarea rows={4} maxLength={2000} value={draft.values.notes} onChange={(event) => draft.setField("notes", event.target.value)} disabled={disabled} /></label></FormSection>
  </div>;

  const content = <form className="page-stack" onSubmit={submit}>
    <RecordTabs label={t("Seções da locação")} value={tab} onChange={setTab} tabs={[{ value: "details", label: t("Dados da locação"), content: details }, { value: "documents", label: t("Documentos e títulos"), count: rental?.chargeCount ?? 0, content: <RentalDocuments rental={rental} canCharge={canCharge} /> }]} />
    {draft.error && <p className="form-error" role="alert">{t(draft.error)}</p>}
    <div className="form-actions"><Link className="secondary-button" href="/rentals">{t("Voltar à lista")}</Link>{canWrite && <button className="primary-button" type="submit" disabled={disabled || !options.projects.length || !options.suppliers.length}>{t(draft.pending ? "Salvando…" : rental ? "Salvar alterações" : "Cadastrar locação")}</button>}</div>
  </form>;
  return canWrite ? <FormPage title={title} description={t("Organize o equipamento, os prazos e os documentos da locação.")} backHref="/rentals">{content}</FormPage> : <div className="page-stack form-page"><PageHeader eyebrow={t("Locações")} title={title} description={t("Consulte os dados e documentos da locação.")} />{content}</div>;
}
