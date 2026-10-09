import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { RegistrationForm } from "@/modules/registrations/components/registration-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";
import { getEquipmentRentals } from "@/modules/rentals/server";

export const dynamic = "force-dynamic";

export default async function ProjectFormPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { actor } = await getWorkspaceContext();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)) redirect("/registrations");
  const { recordId } = await params;
  if (recordId === "new") {
    return (
      <WorkspaceScreen pathname={`/registrations/projects/${recordId}`}>
        <RegistrationForm key="new-project" type="projects" record={null} />
      </WorkspaceScreen>
    );
  }
  if (!z.uuid().safeParse(recordId).success) notFound();
  const project = await db.project.findFirst({
    where: { id: recordId, companyId: actor.companyId },
    select: { id: true, code: true, name: true, active: true },
  });
  if (!project) notFound();
  const rentals = await getEquipmentRentals(actor.companyId, { projectId: project.id });
  return (
    <WorkspaceScreen pathname={`/registrations/projects/${recordId}`}>
      <RegistrationForm key={project.id} type="projects" record={project} rentals={rentals} />
    </WorkspaceScreen>
  );
}
