"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { FormDialog } from "@/components/ui/form-dialog";
import { apiRequest } from "@/lib/client-api";
import { dateInputToIso, today, type SelectOption } from "./types";

type Props = {
  kind: "invoice" | "contract";
  partners: SelectOption[];
  projects: SelectOption[];
  onClose: () => void;
  onSuccess: (message: string) => void;
};

export function DocumentDialog({ kind, partners, projects, onClose, onSuccess }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());
  const isInvoice = kind === "invoice";
  const canSubmit = partners.length > 0 && projects.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const number = String(form.get("number")).trim();
    const description = String(form.get("description") ?? "").trim();
    if (!number || (!isInvoice && !description)) {
      setError(isInvoice ? "Informe o número ou a referência do serviço." : "Informe o número e a descrição do contrato.");
      return;
    }
    const amount = String(form.get("amount"));
    const issAmount = String(form.get("issAmount") || "0");
    const inssAmount = String(form.get("inssAmount") || "0");
    if (Number(issAmount) + Number(inssAmount) >= Number(amount)) {
      setError("As retenções devem ser menores que o valor bruto.");
      return;
    }
    const common = { number, projectId: String(form.get("projectId")), amount, issAmount, inssAmount };
    const body = isInvoice
      ? { ...common, customerId: String(form.get("partnerId")), serviceDate: dateInputToIso(String(form.get("serviceDate"))), dueAt: dateInputToIso(String(form.get("dueAt"))), taxAnnex: String(form.get("taxAnnex")) }
      : { ...common, contractorId: String(form.get("partnerId")), description };
    setPending(true);
    setError("");
    try {
      await apiRequest(isInvoice ? "/api/invoices" : "/api/contracts", { method: "POST", body, idempotencyKey: idempotencyKey.current });
      onSuccess(isInvoice ? "Serviço registrado. O título a receber já está no Financeiro." : "Contrato cadastrado. Registre uma medição para acompanhar a execução.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar. Tente novamente.");
      setPending(false);
    }
  }

  return <FormDialog open onClose={() => { if (!pending) onClose(); }} title={isInvoice ? "Registrar serviço" : "Novo contrato"} description={isInvoice ? "Registre a receita e gere o título a receber. A emissão fiscal da NFS-e é feita fora deste cadastro." : "Vincule um prestador à obra. O valor a pagar será gerado ao aprovar uma medição."}>
    {!canSubmit && <p className="form-error">Cadastre {partners.length === 0 ? (isInvoice ? "um cliente" : "um fornecedor") : "uma obra ativa"} antes de continuar. <Link href="/registrations">Abrir cadastros</Link></p>}
    <form onSubmit={submit} className="form-grid">
      <label className="form-field"><span>{isInvoice ? "Número / referência" : "Número do contrato"}</span><input name="number" required maxLength={60} placeholder={isInvoice ? "Ex.: SERV-2026-001" : "Ex.: CT-2026-001"} /></label>
      <label className="form-field"><span>Valor bruto (R$)</span><input name="amount" type="number" required min="0.01" step="0.01" placeholder="0,00" /></label>
      <label className="form-field"><span>{isInvoice ? "Cliente" : "Fornecedor / prestador"}</span><select name="partnerId" required defaultValue=""><option value="" disabled>Selecione</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label>
      <label className="form-field"><span>Obra / centro de custo</span><select name="projectId" required defaultValue=""><option value="" disabled>Selecione</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      {isInvoice ? <>
        <label className="form-field"><span>Data do serviço</span><input name="serviceDate" type="date" defaultValue={today()} required /></label>
        <label className="form-field"><span>Vencimento</span><input name="dueAt" type="date" defaultValue={today()} required /></label>
        <label className="form-field full-width"><span>Anexo tributário</span><select name="taxAnnex" defaultValue="III"><option value="III">Anexo III</option><option value="IV">Anexo IV</option></select></label>
      </> : <label className="form-field full-width"><span>Descrição do serviço contratado</span><textarea name="description" required maxLength={500} rows={3} placeholder="Descreva o escopo do contrato" /></label>}
      <details className="retention-fields full-width"><summary>Retenções opcionais de ISS e INSS</summary><div className="form-grid">
        <label className="form-field"><span>ISS retido (R$)</span><input name="issAmount" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="form-field"><span>INSS retido (R$)</span><input name="inssAmount" type="number" min="0" step="0.01" defaultValue="0" /></label>
      </div></details>
      {error && <p className="form-error full-width" role="alert">{error}</p>}
      <div className="form-actions full-width"><button type="button" className="secondary-button" disabled={pending} onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={pending || !canSubmit}>{pending ? "Salvando…" : isInvoice ? "Registrar serviço" : "Cadastrar contrato"}</button></div>
    </form>
  </FormDialog>;
}
