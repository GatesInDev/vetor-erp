import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentActor } from "@/lib/auth";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";
import { getFinancialAccount } from "../data";
import { getFinancialTitles } from "../titles/server";
import type { TitleAccountType } from "../titles/types";
import { AccountRecord } from "./account-record";

export async function AccountRecordPage({ params, accountType }: { params: Promise<{ id: string }>; accountType: TitleAccountType }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [account, titles] = await Promise.all([getFinancialAccount(actor.companyId, accountType, id), getFinancialTitles(actor.companyId, { accountType })]);
  if (!account) notFound();
  return <WorkspaceScreen pathname={`/finance/${accountType === "PAYABLE" ? "payables" : "receivables"}/${id}`}><AccountRecord account={account} titles={titles.filter((title) => title.accountId === id)} role={actor.role} /></WorkspaceScreen>;
}
