import { WorkspaceShell } from "@/modules/workspace/components/workspace-shell";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { WorkspaceTabsProvider } from "@/modules/workspace/components/workspace-tabs";
import { WorkspaceScreensProvider } from "@/modules/workspace/components/workspace-screen";
import { PreferencesProvider } from "@/modules/settings/components/preferences-provider";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { company, user, actor, preferences } = await getWorkspaceContext();
  return <PreferencesProvider key={`${actor.companyId}:${actor.userId}`} initial={preferences}><WorkspaceScreensProvider><WorkspaceTabsProvider><WorkspaceShell companyName={company.name} email={user.email} role={actor.role}>{children}</WorkspaceShell></WorkspaceTabsProvider></WorkspaceScreensProvider></PreferencesProvider>;
}
