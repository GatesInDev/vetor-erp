import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentActor } from "@/lib/auth";
import { getMeasurement } from "@/modules/billing/data";
import { MeasurementForm } from "@/modules/billing/measurement-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";

export default async function ApproveMeasurementPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (!["ADMIN", "ACCOUNTANT", "FINANCE"].includes(actor.role)) redirect("/billing?tab=measurements");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const measurement = await getMeasurement(actor.companyId, id);
  if (!measurement) notFound();
  if (measurement.approved) redirect("/billing?tab=measurements");
  return (
    <WorkspaceScreen pathname={`/billing/measurements/${id}/approve`}>
      <MeasurementForm key={id} contracts={[]} measurement={measurement} />
    </WorkspaceScreen>
  );
}
