import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";
import { accountingDefaults, trialBalanceFiltersSchema } from "@/modules/reports/accounting/schema";
import { AccountingReportWorkspace } from "@/modules/reports/accounting/components/accounting-report-workspace";

export default async function TrialBalancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actor } = await getWorkspaceContext();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "VIEWER"].includes(actor.role)) redirect("/reports");
  const query = await searchParams;
  const filters = trialBalanceFiltersSchema.safeParse({ from: query.from, to: query.to });
  return <WorkspaceScreen pathname="/reports/trial-balance" search={query}><AccountingReportWorkspace kind="trial-balance" defaults={{ ...accountingDefaults(), ...(filters.success ? filters.data : {}) }} /></WorkspaceScreen>;
}
