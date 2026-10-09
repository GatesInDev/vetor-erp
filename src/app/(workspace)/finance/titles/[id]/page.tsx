import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentActor } from "@/lib/auth";
import { getFinancialTitle, getTitleLinkOptions } from "@/modules/finance/titles/server";
import { TitleForm } from "@/modules/finance/titles/components/title-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const record = await getFinancialTitle(actor.companyId, id);
  if (!record) notFound();
  const canWrite = ["ADMIN", "ACCOUNTANT", "FINANCE"].includes(actor.role);
  const options = canWrite ? await getTitleLinkOptions(actor.companyId, id) : [{ ...record, label: record.number }];
  return <WorkspaceScreen pathname={`/finance/titles/${id}`}><TitleForm key={id} record={record} options={options} canWrite={canWrite} /></WorkspaceScreen>;
}
