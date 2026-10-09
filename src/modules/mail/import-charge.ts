import type { Prisma } from "@prisma/client";
import { HttpError, type Actor } from "@/lib/auth";
import { createRentalCharge } from "@/modules/rentals/operations";
import { readMailAttachmentFiles } from "./operations";
import type { MailChargeImportInput } from "./import-schema";

export async function importMailCharge(transaction: Prisma.TransactionClient, actor: Actor, messageId: string, input: MailChargeImportInput) {
  const files = await readMailAttachmentFiles(transaction, actor.companyId, messageId, input.attachmentIds);
  const charge = await createRentalCharge(transaction, actor, input.rentalId, { ...input.charge, files });
  const updated = await transaction.mailAttachment.updateMany({
    where: { companyId: actor.companyId, messageId, id: { in: input.attachmentIds }, rentalChargeId: null },
    data: { rentalChargeId: charge.id, importedAt: new Date() },
  });
  if (updated.count !== input.attachmentIds.length) throw new HttpError(409, "An attachment has already been imported");
  return { rentalId: input.rentalId, chargeId: charge.id, payableId: charge.payable?.id ?? null };
}
