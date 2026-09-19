"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { FormDialog } from "@/components/ui/form-dialog";
import { apiRequest } from "@/lib/client-api";
import { dateInputToIso, formatMoney, today, type ContractRow, type MeasurementRow } from "./types";

type Props = {
  contracts: ContractRow[];
  measurement?: MeasurementRow;
  initialContractId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function MeasurementDialog({ contracts, measurement, initialContractId, onClose, onSuccess }: Props) {
  const [contractId, setContractId] = useState(initialContractId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());
  const available = contracts.filter((contract) => Number(contract.remaining) > 0);
  const selected = available.find((contract) => contract.id === contractId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await apiRequest(measurement ? `/api/measurements/${measurement.id}/approve` : `/api/contracts/${contractId}/measurements`, {
        method: "POST",
        body: measurement ? { dueAt: dateInputToIso(String(form.get("dueAt"))) } : { amount: String(form.get("amount")), measuredAt: dateInputToIso(String(form.get("measuredAt"))) },
        idempotencyKey: idempotencyKey.current,
      });
      onSuccess(measurement ? "Medição aprovada. A conta a pagar foi gerada no Financeiro." : "Medição registrada e aguardando aprovação.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar a medição.");
      setPending(false);
    }
  }

  return <FormDialog open onClose={() => { if (!pending) onClose(); }} title={measurement ? "Aprovar medição" : "Nova medição"} description={measurement ? "A aprovação registra o custo da obra e gera uma conta a pagar ao prestador." : "Informe o valor executado do contrato. A medição fica pendente até ser aprovada."}>
    {!measurement && available.length === 0 && <p className="form-error">Não há contratos com saldo disponível. Cadastre um contrato na aba Contratos. <Link href="/registrations">Ver cadastros</Link></p>}
    <form className="form-grid" onSubmit={submit}>
      {measurement ? <>
        <div className="full-width"><p className="table-primary">Contrato {measurement.contractNumber} · {measurement.contractor}</p><p>{measurement.project} · {formatMoney(measurement.amount)}</p></div>
        <label className="form-field full-width"><span>Vencimento do pagamento</span><input name="dueAt" required type="date" defaultValue={today()} /></label>
      </> : <>
        <label className="form-field full-width"><span>Contrato</span><select required value={contractId} onChange={(event) => setContractId(event.target.value)}><option value="" disabled>Selecione um contrato</option>{available.map((contract) => <option key={contract.id} value={contract.id}>{contract.number} · {contract.contractor}</option>)}</select>{selected && <small>Saldo a medir: {formatMoney(selected.remaining)} · {selected.project}</small>}</label>
        <label className="form-field"><span>Valor medido (R$)</span><input name="amount" required type="number" step="0.01" min="0.01" max={selected?.remaining} /></label>
        <label className="form-field"><span>Data da medição</span><input name="measuredAt" required type="date" defaultValue={today()} /></label>
      </>}
      {error && <p role="alert" className="form-error full-width">{error}</p>}
      <div className="form-actions full-width"><button type="button" className="secondary-button" onClick={onClose} disabled={pending}>Cancelar</button><button className="primary-button" type="submit" disabled={pending || (!measurement && !selected)}>{pending ? "Salvando…" : measurement ? "Aprovar e gerar conta" : "Registrar medição"}</button></div>
    </form>
  </FormDialog>;
}
