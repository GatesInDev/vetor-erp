import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/modules/workspace/server/context";
import { RegistrationForm } from "@/modules/registrations/components/registration-form";
import { WorkspaceScreen } from "@/modules/workspace/components/workspace-screen";
import { getEquipmentRentals } from "@/modules/rentals/server";

export const dynamic = "force-dynamic";

export default async function PartnerFormPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { actor } = await getWorkspaceContext();
  if (!["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"].includes(actor.role)) redirect("/registrations?tab=partners");
  const { recordId } = await params;
  if (recordId === "new") {
    return (
      <WorkspaceScreen pathname={`/registrations/partners/${recordId}`}>
        <RegistrationForm key="new-partner" type="partners" record={null} />
      </WorkspaceScreen>
    );
  }
  if (!z.uuid().safeParse(recordId).success) notFound();
  const partner = await db.partner.findFirst({
    where: { id: recordId, companyId: actor.companyId },
    select: { id: true, name: true, customer: true, supplier: true, taxIdEncrypted: true },
  });
  if (!partner) notFound();
  const { taxIdEncrypted, ...record } = partner;
  const rentals = record.supplier ? await getEquipmentRentals(actor.companyId, { supplierId: record.id }) : undefined;
  return (
    <WorkspaceScreen pathname={`/registrations/partners/${recordId}`}>
      <RegistrationForm key={record.id} type="partners" record={{ ...record, hasTaxId: Boolean(taxIdEncrypted) }} rentals={rentals} />
    </WorkspaceScreen>
  );
}
