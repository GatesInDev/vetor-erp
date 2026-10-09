import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { getTitleLinkOptions } from "@/modules/finance/titles/server";
import { TitleForm } from "@/modules/finance/titles/components/title-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function NewTitlePage({ searchParams }: { searchParams: Promise<{ accountType?: string; accountId?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "FINANCE"].includes(actor.role)) redirect("/finance?tab=titles");
  const query = await searchParams;
  const options = await getTitleLinkOptions(actor.companyId);
  const initialAccountType = query.accountType === "RECEIVABLE" ? "RECEIVABLE" : "PAYABLE";
  const initialAccountId = options.find((option) => option.accountType === initialAccountType && option.accountId === query.accountId)?.accountId ?? "";
  return <WorkspaceScreen pathname="/finance/titles/new" search={query}><TitleForm record={null} options={options} canWrite initialAccountType={initialAccountType} initialAccountId={initialAccountId} /></WorkspaceScreen>;
}
