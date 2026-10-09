"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { PageHeader } from "@/components/ui/page-header";
import { apiRequest } from "@/lib/client-api";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import type { FinancialTitleRow, TitleLinkOption } from "../types";
import { TitleAccountDetails } from "./title-account-details";
import { titleKinds } from "./title-status";
import { financialOriginReference } from "../../origin";
import { RecordTabs } from "@/modules/finance/components/record-tabs";

type TitleValues = Pick<FinancialTitleRow, "accountType" | "accountId" | "kind" | "number" | "bankName" | "digitLine" | "barcode" | "notes" | "revision">;

export function TitleForm({ record, options, canWrite, initialAccountType = "PAYABLE", initialAccountId = "" }: {
  record: FinancialTitleRow | null;
  options: TitleLinkOption[];
  canWrite: boolean;
  initialAccountType?: TitleValues["accountType"];
  initialAccountId?: string;
}) {
  const { t, formatDate, formatMoney } = useLocale();
  const [tab, setTab] = useState<"details" | "links">("details");
  const pageTitle = record ? `${t(canWrite ? "Editar título" : "Título")}: ${record.number}` : t("Novo título");
  const backHref = "/finance?tab=titles";
  const { values, setField, setValues, error, setError, pending, setPending, mutationKey, complete } = useFormDraft<TitleValues>({
    accountType: record?.accountType ?? initialAccountType,
    accountId: record?.accountId ?? initialAccountId,
    kind: record?.kind ?? "BOLETO",
    number: record?.number ?? "",
    bankName: record?.bankName ?? "",
    digitLine: record?.digitLine ?? "",
    barcode: record?.barcode ?? "",
    notes: record?.notes ?? "",
    revision: record?.revision ?? 0,
  }, { title: pageTitle });
  const disabled = pending || !canWrite;
  const available = options.filter((option) => option.accountType === values.accountType);
  const account = options.find((option) => option.accountType === values.accountType && option.accountId === values.accountId)
    ?? (record?.accountType === values.accountType && record.accountId === values.accountId ? record : null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canWrite) return;
    if (!account || !values.number.trim()) { setTab("details"); setError(t("Informe a referência do título e selecione uma conta vinculada.")); return; }
    const digitLine = values.digitLine.replace(/[\s.\-]/g, "");
    const barcode = values.barcode.replace(/[\s.\-]/g, "");
    if (digitLine && !/^\d{47,48}$/.test(digitLine)) { setTab("details"); setError(t("A linha digitável deve conter 47 ou 48 dígitos.")); return; }
    if (barcode && !/^\d{44}$/.test(barcode)) { setTab("details"); setError(t("O código de barras deve conter 44 dígitos.")); return; }
    setPending(true);
    setError("");
    try {
      await apiRequest(`/api/financial-titles${record ? `/${record.id}` : ""}`, {
        method: record ? "PATCH" : "POST",
        idempotencyKey: mutationKey,
        body: {
          accountType: values.accountType,
          accountId: values.accountId,
          kind: values.kind,
          number: values.number.trim(),
          bankName: values.bankName.trim(),
          digitLine,
          barcode,
          notes: values.notes.trim(),
          ...(record ? { revision: values.revision } : {}),
        },
      });
      complete(backHref, t(record ? "Título atualizado com sucesso." : "Título cadastrado com sucesso."));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Não foi possível salvar o título."));
    } finally { setPending(false); }
  }

  const details = <div className="page-stack">
    <FormSection title={t("Conta vinculada")} description={t("Valor, vencimento e situação são acompanhados pela conta de origem.")}>
      <label className="form-field">{t("Direção do título")}<select value={values.accountType} onChange={(event) => setValues((previous) => ({ ...previous, accountType: event.target.value as TitleValues["accountType"], accountId: "" }))} disabled={disabled}><option value="PAYABLE">{t("A pagar")}</option><option value="RECEIVABLE">{t("A receber")}</option></select></label>
      <label className="form-field">{t("Conta de origem")}<select required value={values.accountId} onChange={(event) => setField("accountId", event.target.value)} disabled={disabled || !available.length}><option value="">{t("Selecione uma conta")}</option>{available.map((option) => <option key={option.accountId} value={option.accountId}>{financialOriginReference(option.origin)} · {option.partner.name} · {option.project.name} · {formatMoney(option.amount)} · {formatDate(option.dueAt)}</option>)}</select></label>
      {!available.length && canWrite && <p className="form-error full-width">{t("Nenhuma conta disponível nesta direção. Cada conta aceita um título.")}{" "}<Link className="text-button" href={`/finance?tab=${values.accountType === "PAYABLE" ? "payables" : "receivables"}`}>{t("Ver contas")}</Link></p>}
      {account && <p className="muted full-width">{t("Consulte os valores, a situação e os registros relacionados na aba Vínculos.")}</p>}
    </FormSection>
    <FormSection title={t("Identificação do título")} description={t("Informe o tipo e a referência do documento para localizar o título.")}>
      <label className="form-field">{t("Tipo de título")}<select value={values.kind} onChange={(event) => setField("kind", event.target.value as TitleValues["kind"])} disabled={disabled}>{Object.entries(titleKinds).map(([kind, label]) => <option value={kind} key={kind}>{t(label)}</option>)}</select></label>
      <label className="form-field">{t("Número / referência")}<input name="number" required maxLength={80} value={values.number} onChange={(event) => setField("number", event.target.value)} disabled={disabled} /></label>
    </FormSection>
    <FormSection title={t("Dados bancários do título")} description={t("Registre os dados de um documento já existente. Os campos são opcionais.")}>
      <label className="form-field full-width">{t("Banco / instituição")}<input name="bankName" maxLength={120} value={values.bankName} onChange={(event) => setField("bankName", event.target.value)} disabled={disabled} /></label>
      <label className="form-field full-width">{t("Linha digitável")}<input name="digitLine" inputMode="numeric" maxLength={80} value={values.digitLine} onChange={(event) => setField("digitLine", event.target.value)} disabled={disabled} /><small>{t("47 ou 48 dígitos; espaços, pontos e traços são aceitos.")}</small></label>
      <label className="form-field full-width">{t("Código de barras")}<input name="barcode" inputMode="numeric" maxLength={80} value={values.barcode} onChange={(event) => setField("barcode", event.target.value)} disabled={disabled} /><small>{t("44 dígitos, quando disponível.")}</small></label>
    </FormSection>
    <FormSection title={t("Observações")} description={t("Informações complementares para acompanhar este título.")} defaultOpen={Boolean(values.notes)}>
      <label className="form-field full-width">{t("Observações do título")}<textarea name="notes" rows={4} maxLength={2000} value={values.notes} onChange={(event) => setField("notes", event.target.value)} disabled={disabled} /></label>
    </FormSection>
  </div>;

  const links = <FormSection title={t("Vínculos do título")} description={t("Acesse a conta e os registros relacionados a este documento.")}>
    {account ? <TitleAccountDetails account={account} canWrite={canWrite} /> : <div className="full-width page-stack"><p className="muted">{t("Selecione uma conta nos dados do título para consultar os vínculos.")}</p><div><button className="secondary-button" type="button" onClick={() => setTab("details")}>{t("Abrir dados do título")}</button></div></div>}
  </FormSection>;

  const content = <form className="page-stack" onSubmit={submit}>
    <RecordTabs label={t("Seções do título")} value={tab} onChange={setTab} tabs={[{ value: "details", label: t("Dados do título"), content: details }, { value: "links", label: t("Vínculos"), content: links }]} />
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    <div className="form-actions"><Link className="secondary-button" href={backHref}>{t("Voltar à lista")}</Link>{canWrite && <button className="primary-button" type="submit" disabled={pending || !account}>{t(pending ? "Salvando…" : record ? "Salvar alterações" : "Cadastrar título")}</button>}</div>
  </form>;

  return canWrite ? <FormPage title={pageTitle} description={t("Cadastre e acompanhe boletos e outros documentos financeiros com seus vínculos.")} backHref={backHref}>{content}</FormPage> : <div className="page-stack form-page"><PageHeader eyebrow={t("Financeiro")} title={pageTitle} description={t("Consulte os dados do título e acompanhe a conta vinculada.")} />{content}</div>;
}
