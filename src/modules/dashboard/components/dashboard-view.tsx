"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, Circle, HardHat, RefreshCw, ReceiptText, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useLocale } from "@/modules/settings/components/preferences-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/client-api";
import type { DashboardData } from "@/modules/dashboard/server/queries";

const taskLabels: Record<string, string> = {
  "Export bank statements and reconciliation": "Extratos e conciliação bancária",
  "Export service invoices and receipts": "Notas de serviço e comprovantes",
  "Send payroll and contractor documents to accountant": "Documentos de equipe e prestadores",
};
const sourceLabels: Record<string, string> = { INVOICE: "Serviço registrado", BANK_RECEIPT: "Recebimento conciliado", CONTRACT_PAYMENT: "Pagamento de prestador", MEASUREMENT: "Medição aprovada", MANUAL: "Lançamento contábil" };

export function DashboardView({ data, role }: { data: DashboardData; role: string }) {
  const { t, formatDate, formatMoney } = useLocale();
  const [period, setPeriod] = useState(12);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();
  const router = useRouter();
  const monthly = data.monthly.slice(-period);
  const total = monthly.reduce((sum, month) => sum + month.value, 0);
  const maximum = Math.max(...monthly.map((month) => month.value), 1);
  const selected = monthly.find((month) => month.date === selectedMonth);
  const completed = data.tasks.filter((task) => task.completed).length;
  const canManageTasks = ["ADMIN", "ACCOUNTANT", "FINANCE"].includes(role);

  async function toggleTask(id: string, complete: boolean) {
    setUpdatingTask(id);
    setError("");
    try {
      await apiRequest(`/api/monthly-tasks/${id}`, { method: "PATCH", body: { completed: complete } });
      startTransition(() => router.refresh());
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Não foi possível atualizar a tarefa.")); }
    finally { setUpdatingTask(null); }
  }

  return <div className="page-stack">
    <PageHeader eyebrow={t("VISÃO INTEGRADA")} title={t("Um olhar sobre o todo.")} description={t("Acompanhe os resultados e encontre o próximo passo da sua operação.")} actions={<button className="secondary-button" disabled={refreshing} onClick={() => startTransition(() => router.refresh())}><RefreshCw size={16} className={refreshing ? "spinning" : ""} />{refreshing ? t("Atualizando...") : t("Atualizar")}</button>} />
    <div className="dashboard-metrics">
      <Metric href="/billing" icon={<ReceiptText size={20} />} title={`${t("Serviços")} · ${period} ${t("meses")}`} value={formatMoney(total)} detail={t("Receita bruta registrada")} tone="lilac" />
      <Metric href="/finance?tab=receivables" icon={<ArrowDownLeft size={20} />} title={t("A receber")} value={formatMoney(data.openReceivables)} detail={t("Saldo dos títulos em aberto")} tone="sage" />
      <Metric href="/finance?tab=payables" icon={<WalletCards size={20} />} title={t("A pagar")} value={formatMoney(data.openPayables)} detail={t("Obrigações com prestadores")} tone="sand" />
      <Metric href="/registrations?tab=projects" icon={<HardHat size={20} />} title={t("Obras ativas")} value={String(data.projectCount).padStart(2, "0")} detail={t("Centros de custo da empresa")} tone="blue" />
    </div>
    <div className="dashboard-grid"><section className="island panel revenue-panel"><div className="panel-heading"><div><p className="section-label">{t("EVOLUÇÃO DA RECEITA")}</p><h2>{t("O resultado do seu trabalho.")}</h2></div><div className="period-control" aria-label={t("Período do gráfico")}>{[6, 12].map((months) => <button key={months} aria-pressed={period === months} onClick={() => { setPeriod(months); setSelectedMonth(null); }}>{months}{" "}{t("meses")}</button>)}</div></div><div className="revenue-summary"><strong>{formatMoney(selected?.value ?? total)}</strong><span>{selected ? `${t("Serviços de")} ${formatDate(selected.date, { month: "long", year: "numeric" })}` : `${t("Acumulado nos últimos")} ${period} ${t("meses")}`}</span></div><div className="revenue-chart">{monthly.map((month) => <button key={month.date} className={`chart-column ${selectedMonth === month.date ? "is-selected" : ""}`} aria-label={`${formatDate(month.date, { month: "short" })}: ${formatMoney(month.value)}`} aria-pressed={selectedMonth === month.date} onClick={() => setSelectedMonth(selectedMonth === month.date ? null : month.date)}><span className="chart-track"><span className="chart-bar" style={{ height: `${month.value > 0 ? Math.max(3, month.value / maximum * 100) : 0}%` }} /></span><span>{formatDate(month.date, { month: "short" })}</span></button>)}</div><p className="chart-hint">{total === 0 ? t("Ao registrar seus serviços, a evolução mensal aparecerá aqui.") : t("Selecione um mês para explorar o valor registrado.")}</p></section>
      <section className="island panel closing-panel"><div className="panel-heading"><div><p className="section-label">{t("FECHAMENTO DO MÊS")}</p><h2>{t("Um passo de cada vez.")}</h2></div><span className="closing-counter">{completed}<small>/{data.tasks.length}</small></span></div><p className="muted">{t("Organize os documentos que seguem para a contabilidade.")}</p><div className="closing-progress" role="progressbar" aria-label={t("Tarefas concluídas")} aria-valuemin={0} aria-valuemax={data.tasks.length || 1} aria-valuenow={completed}><span style={{ width: `${data.tasks.length ? completed / data.tasks.length * 100 : 0}%` }} /></div>{data.tasks.length ? <div className="closing-tasks">{data.tasks.map((task) => <button key={task.id} className={`closing-task ${task.completed ? "is-complete" : ""}`} disabled={!canManageTasks || Boolean(updatingTask) || refreshing} onClick={() => toggleTask(task.id, !task.completed)} aria-pressed={task.completed}><span className="task-check">{task.completed ? <Check size={14} /> : <Circle size={16} />}</span><span>{taskLabels[task.title] ? t(taskLabels[task.title]) : task.title}</span></button>)}</div> : <EmptyState title={t("Tudo em seu tempo")} description={t("Nenhuma tarefa cadastrada para este mês.")} />}{error && <p className="form-error" role="alert">{t(error)}</p>}<Link href="/finance" className="closing-link">{t("Abrir financeiro")}{" "}<ArrowUpRight size={17} /></Link></section></div>
    <section className="island panel"><div className="panel-heading"><div><p className="section-label">{t("A OPERAÇÃO EM MOVIMENTO")}</p><h2>{t("Últimos lançamentos")}</h2></div><Link href="/finance" className="text-button">{t("Ver financeiro")}{" "}<ArrowRightIcon /></Link></div>{data.entries.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>{t("Movimentação")}</th><th>{t("Obra")}</th><th>{t("Data")}</th><th className="amount-cell">{t("Valor")}</th></tr></thead><tbody>{data.entries.map((entry) => <tr key={entry.id}><td><span className="table-primary">{t(sourceLabels[entry.source] ?? entry.source)}</span><span className="table-secondary">{entry.description}</span></td><td>{entry.project}</td><td>{formatDate(entry.date)}</td><td className="amount-cell">{formatMoney(entry.amount)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("Seu próximo movimento começa aqui")} description={t("Registre um serviço ou aprove uma medição para acompanhar os lançamentos.")} action={<Link className="secondary-button" href="/billing">{t("Abrir faturamento")}{" "}<ChevronRight size={16} /></Link>} />}</section>
  </div>;
}

function ArrowRightIcon() { return <ChevronRight size={16} />; }

function Metric({ href, icon, title, value, detail, tone }: { href: string; icon: React.ReactNode; title: string; value: string; detail: string; tone: string }) {
  return <Link href={href} className="island dashboard-metric" data-tone={tone}><div><span className="module-icon">{icon}</span><ArrowUpRight size={17} /></div><span className="metric-title">{title}</span><strong>{value}</strong><small>{detail}</small></Link>;
}
