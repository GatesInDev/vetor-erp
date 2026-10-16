import { redirect } from "next/navigation";
import { SpreadsheetWorkspace } from "@/modules/reports/spreadsheets/components/spreadsheet-workspace";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";
import { getWorkspaceContext } from "@/modules/workspace/server/context";

export default async function SpreadsheetReportsPage() {
  const { actor, company } = await getWorkspaceContext();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "VIEWER"].includes(actor.role)) redirect("/reports");
  return <WorkspaceScreen pathname="/reports/spreadsheets"><SpreadsheetWorkspace companyName={company.name} /></WorkspaceScreen>;
}
