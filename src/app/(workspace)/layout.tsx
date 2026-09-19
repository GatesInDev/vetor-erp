import { WorkspaceShell } from "@/modules/workspace/components/workspace-shell";
import { getWorkspaceContext } from "@/modules/workspace/server/context";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { company, user, actor } = await getWorkspaceContext();
  return <WorkspaceShell companyName={company.name} email={user.email} role={actor.role}>{children}</WorkspaceShell>;
}
