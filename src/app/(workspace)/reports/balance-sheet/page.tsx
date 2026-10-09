import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";
import { accountingDefaults, balanceSheetFiltersSchema } from "@/modules/reports/accounting/schema";
import { AccountingReportWorkspace } from "@/modules/reports/accounting/components/accounting-report-workspace";

export default async function BalanceSheetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { actor } = await getWorkspaceContext();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "VIEWER"].includes(actor.role)) redirect("/reports");
  const query = await searchParams;
  const filters = balanceSheetFiltersSchema.safeParse({ asOf: query.asOf });
  return <WorkspaceScreen pathname="/reports/balance-sheet" search={query}><AccountingReportWorkspace kind="balance-sheet" defaults={{ ...accountingDefaults(), ...(filters.success ? filters.data : {}) }} /></WorkspaceScreen>;
}
