import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { RegistrationsWorkspace } from "@/modules/registrations/components/registrations-workspace";

export const dynamic = "force-dynamic";

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<{ tab?: string; new?: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const query = await searchParams;
  const initialTab = query.tab === "partners" ? "partners" : "projects";
  const canWrite = ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role);
  const [projects, partners] = await Promise.all([
    db.project.findMany({
      where: { companyId: actor.companyId },
      select: { id: true, code: true, name: true, active: true },
      orderBy: { code: "asc" },
    }),
    db.partner.findMany({
      where: { companyId: actor.companyId },
      select: { id: true, name: true, customer: true, supplier: true, taxIdEncrypted: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return <RegistrationsWorkspace
    projects={projects}
    partners={partners.map(({ taxIdEncrypted, ...partner }) => ({ ...partner, hasTaxId: Boolean(taxIdEncrypted) }))}
    canWrite={canWrite}
    initialTab={initialTab}
    initialEditor={canWrite && query.new === "true" ? initialTab : null}
  />;
}
