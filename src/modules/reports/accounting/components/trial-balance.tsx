"use client";

import type { TrialBalanceReport } from "../types";
import { AccountBalance, useAccountingFormat } from "./accounting-values";

const accountTypes: Record<string, string> = { ASSET: "Ativo", LIABILITY: "Passivo", EQUITY: "Patrimônio líquido", REVENUE: "Receita", COST: "Custo", EXPENSE: "Despesa" };

export function TrialBalance({ report, showZero }: { report: TrialBalanceReport; showZero: boolean }) {
  const { money, t } = useAccountingFormat();
  const lines = report.lines.filter((line) => showZero || [line.openingBalance, line.debits, line.credits, line.closingBalance].some((value) => Number(value) !== 0));
  return <>
    <p className="accounting-note">{t("D = devedor · C = credor. O saldo inicial considera os lançamentos anteriores ao período.")}</p>
    <div className="table-scroll"><table className="accounting-table accounting-trial-table"><caption className="sr-only">{t("Balancete de verificação")}</caption>
      <thead><tr><th scope="col">{t("Código")}</th><th scope="col">{t("Conta contábil")}</th><th scope="col" className="accounting-amount">{t("Saldo inicial")}</th><th scope="col" className="accounting-amount">{t("Débitos no período")}</th><th scope="col" className="accounting-amount">{t("Créditos no período")}</th><th scope="col" className="accounting-amount">{t("Saldo final")}</th></tr></thead>
      <tbody>{lines.map((line) => <tr key={line.id}><td className="accounting-code">{line.code}</td><th scope="row">{line.name}<span className="accounting-secondary">{t(accountTypes[line.type] ?? line.type)}{!line.active && ` · ${t("Conta inativa")}`}</span></th><td className="accounting-amount"><AccountBalance value={line.openingBalance} /></td><td className="accounting-amount">{money(line.debits)}</td><td className="accounting-amount">{money(line.credits)}</td><td className="accounting-amount"><AccountBalance value={line.closingBalance} /></td></tr>)}
        {!lines.length && <tr><td colSpan={6} className="accounting-empty">{t("Nenhum saldo ou movimento nas contas exibidas.")}</td></tr>}
        <tr className="accounting-total"><th scope="row" colSpan={2}>{t("Totais do balancete")}</th><td className="accounting-amount"><span className="accounting-total-pair">D {money(report.totals.openingDebit)}</span><span className="accounting-total-pair">C {money(report.totals.openingCredit)}</span></td><td className="accounting-amount">{money(report.totals.debits)}</td><td className="accounting-amount">{money(report.totals.credits)}</td><td className="accounting-amount"><span className="accounting-total-pair">D {money(report.totals.closingDebit)}</span><span className="accounting-total-pair">C {money(report.totals.closingCredit)}</span></td></tr>
      </tbody>
    </table></div>
  </>;
}
