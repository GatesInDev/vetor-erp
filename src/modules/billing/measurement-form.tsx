"use client";

import Link from "next/link";
import { type FormEvent } from "react";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { apiRequest } from "@/lib/client-api";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import { dateInputToIso, today, type ContractRow, type MeasurementRow } from "./types";

export function MeasurementForm({ contracts, measurement, initialContractId }: { contracts: ContractRow[]; measurement?: MeasurementRow; initialContractId?: string }) {
  const { t, formatMoney } = useLocale();
  const title = measurement ? `${t("Aprovar medição")}: ${measurement.contractNumber}` : t("Nova medição");
  const backHref = "/billing?tab=measurements";
  const { values, setField, error, setError, pending, setPending, mutationKey, complete } = useFormDraft({ contractId: initialContractId ?? "", amount: "", measuredAt: today(), dueAt: today() }, { title });
  const available = contracts.filter((contract) => Number(contract.remaining) > 0);
  const selected = available.find((contract) => contract.id === values.contractId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!measurement && !selected) { setError(t("Selecione um contrato com saldo disponível.")); return; }
    setPending(true);
    setError("");
    try {
      await apiRequest(measurement ? `/api/measurements/${measurement.id}/approve` : `/api/contracts/${values.contractId}/measurements`, {
        method: "POST", idempotencyKey: mutationKey,
        body: measurement ? { dueAt: dateInputToIso(values.dueAt) } : { amount: values.amount, measuredAt: dateInputToIso(values.measuredAt) },
      });
      complete(backHref, measurement ? t("Medição aprovada. A conta a pagar foi gerada no Financeiro.") : t("Medição registrada e aguardando aprovação."));
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("Não foi possível salvar a medição.")); }
    finally { setPending(false); }
  }

  return <FormPage title={title} backHref={backHref} description={measurement ? t("Confira os dados para registrar o custo da obra e gerar a conta a pagar.") : t("Informe o valor executado do contrato. A medição fica pendente até ser aprovada.")}>
    {!measurement && !available.length && <p className="form-error">{t("Não há contratos com saldo disponível.")}{" "}<Link className="text-button" href="/billing?tab=contracts">{t("Ver contratos")}</Link></p>}
    <form onSubmit={submit}>
      <FormSection title={t("Contrato e execução")} description={t("Confira a obra, o prestador e o valor executado.")}>
        {measurement ? <div className="settlement-summary full-width"><span className="section-label">{measurement.contractNumber}</span><strong>{measurement.contractor}</strong><span>{measurement.project}</span><b>{formatMoney(measurement.amount)}</b></div> : <>
          <label className="form-field full-width">{t("Contrato")}<select name="contractId" required value={values.contractId} onChange={(event) => setField("contractId", event.target.value)} disabled={pending}><option value="">{t("Selecione um contrato")}</option>{available.map((contract) => <option key={contract.id} value={contract.id}>{contract.number} · {contract.contractor}</option>)}</select>{selected && <small>{t("Saldo a medir:")}{" "}{formatMoney(selected.remaining)} · {selected.project}</small>}</label>
          <label className="form-field">{t("Valor medido (R$)")}<input name="amount" type="number" required min="0.01" step="0.01" max={selected?.remaining} value={values.amount} onChange={(event) => setField("amount", event.target.value)} disabled={pending} /></label>
          <label className="form-field">{t("Data da medição")}<input name="measuredAt" type="date" required value={values.measuredAt} onChange={(event) => setField("measuredAt", event.target.value)} disabled={pending} /></label>
        </>}
      </FormSection>
      {measurement && <FormSection title={t("Pagamento")} description={t("Defina o vencimento da obrigação a ser gerada.")}><label className="form-field">{t("Vencimento do pagamento")}<input name="dueAt" type="date" required value={values.dueAt} onChange={(event) => setField("dueAt", event.target.value)} disabled={pending} /></label></FormSection>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="form-actions"><Link href={backHref} className="secondary-button">{t("Voltar à lista")}</Link><button className="primary-button" disabled={pending || (!measurement && !selected)}>{pending ? t("Salvando…") : measurement ? t("Aprovar e gerar conta") : t("Registrar medição")}</button></div>
    </form>
  </FormPage>;
}
