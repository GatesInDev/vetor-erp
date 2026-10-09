import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { accountCodes } from "@/lib/account-catalog";
import { HttpError, type Actor } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { importMailCharge } from "./import-charge";
import { mailChargeImportSchema } from "./import-schema";

const actor: Actor = { companyId: "company-a", userId: "user-a", sessionId: "session-a", role: "FINANCE" };
const input = { rentalId: "rental-a", attachmentIds: ["attachment-a"], charge: { documentKind: "NFSE" as const, documentNumber: "000123", issuedAt: "2026-10-01", dueAt: "2026-10-10", amount: "90071992547409.01", documentUrl: "", notes: "" } };

function transactionFixture(imported = false, updatedCount = 1) {
  let chargeWrites = 0;
  let payableAmount = "";
  let linked: Prisma.MailAttachmentUpdateManyArgs | undefined;
  const charge = { ...input.charge, id: "charge-a", companyId: actor.companyId, rentalId: input.rentalId, amount: new Prisma.Decimal(input.charge.amount), issuedAt: new Date("2026-10-01T00:00:00Z"), dueAt: new Date("2026-10-10T00:00:00Z"), files: [], payable: { id: "payable-a", status: "OPEN", paidAt: null, financialTitle: null } };
  const content = Buffer.from("<InfNfse><Numero>000123</Numero></InfNfse>").toString("base64");
  const transaction = {
    mailMessage: { findFirst: async (args: Prisma.MailMessageFindFirstArgs) => { assert.deepEqual(args.where, { companyId: actor.companyId, id: "message-a" }); return { id: "message-a" }; } },
    mailAttachment: {
      findMany: async (args: Prisma.MailAttachmentFindManyArgs) => { assert.equal(args.where?.companyId, actor.companyId); return [{ id: "attachment-a", rentalChargeId: imported ? "prior-charge" : null, fileName: "invoice.xml", mediaType: "application/xml", sizeBytes: 60, contentEncrypted: encrypt(content) }]; },
      updateMany: async (args: Prisma.MailAttachmentUpdateManyArgs) => { linked = args; return { count: updatedCount }; },
    },
    equipmentRental: { findFirst: async () => ({ id: input.rentalId, projectId: "project-a", supplierId: "supplier-a", revision: 1, number: "LOC-1" }), updateMany: async () => ({ count: 1 }) },
    rentalCharge: { findFirst: async () => null, create: async (args: Prisma.RentalChargeCreateArgs) => {
      const files = args.data.files?.create as Prisma.RentalChargeFileUncheckedCreateWithoutRentalChargeInput[];
      assert.equal(args.data.companyId, actor.companyId);
      assert.equal(files.length, 1);
      assert.deepEqual(Object.keys(files[0]).sort(), ["contentEncrypted", "fileName", "mediaType", "sizeBytes"]);
      chargeWrites += 1;
      return charge;
    }, findFirstOrThrow: async () => charge },
    account: { findMany: async () => [{ id: "cost", code: accountCodes.equipmentRentalCost }, { id: "liability", code: accountCodes.supplierPayable }] },
    payable: { create: async (args: Prisma.PayableCreateArgs) => { payableAmount = String(args.data.amount); return charge.payable; } },
    journalEntry: { create: async () => ({ id: "entry-a" }) },
  } as unknown as Prisma.TransactionClient;
  return { transaction, writes: () => chargeWrites, link: () => linked, amount: () => payableAmount };
}

test("reviewed email attachments link to the generated rental charge without rounding money", async () => {
  const previous = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  try {
    const fixture = transactionFixture();
    const result = await importMailCharge(fixture.transaction, actor, "message-a", input);
    assert.deepEqual(result, { rentalId: input.rentalId, chargeId: "charge-a", payableId: "payable-a" });
    assert.equal(fixture.writes(), 1);
    assert.equal(fixture.amount(), input.charge.amount);
    assert.deepEqual(fixture.link()?.where, { companyId: actor.companyId, messageId: "message-a", id: { in: input.attachmentIds }, rentalChargeId: null });
    assert.equal(fixture.link()?.data.rentalChargeId, "charge-a");
    const repeated = transactionFixture(true);
    await assert.rejects(importMailCharge(repeated.transaction, actor, "message-a", input), (error: unknown) => error instanceof HttpError && error.status === 409);
    assert.equal(repeated.writes(), 0);
    const concurrent = transactionFixture(false, 0);
    await assert.rejects(importMailCharge(concurrent.transaction, actor, "message-a", input), (error: unknown) => error instanceof HttpError && error.status === 409);
  } finally {
    if (previous === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = previous;
  }
});

test("email import accepts only distinct stored attachment references and refuses owner overrides", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const valid = { ...input, rentalId: id, attachmentIds: [id] };
  assert.equal(mailChargeImportSchema.safeParse(valid).success, true);
  assert.equal(mailChargeImportSchema.safeParse({ ...valid, attachmentIds: [id, id] }).success, false);
  assert.equal(mailChargeImportSchema.safeParse({ ...valid, companyId: id }).success, false);
  assert.equal(mailChargeImportSchema.safeParse({ ...valid, charge: { ...valid.charge, files: [] } }).success, false);
  assert.equal(mailChargeImportSchema.safeParse({ ...valid, charge: { ...valid.charge, dueAt: "2026-09-01" } }).success, false);
});
