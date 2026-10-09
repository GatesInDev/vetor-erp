import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentActor } from "@/lib/auth";
import { MailReview } from "@/modules/mail/components/mail-review";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function MailMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "FINANCE"].includes(actor.role)) redirect("/");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <WorkspaceScreen pathname={`/mail/${id}`}><MailReview messageId={id} /></WorkspaceScreen>;
}
