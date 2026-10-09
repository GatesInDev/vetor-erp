import { SettingsWorkspace } from "@/modules/settings/components/settings-workspace";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";
import { getWorkspaceContext } from "@/modules/workspace/server/context";

export default async function SettingsPage() {
  const context = await getWorkspaceContext();
  return <WorkspaceScreen pathname="/settings"><SettingsWorkspace canManageEmail={context.actor.role === "ADMIN"} /></WorkspaceScreen>;
}
