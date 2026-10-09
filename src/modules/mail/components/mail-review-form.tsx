"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Download, FileUp } from "lucide-react";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { apiRequest } from "@/lib/client-api";
import { rentalFileLimit, type RentalDocumentPreview } from "@/modules/rentals/documents-schema";
import { rentalDocumentKinds } from "@/modules/rentals/components/rental-labels";
import { formatRentalTotal } from "@/modules/rentals/components/rental-total";
import type { EquipmentRentalRow, RentalDocumentKind } from "@/modules/rentals/types";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import type { MailMessageDetail } from "../types";
import { mailWarning } from "./mail-warning";
import { suggestMailRental } from "./rental-suggestion";

type ImportedCharge = { rentalId: string; chargeId: string; payableId: string | null };

function emptyReview() {
  const today = new Date().toLocaleDateString("en-CA");
  return { rentalId: "", attachmentIds: [] as string[], documentKind: "NFSE" as RentalDocumentKind, documentNumber: "", issuedAt: today, dueAt: today, amount: "", documentUrl: "", notes: "", reviewed: false };
}

export function MailReviewForm({ message, rentals, onImported }: { message: MailMessageDetail; rentals: EquipmentRentalRow[]; onImported: (result: ImportedCharge, attachmentIds: string[]) => void }) {
  const { t, locale, decimalPlaces, formatDate } = useLocale();
  const draft = useFormDraft(emptyReview(), { title: `${t("Revisar e-mail")}: ${message.subject || t("Sem assunto")}` });
  const [preview, setPreview] = useState<RentalDocumentPreview | null>(null);
  const [notice, setNotice] = useState("");
  const [imported, setImported] = useState<ImportedCharge | null>(null);
  const selected = message.attachments.filter((attachment) => draft.values.attachmentIds.includes(attachment.id));
  const selectedSize = selected.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
  const hasAvailable = message.attachments.some((attachment) => !attachment.rentalChargeId);
  const rental = rentals.find((item) => item.id === draft.values.rentalId);
  const suggestedRental = suggestMailRental(`${message.subject}\n${message.bodyText}`, rentals);
  const formatMoney = (value: string) => formatRentalTotal([value], locale, decimalPlaces);

  function toggleAttachment(id: string, checked: boolean) {
    if (checked) {
      const attachment = message.attachments.find((item) => item.id === id);
      if (!attachment || attachment.rentalChargeId) return;
      if (selected.length >= 3 || selectedSize + attachment.sizeBytes > rentalFileLimit) {
        draft.setError(t("Selecione até 3 anexos, com tamanho total de até 2 MiB."));
        return;
      }
      if (attachment.mediaType === "application/xml" && selected.some((item) => item.mediaType === "application/xml")) {
        draft.setError(t("Selecione somente um XML por cobrança."));
        return;
      }
    }
    draft.setValues((values) => ({ ...values, attachmentIds: checked ? [...values.attachmentIds, id] : values.attachmentIds.filter((item) => item !== id), reviewed: false }));
    draft.setError("");
    setPreview(null);
    setNotice("");
  }

  function selectionError() {
    if (!selected.length) return t("Selecione os anexos desta cobrança.");
    if (selected.length !== draft.values.attachmentIds.length || selected.some((attachment) => attachment.rentalChargeId)) return t("Algum anexo já foi utilizado. Atualize a mensagem e revise a seleção.");
    if (selected.length > 3 || selectedSize > rentalFileLimit) return t("Selecione até 3 anexos, com tamanho total de até 2 MiB.");
    if (selected.filter((attachment) => attachment.mediaType === "application/xml").length > 1) return t("Selecione somente um XML por cobrança.");
    return "";
  }

  async function readXml() {
    if (draft.pending) return;
    const invalid = selectionError();
    if (invalid) { draft.setError(invalid); return; }
    draft.setPending(true);
    draft.setError("");
    setPreview(null);
    setNotice("");
    try { setPreview(await apiRequest<RentalDocumentPreview>(`/api/mail/messages/${message.id}/preview`, { method: "POST", body: { attachmentIds: draft.values.attachmentIds } })); }
    catch (failure) { draft.setError(failure instanceof Error ? failure.message : t("Não foi possível ler o XML.")); }
    finally { draft.setPending(false); }
  }

  function applyPreview() {
    if (!preview || draft.pending) return;
    draft.setValues((values) => ({ ...values, ...preview.fields, reviewed: false }));
    setPreview(null);
    setNotice(t("Dados do XML aplicados. Confira os campos e o vencimento antes de registrar."));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.pending) return;
    const invalid = selectionError();
    if (invalid) { draft.setError(invalid); return; }
    if (draft.values.dueAt < draft.values.issuedAt) { draft.setError(t("O vencimento não pode ser anterior à emissão.")); return; }
    if (!draft.values.reviewed) { draft.setError(t("Confira os dados e marque a confirmação de revisão.")); return; }
    draft.setPending(true);
    draft.setError("");
    try {
      const { rentalId, attachmentIds, documentKind, documentNumber, issuedAt, dueAt, amount, documentUrl, notes } = draft.values;
      const result = await apiRequest<ImportedCharge>(`/api/mail/messages/${message.id}/import-charge`, { method: "POST", idempotencyKey: draft.mutationKey, body: { rentalId, attachmentIds, charge: { documentKind, documentNumber: documentNumber.trim(), issuedAt, dueAt, amount, documentUrl: documentUrl.trim(), notes: notes.trim() } } });
      setImported(result);
      setPreview(null);
      setNotice("");
      draft.acceptValues(emptyReview());
      onImported(result, attachmentIds);
    } catch (failure) { draft.setError(failure instanceof Error ? failure.message : t("Não foi possível importar a cobrança.")); }
    finally { draft.setPending(false); }
  }

  return <FormPage title={t("Revisar e-mail")} description={t("Selecione os arquivos de uma cobrança, confira os dados e escolha a locação correspondente.")} backHref="/mail">
    {imported && <section className="island panel page-stack" role="status"><strong>{t(imported.payableId ? "Cobrança importada e conta a pagar criada." : "Cobrança importada. Confira os vínculos na locação.")}</strong><div className="inline-actions"><Link className="text-button" href={`/rentals/${imported.rentalId}?tab=documents`}>{t("Ver locação")}</Link>{imported.payableId && <><Link className="text-button" href={`/finance/payables/${imported.payableId}`}>{t("Ver conta a pagar")}</Link><Link className="text-button" href={`/finance/titles/new?accountType=PAYABLE&accountId=${imported.payableId}`}>{t("Vincular título")}</Link></>}</div><p className="muted">{t("Se a mensagem tiver outra cobrança, selecione os anexos restantes e faça uma nova revisão.")}</p></section>}
    <form className="page-stack" onSubmit={submit}>
      <FormSection title={t("Mensagem recebida")} description={message.subject || t("Sem assunto")}>
        <div className="form-field"><span>{t("Remetente")}</span><strong style={{ overflowWrap: "anywhere" }}>{message.from}</strong></div><div className="form-field"><span>{t("Recebido em")}</span><strong>{formatDate(message.receivedAt, { dateStyle: "short", timeStyle: "short" })}</strong></div>
        <div className="full-width" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 320, overflowY: "auto" }}>{message.bodyText || t("Esta mensagem não possui conteúdo em texto disponível.")}</div>
        {message.warnings.length > 0 && <div className="page-stack full-width">{message.warnings.map((warning, index) => <p key={index} className="muted">{mailWarning(warning, t)}</p>)}</div>}
      </FormSection>
      <FormSection title={t("Anexos para esta cobrança")} description={t("Selecione até 3 anexos, com tamanho total de até 2 MiB.")}>
        <div className="table-scroll full-width"><table className="data-table"><thead><tr><th>{t("Selecionar")}</th><th>{t("Arquivo")}</th><th>{t("Tamanho")}</th><th>{t("Situação")}</th><th>{t("Ações")}</th></tr></thead><tbody>{message.attachments.map((attachment) => <tr key={attachment.id}>
          <td><label className="checkbox-field"><input type="checkbox" aria-label={`${t("Selecionar anexo")}: ${attachment.fileName}`} checked={draft.values.attachmentIds.includes(attachment.id)} disabled={draft.pending || Boolean(attachment.rentalChargeId)} onChange={(event) => toggleAttachment(attachment.id, event.target.checked)} /></label></td>
          <td><span className="table-primary" style={{ overflowWrap: "anywhere", maxWidth: 360 }}>{attachment.fileName}</span><span className="table-secondary">{attachment.mediaType === "application/xml" ? "XML" : "PDF"}</span></td><td>{Math.ceil(attachment.sizeBytes / 1024)} KiB</td><td><span className="status-badge" data-tone={attachment.rentalChargeId ? "success" : "accent"}>{t(attachment.rentalChargeId ? "Importado" : "Disponível para revisão")}</span></td>
          <td><div className="table-actions"><a className="text-button" href={`/api/mail/messages/${message.id}/attachments/${attachment.id}`} download={attachment.fileName}><Download size={15} />{t("Baixar arquivo")}</a>{attachment.rentalId && <Link className="text-button" href={`/rentals/${attachment.rentalId}?tab=documents`}>{t("Ver locação")}</Link>}</div></td>
        </tr>)}</tbody></table></div>
        <p className="muted full-width">{selected.length} {t("anexos selecionados")} · {Math.ceil(selectedSize / 1024)} KiB. {t("PDFs de notas e boletos são anexados sem leitura automática. Confira os valores no documento.")}</p>
        {selected.length > 3 || selectedSize > rentalFileLimit ? <p className="form-error full-width">{t("Selecione até 3 anexos, com tamanho total de até 2 MiB.")}</p> : null}
        {hasAvailable && <div className="inline-actions full-width"><button type="button" className="secondary-button" onClick={readXml} disabled={draft.pending || !selected.some((attachment) => attachment.mediaType === "application/xml")}><FileUp size={17} />{t("Ler XML selecionado")}</button></div>}
        {preview && <div className="settlement-summary full-width"><strong>{t("Conferir dados encontrados")}</strong><div className="form-grid">{preview.fields.documentKind && <div className="form-field"><span>{t("Tipo de documento")}</span><strong>{t(rentalDocumentKinds[preview.fields.documentKind])}</strong></div>}{preview.fields.documentNumber && <div className="form-field"><span>{t("Número do documento")}</span><strong>{preview.fields.documentNumber}</strong></div>}{preview.fields.issuedAt && <div className="form-field"><span>{t("Data de emissão")}</span><strong>{formatDate(preview.fields.issuedAt)}</strong></div>}{preview.fields.amount && <div className="form-field"><span>{t("Valor a pagar")}</span><strong>{formatMoney(preview.fields.amount)}</strong></div>}</div>{preview.warnings.map((warning) => <p className="muted" key={warning}>{mailWarning(warning, t)}</p>)}{Object.keys(preview.fields).length > 0 && <div><button type="button" className="secondary-button" disabled={draft.pending} onClick={applyPreview}>{t("Aplicar dados do XML")}</button></div>}</div>}
        {notice && <p className="form-success full-width" role="status">{notice}</p>}
        {!hasAvailable && <p className="muted full-width">{t("Todos os anexos disponíveis já foram vinculados a cobranças.")}</p>}
      </FormSection>
      {hasAvailable && <>
        <FormSection title={t("Locação e obra")} description={t("A locadora e a obra serão obtidas da locação selecionada.")}>
          {suggestedRental && suggestedRental.id !== draft.values.rentalId && <div className="settlement-summary full-width"><strong>{t("Referência de locação encontrada")}</strong><p>{suggestedRental.number} · {suggestedRental.equipmentName} · {suggestedRental.project.name} · {suggestedRental.supplier.name}</p><p className="muted">{t("O texto da mensagem cita esta referência. Confira a obra e a locadora antes de aplicar.")}</p><div><button type="button" className="secondary-button" disabled={draft.pending} onClick={() => draft.setValues((values) => ({ ...values, rentalId: suggestedRental.id, reviewed: false }))}>{t("Aplicar vínculo sugerido")}</button></div></div>}
          <label className="form-field full-width">{t("Locação vinculada")}<select required value={draft.values.rentalId} disabled={draft.pending} onChange={(event) => draft.setValues((values) => ({ ...values, rentalId: event.target.value, reviewed: false }))}><option value="">{t("Selecione uma locação")}</option>{rentals.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.equipmentName} · {item.project.name} · {item.supplier.name}</option>)}</select></label>
          {!rentals.length && <p className="muted full-width">{t("Cadastre uma locação para vincular esta cobrança. O rascunho será mantido ao alternar de aba.")}</p>}
          {rental && <><div className="form-field"><span>{t("Obra")}</span><strong>{rental.project.name}</strong></div><div className="form-field"><span>{t("Locadora")}</span><strong>{rental.supplier.name}</strong></div></>}
          <div className="inline-actions full-width"><Link className="text-button" href="/rentals/new">{t("Cadastrar nova locação")}</Link>{rental && <Link className="text-button" href={`/rentals/${rental.id}`}>{t("Ver locação")}</Link>}</div>
        </FormSection>
        <FormSection title={t("Conferência da cobrança")} description={t("Revise número, emissão, vencimento e valor antes de gerar a conta a pagar.")}>
          <label className="form-field">{t("Tipo de documento")}<select value={draft.values.documentKind} disabled={draft.pending} onChange={(event) => draft.setValues((values) => ({ ...values, documentKind: event.target.value as RentalDocumentKind, reviewed: false }))}>{Object.entries(rentalDocumentKinds).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
          <label className="form-field">{t("Número do documento")}<input required maxLength={80} value={draft.values.documentNumber} disabled={draft.pending} onChange={(event) => draft.setValues((values) => ({ ...values, documentNumber: event.target.value, reviewed: false }))} /></label>
          <label className="form-field">{t("Data de emissão")}<input required type="date" value={draft.values.issuedAt} disabled={draft.pending} onChange={(event) => draft.setValues((values) => ({ ...values, issuedAt: event.target.value, reviewed: false }))} /></label>
          <label className="form-field">{t("Vencimento")}<input required type="date" min={draft.values.issuedAt} value={draft.values.dueAt} disabled={draft.pending} onChange={(event) => draft.setValues((values) => ({ ...values, dueAt: event.target.value, reviewed: false }))} /></label>
          <label className="form-field">{t("Valor a pagar (R$)")}<input type="number" required min="0.01" step="0.01" max="99999999999999.99" value={draft.values.amount} disabled={draft.pending} onChange={(event) => draft.setValues((values) => ({ ...values, amount: event.target.value, reviewed: false }))} /></label>
          <label className="form-field">{t("Link externo do documento")}<input type="url" maxLength={2000} placeholder="https://" value={draft.values.documentUrl} disabled={draft.pending} onChange={(event) => draft.setValues((values) => ({ ...values, documentUrl: event.target.value, reviewed: false }))} /></label>
          <label className="form-field full-width">{t("Observações da cobrança")}<textarea rows={3} maxLength={2000} value={draft.values.notes} disabled={draft.pending} onChange={(event) => draft.setValues((values) => ({ ...values, notes: event.target.value, reviewed: false }))} /></label>
          <label className="checkbox-field full-width"><input type="checkbox" required checked={draft.values.reviewed} disabled={draft.pending} onChange={(event) => draft.setField("reviewed", event.target.checked)} />{t("Conferi os anexos, a locadora, a obra e os valores desta cobrança.")}</label>
        </FormSection>
      </>}
      {draft.error && <p className="form-error" role="alert">{t(draft.error)}</p>}
      <div className="form-actions"><Link href="/mail" className="secondary-button">{t("Voltar à caixa de revisão")}</Link>{hasAvailable && <button type="submit" className="primary-button" disabled={draft.pending || !rentals.length}>{t(draft.pending ? "Processando…" : "Importar cobrança e gerar conta")}</button>}</div>
    </form>
  </FormPage>;
}
