"use client";

import Link from "next/link";
import { type FormEvent } from "react";
import { FormPage, FormSection } from "@/components/ui/form-page";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { apiRequest } from "@/lib/client-api";
import { useFormDraft } from "@/modules/workspace/components/workspace-tabs";
import { type BankTransactionRow, type PayableRow, type ReceivableRow } from "./types";
import { financialOriginHref, financialOriginLabel, financialOriginReference } from "./origin";

type Settlement = { type: "payment"; payable: PayableRow } | { type: "receipt"; receivable: ReceivableRow };

export function SettlementForm({ settlement, transactions }: { settlement: Settlement; transactions: BankTransactionRow[] }) {
  const { t, formatDate, formatMoney } = useLocale();
  const isPayment = settlement.type === "payment";
  const reference = settlement.type === "payment" ? financialOriginReference(settlement.payable.origin) : settlement.receivable.invoiceNumber;
  const title = `${isPayment ? t("Registrar pagamento") : t("Conciliar recebimento")}: ${reference}`;
  const backHref = `/finance?tab=${isPayment ? "payables" : "receivables"}`;
  const { values, setField, error, setError, pending, setPending, mutationKey, complete } = useFormDraft({ bankTransactionId: "", confirmed: false }, { title });
  const availableTransactions = settlement.type === "receipt"
    ? transactions.filter((transaction) => !transaction.reconciled && Number(transaction.amount) > 0 && Number(transaction.amount) <= Number(settlement.receivable.remaining))
    : [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (settlement.type === "receipt" && !availableTransactions.some((transaction) => transaction.id === values.bankTransactionId)) {
      setError(t("Selecione um crédito disponível para esta conta."));
      return;
    }
    if (isPayment && !values.confirmed) return;
    setPending(true);
    setError("");
    try {
      if (settlement.type === "payment") {
        await apiRequest(`/api/payables/${settlement.payable.id}/pay`, { method: "POST", idempotencyKey: mutationKey });
        complete(backHref, t("Pagamento registrado e conta baixada com sucesso."));
      } else {
        await apiRequest(`/api/receivables/${settlement.receivable.id}/reconcile`, { method: "POST", body: { bankTransactionId: values.bankTransactionId }, idempotencyKey: mutationKey });
        complete(backHref, t("Recebimento conciliado. O saldo da conta foi atualizado."));
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("Não foi possível registrar a operação.")); }
    finally { setPending(false); }
  }

  return <FormPage title={title} backHref={backHref} description={isPayment ? t("Confira o pagamento já realizado antes de registrar a baixa e o lançamento contábil.") : t("Vincule um crédito do extrato bancário à conta a receber.")}>
    <form onSubmit={submit}>
      <FormSection title={t("Dados da conta")} description={t("Parceiro, obra e saldo da operação.")}>
        <div className="settlement-summary full-width"><span className="section-label">{reference}</span><strong>{settlement.type === "payment" ? settlement.payable.contractor : settlement.receivable.customer}</strong><span>{settlement.type === "payment" ? settlement.payable.project : settlement.receivable.project}</span><b>{formatMoney(settlement.type === "payment" ? settlement.payable.amount : settlement.receivable.remaining)}</b></div>
        {settlement.type === "payment" && <div className="inline-actions full-width"><Link className="text-button" href={financialOriginHref(settlement.payable.origin)}>{t(financialOriginLabel(settlement.payable.origin))}: {settlement.payable.origin.number}</Link>{settlement.payable.origin.type === "RENTAL" && <Link className="text-button" href={`/rentals/${settlement.payable.origin.id}?tab=documents`}>{t("Documento recebido")}: {settlement.payable.origin.documentNumber}</Link>}</div>}
      </FormSection>
      <FormSection title={isPayment ? t("Confirmar pagamento") : t("Crédito bancário")} description={isPayment ? t("A baixa será registrada com a data de hoje.") : t("Selecione uma transação disponível para conciliar.")}>
        {isPayment ? <>
          <p className="muted full-width">{t("Esta ação registra o pagamento no ERP. A transferência deve ser realizada no seu banco.")}</p>
          <label className="checkbox-field full-width"><input name="confirmed" type="checkbox" required checked={values.confirmed} onChange={(event) => setField("confirmed", event.target.checked)} disabled={pending} />{t("Confirmo que o pagamento já foi realizado.")}</label>
        </> : <>
          <label className="form-field full-width">{t("Crédito no extrato")}<select name="bankTransactionId" required value={values.bankTransactionId} onChange={(event) => setField("bankTransactionId", event.target.value)} disabled={pending || !availableTransactions.length}><option value="">{t("Selecione o recebimento")}</option>{availableTransactions.map((transaction) => <option key={transaction.id} value={transaction.id}>{formatDate(transaction.postedAt)} · {formatMoney(transaction.amount)} · {transaction.description}</option>)}</select><small>{t("Créditos até o saldo em aberto. Valores menores geram uma baixa parcial.")}</small></label>
          {!availableTransactions.length && <p className="form-error full-width">{t("Nenhum crédito disponível para esta conta.")}{" "}<Link className="text-button" href="/finance?tab=reconciliation">{t("Abrir conciliação e importar OFX")}</Link></p>}
        </>}
      </FormSection>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="form-actions"><Link href={backHref} className="secondary-button">{t("Voltar à lista")}</Link><button className="primary-button" disabled={pending || (!isPayment && !availableTransactions.length)}>{pending ? t("Registrando…") : isPayment ? t("Confirmar pagamento") : t("Conciliar crédito")}</button></div>
    </form>
  </FormPage>;
}
