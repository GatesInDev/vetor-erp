"use client";

import { useRef, useState, type FormEvent } from "react";
import { FormDialog } from "@/components/ui/form-dialog";
import { apiRequest } from "@/lib/client-api";
import { formatDate, formatMoney, type BankTransactionRow, type PayableRow, type ReceivableRow } from "./types";

export type Settlement = { type: "payment"; payable: PayableRow } | { type: "receipt"; receivable: ReceivableRow };

export function SettlementDialog({ settlement, transactions, onClose, onSuccess }: {
  settlement: Settlement;
  transactions: BankTransactionRow[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const mutationKey = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const availableTransactions = settlement.type === "receipt"
    ? transactions.filter((transaction) => !transaction.reconciled && Number(transaction.amount) > 0 && Number(transaction.amount) <= Number(settlement.receivable.remaining))
    : [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const bankTransactionId = String(form.get("bankTransactionId") ?? "");
    if (settlement.type === "receipt" && !availableTransactions.some((transaction) => transaction.id === bankTransactionId)) {
      setError("Selecione um crédito disponível para esta conta.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (settlement.type === "payment") {
        await apiRequest(`/api/payables/${settlement.payable.id}/pay`, { method: "POST", idempotencyKey: mutationKey.current });
        onSuccess("Pagamento registrado e conta baixada com sucesso.");
      } else {
        await apiRequest(`/api/receivables/${settlement.receivable.id}/reconcile`, {
          method: "POST", body: { bankTransactionId }, idempotencyKey: mutationKey.current,
        });
        onSuccess("Recebimento conciliado. O saldo da conta foi atualizado.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível registrar a operação.");
    } finally {
      setBusy(false);
    }
  }

  return <FormDialog open title={settlement.type === "payment" ? "Registrar pagamento" : "Conciliar recebimento"} description={settlement.type === "payment" ? "Confirme o pagamento já realizado para registrar a baixa e o lançamento contábil." : "Vincule um crédito do extrato bancário à conta a receber."} onClose={() => { if (!busy) onClose(); }}>
    <form className="form-grid" onSubmit={submit}>
      <div className="settlement-summary full-width">
        <span className="section-label">{settlement.type === "payment" ? settlement.payable.contractNumber : settlement.receivable.invoiceNumber}</span>
        <strong>{settlement.type === "payment" ? settlement.payable.contractor : settlement.receivable.customer}</strong>
        <span>{settlement.type === "payment" ? settlement.payable.project : settlement.receivable.project}</span>
        <b>{formatMoney(settlement.type === "payment" ? settlement.payable.amount : settlement.receivable.remaining)}</b>
      </div>
      {settlement.type === "payment" ? <p className="muted full-width">A baixa será registrada com a data de hoje. Esta ação registra o pagamento no ERP; a transferência deve ser feita no seu banco.</p> : <>
        <label className="form-field full-width">Crédito no extrato<select name="bankTransactionId" required disabled={busy || !availableTransactions.length} defaultValue=""><option value="">Selecione o recebimento</option>{availableTransactions.map((transaction) => <option key={transaction.id} value={transaction.id}>{formatDate(transaction.postedAt)} · {formatMoney(transaction.amount)} · {transaction.description}</option>)}</select><small>Créditos disponíveis com valor até o saldo em aberto. Valores menores geram uma baixa parcial.</small></label>
        {!availableTransactions.length && <p className="form-error full-width">Nenhum crédito disponível para esta conta. Importe o extrato OFX em Financeiro e confira os valores antes de conciliar.</p>}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || (settlement.type === "receipt" && !availableTransactions.length)}>{busy ? "Registrando…" : settlement.type === "payment" ? "Confirmar pagamento" : "Conciliar crédito"}</button></div>
    </form>
  </FormDialog>;
}
