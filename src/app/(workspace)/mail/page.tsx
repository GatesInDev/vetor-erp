import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { MailWorkspace } from "@/modules/mail/components/mail-workspace";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function MailPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "FINANCE"].includes(actor.role)) redirect("/");
  return <WorkspaceScreen pathname="/mail"><MailWorkspace role={actor.role} /></WorkspaceScreen>;
}
