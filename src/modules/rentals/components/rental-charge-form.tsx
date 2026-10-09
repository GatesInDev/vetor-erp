"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { FileUp, X } from "lucide-react";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { apiRequest } from "@/lib/client-api";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import { rentalFileLimit, type RentalDocumentPreview, type RentalFileInput } from "../documents-schema";
import type { EquipmentRentalDetail, RentalDocumentKind } from "../types";
import { rentalDocumentKinds } from "./rental-labels";
import { formatRentalTotal } from "./rental-total";

const importMessages: Record<string, string> = {
  "Review the imported values before recording the charge.": "Confira os valores importados antes de registrar a cobrança.",
  "No supported invoice fields were found. Enter the document details manually.": "Não foi possível extrair todos os campos. Complete os dados do documento manualmente.",
  "PDF files are attached without automatic field extraction.": "Arquivos PDF são anexados sem extração automática de campos.",
  "Only one XML invoice can be imported at a time.": "Importe apenas um XML por cobrança.",
  "Multiple invoices were found. Import one invoice per charge.": "Foram encontradas várias notas. Importe uma nota por cobrança.",
  "Select an XML file to import.": "Selecione um arquivo XML para importar.",
};

function fileSize(file: RentalFileInput) {
  return file.contentBase64.length * 3 / 4 - (file.contentBase64.endsWith("==") ? 2 : file.contentBase64.endsWith("=") ? 1 : 0);
}

function readFile(file: File): Promise<RentalFileInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File reading failed"));
    reader.onload = () => resolve({ fileName: file.name, mediaType: /\.xml$/i.test(file.name) ? "application/xml" : "application/pdf", contentBase64: String(reader.result).split(",")[1] });
    reader.readAsDataURL(file);
  });
}

export function RentalChargeForm({ rental }: { rental: EquipmentRentalDetail }) {
  const { t, locale, decimalPlaces, formatDate } = useLocale();
  const formatMoney = (amount: string) => formatRentalTotal([amount], locale, decimalPlaces);
  const backHref = `/rentals/${rental.id}?tab=documents`;
  const [preview, setPreview] = useState<RentalDocumentPreview | null>(null);
  const [notice, setNotice] = useState("");
  const draft = useFormDraft({ documentKind: "NFSE" as RentalDocumentKind, documentNumber: "", issuedAt: new Date().toLocaleDateString("en-CA"), dueAt: new Date().toLocaleDateString("en-CA"), amount: "", documentUrl: "", notes: "", files: [] as RentalFileInput[] }, { title: `${t("Registrar cobrança")}: ${rental.number}` });

  async function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length || draft.pending) return;
    draft.setError("");
    setNotice("");
    if (selected.some((file) => !/\.(xml|pdf)$/i.test(file.name))) { draft.setError(t("Selecione apenas arquivos XML ou PDF.")); return; }
    if (draft.values.files.length + selected.length > 3 || draft.values.files.reduce((size, file) => size + fileSize(file), 0) + selected.reduce((size, file) => size + file.size, 0) > rentalFileLimit) { draft.setError(t("Selecione até 3 arquivos, com tamanho total de até 2 MiB.")); return; }
    if (selected.some((file) => !file.size || file.name.length > 180)) { draft.setError(t("Os arquivos precisam ter conteúdo e nomes de até 180 caracteres.")); return; }
    draft.setPending(true);
    try {
      const files = await Promise.all(selected.map(readFile));
      draft.setField("files", [...draft.values.files, ...files]);
      setPreview(null);
    } catch { draft.setError(t("Não foi possível ler os arquivos selecionados.")); }
    finally { draft.setPending(false); }
  }

  async function loadPreview() {
    if (draft.pending) return;
    draft.setPending(true);
    draft.setError("");
    setNotice("");
    setPreview(null);
    try { setPreview(await apiRequest<RentalDocumentPreview>(`/api/equipment-rentals/${rental.id}/documents/preview`, { method: "POST", body: { files: draft.values.files } })); }
    catch (failure) { draft.setError(failure instanceof Error ? failure.message : t("Não foi possível ler o XML.")); }
    finally { draft.setPending(false); }
  }

  function applyPreview() {
    if (!preview || draft.pending) return;
    draft.setValues((current) => ({ ...current, ...preview.fields }));
    setNotice(t("Dados do XML aplicados. Confira os campos e o vencimento antes de registrar."));
    setPreview(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.pending) return;
    if (draft.values.dueAt < draft.values.issuedAt) { draft.setError(t("O vencimento não pode ser anterior à emissão.")); return; }
    draft.setPending(true);
    draft.setError("");
    try {
      await apiRequest(`/api/equipment-rentals/${rental.id}/charges`, { method: "POST", idempotencyKey: draft.mutationKey, body: { ...draft.values, documentNumber: draft.values.documentNumber.trim(), documentUrl: draft.values.documentUrl.trim(), notes: draft.values.notes.trim() } });
      draft.complete(backHref, t("Cobrança registrada. A conta a pagar está vinculada à locação."));
    } catch (failure) { draft.setError(failure instanceof Error ? failure.message : t("Não foi possível registrar a cobrança.")); }
    finally { draft.setPending(false); }
  }

  return <FormPage title={`${t("Registrar cobrança")}: ${rental.number}`} description={t("Confira o documento recebido da locadora. Ao registrar, será criada uma conta a pagar para esta obra.")} backHref={backHref}>
    <form className="page-stack" onSubmit={submit}>
      <FormSection title={t("Locação vinculada")} description={`${rental.equipmentName} · ${rental.supplier.name}`}><div className="form-field"><span>{t("Obra")}</span><strong>{rental.project.name}</strong></div><div className="form-field"><span>{t("Número / referência")}</span><strong>{rental.number}</strong></div></FormSection>
      <FormSection title={t("Importar XML ou anexar PDF")} description={t("Os arquivos serão salvos com a cobrança. A leitura do XML apenas sugere campos para conferência.")}>
        <label className="form-field full-width">{t("Arquivos do documento")}<input type="file" accept=".xml,.pdf,application/xml,text/xml,application/pdf" multiple disabled={draft.pending || draft.values.files.length >= 3} onChange={selectFiles} /><small>{t("Até 3 arquivos e 2 MiB no total. PDF é anexado sem leitura automática.")}</small></label>
        {draft.values.files.length > 0 && <div className="page-stack full-width">{draft.values.files.map((file, index) => <div className="inline-actions" key={`${index}-${file.fileName}`}><span className="table-primary">{file.fileName}</span><span className="muted">{Math.ceil(fileSize(file) / 1024)} KiB</span><button className="icon-button" type="button" aria-label={`${t("Remover arquivo")}: ${file.fileName}`} disabled={draft.pending} onClick={() => { draft.setField("files", draft.values.files.filter((_, item) => item !== index)); setPreview(null); setNotice(""); }}><X size={17} /></button></div>)}</div>}
        <div className="inline-actions full-width"><button type="button" className="secondary-button" disabled={draft.pending || !draft.values.files.some((file) => file.mediaType === "application/xml")} onClick={loadPreview}><FileUp size={17} />{t("Ler XML")}</button></div>
        {preview && <div className="settlement-summary full-width"><strong>{t("Conferir dados encontrados")}</strong><div className="form-grid">{preview.fields.documentKind && <div className="form-field"><span>{t("Tipo de documento")}</span><strong>{t(rentalDocumentKinds[preview.fields.documentKind])}</strong></div>}{preview.fields.documentNumber && <div className="form-field"><span>{t("Número do documento")}</span><strong>{preview.fields.documentNumber}</strong></div>}{preview.fields.issuedAt && <div className="form-field"><span>{t("Data de emissão")}</span><strong>{formatDate(preview.fields.issuedAt)}</strong></div>}{preview.fields.amount && <div className="form-field"><span>{t("Valor a pagar")}</span><strong>{formatMoney(preview.fields.amount)}</strong></div>}</div>{preview.warnings.map((warning) => <p className="muted" key={warning}>{t(importMessages[warning] ?? warning)}</p>)}{Object.keys(preview.fields).length > 0 && <><p className="muted">{t("Aplicar substitui somente os campos encontrados no XML. Revise o vencimento e os demais dados.")}</p><div><button type="button" className="secondary-button" disabled={draft.pending} onClick={applyPreview}>{t("Aplicar dados do XML")}</button></div></>}</div>}
        {notice && <p className="form-success full-width" role="status">{notice}</p>}
      </FormSection>
      <FormSection title={t("Documento recebido")} description={t("Preencha ou revise os dados antes de confirmar a cobrança.")}>
        <label className="form-field">{t("Tipo de documento")}<select value={draft.values.documentKind} onChange={(event) => draft.setField("documentKind", event.target.value as RentalDocumentKind)} disabled={draft.pending}>{Object.entries(rentalDocumentKinds).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label>
        <label className="form-field">{t("Número do documento")}<input required maxLength={80} value={draft.values.documentNumber} onChange={(event) => draft.setField("documentNumber", event.target.value)} disabled={draft.pending} /></label>
        <label className="form-field">{t("Data de emissão")}<input required type="date" value={draft.values.issuedAt} onChange={(event) => draft.setField("issuedAt", event.target.value)} disabled={draft.pending} /></label>
        <label className="form-field">{t("Vencimento")}<input required type="date" min={draft.values.issuedAt} value={draft.values.dueAt} onChange={(event) => draft.setField("dueAt", event.target.value)} disabled={draft.pending} /></label>
        <label className="form-field">{t("Valor a pagar (R$)")}<input required type="number" min="0.01" max="99999999999999.99" step="0.01" value={draft.values.amount} onChange={(event) => draft.setField("amount", event.target.value)} disabled={draft.pending} /></label>
        <label className="form-field">{t("Link externo do documento")}<input type="url" maxLength={2000} placeholder="https://" value={draft.values.documentUrl} onChange={(event) => draft.setField("documentUrl", event.target.value)} disabled={draft.pending} /><small>{t("Opcional, para consultar o documento no portal da locadora.")}</small></label>
        <label className="form-field full-width">{t("Observações da cobrança")}<textarea rows={3} maxLength={2000} value={draft.values.notes} onChange={(event) => draft.setField("notes", event.target.value)} disabled={draft.pending} /></label>
      </FormSection>
      {draft.error && <p className="form-error" role="alert">{t(draft.error)}</p>}
      <div className="form-actions"><Link className="secondary-button" href={backHref}>{t("Voltar à locação")}</Link><button className="primary-button" type="submit" disabled={draft.pending}>{t(draft.pending ? "Processando…" : "Registrar cobrança e gerar conta")}</button></div>
    </form>
  </FormPage>;
}
