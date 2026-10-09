import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { MailConnectionSettings } from "@/modules/mail/components/mail-connection-settings";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function EmailSettingsPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") redirect("/settings");
  return <WorkspaceScreen pathname="/settings/email"><MailConnectionSettings /></WorkspaceScreen>;
}
