"use client";

import type { BalanceSheetGroup, BalanceSheetReport } from "../types";
import { useAccountingFormat } from "./accounting-values";

function BalanceGroup({ title, group, showZero, report }: { title: string; group: BalanceSheetGroup; showZero: boolean; report?: BalanceSheetReport }) {
  const { money, t } = useAccountingFormat();
  const lines = group.lines.filter((line) => showZero || Number(line.balance) !== 0);
  return <section className="accounting-group" aria-label={t(title)}>
    <h2>{t(title)}</h2>
    <div className="table-scroll"><table className="accounting-table"><caption className="sr-only">{t(title)}</caption><thead><tr><th scope="col">{t("Código")}</th><th scope="col">{t("Conta contábil")}</th><th scope="col" className="accounting-amount">{t("Saldo")}</th></tr></thead><tbody>
      {lines.map((line) => <tr key={line.id}><td className="accounting-code">{line.code}</td><th scope="row">{line.name}{!line.active && <span className="accounting-secondary">{t("Conta inativa")}</span>}</th><td className="accounting-amount">{money(line.balance)}</td></tr>)}
      {!lines.length && <tr><td colSpan={3} className="accounting-empty">{t("Nenhum saldo nas contas exibidas.")}</td></tr>}
      {report && <><tr className="accounting-subtotal"><th scope="row" colSpan={2}>{t("Patrimônio líquido registrado")}</th><td className="accounting-amount">{money(group.total)}</td></tr><tr><th scope="row" colSpan={2}>{t("Resultado acumulado ainda não encerrado")}<span className="accounting-secondary">{t("Receitas menos custos e despesas acumulados até a data de referência.")}</span></th><td className="accounting-amount">{money(report.unclosedEarnings)}</td></tr></>}
      <tr className="accounting-total"><th scope="row" colSpan={2}>{t("Total")} · {t(title)}</th><td className="accounting-amount">{money(report ? report.equityIncludingEarnings : group.total)}</td></tr>
    </tbody></table></div>
  </section>;
}

export function BalanceSheet({ report, showZero }: { report: BalanceSheetReport; showZero: boolean }) {
  const { money, t } = useAccountingFormat();
  return <>
    <BalanceGroup title="Ativo" group={report.assets} showZero={showZero} />
    <BalanceGroup title="Passivo" group={report.liabilities} showZero={showZero} />
    <BalanceGroup title="Patrimônio líquido" group={report.equity} showZero={showZero} report={report} />
    <section className="accounting-comparison" aria-label={t("Conferência do balanço")}>
      <div><span>{t("Total do ativo")}</span><strong>{money(report.assets.total)}</strong></div>
      <div><span>{t("Passivo + patrimônio líquido")}</span><strong>{money(report.liabilitiesAndEquity)}</strong></div>
      <div data-balanced={report.balanced}><span>{t("Diferença")}</span><strong>{money(report.difference)}</strong></div>
    </section>
    <p className="accounting-note">{t("O resultado ainda não encerrado é apresentado separadamente para compor o patrimônio líquido, sem criar lançamentos de encerramento.")}</p>
  </>;
}
