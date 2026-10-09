import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, type MailConnection } from "@prisma/client";
import { HttpError } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { acquireMailLease, persistMailBatch, synchronizeMailbox } from "./sync";
import type { ImapMessage, ImapSyncBatch } from "./types";

const connection: MailConnection = {
  id: "connection-a", companyId: "company-a", username: "test@example.com", passwordEncrypted: "", folder: "INBOX", enabled: true, autoSync: true,
  importSince: new Date("2026-10-01T00:00:00Z"), revision: 1, mailboxVersion: "mailbox-a", uidValidity: "100", cursorUid: BigInt(10),
  syncToken: "lease-a", syncUntil: new Date(Date.now() + 90000), lastSyncedAt: null, lastSyncAttemptAt: null, lastSyncError: null, createdAt: new Date(), updatedAt: new Date(),
};
const message: ImapMessage = { uid: 11, messageId: "<message@example.com>", subject: "Rental invoice", from: "supplier@example.com", receivedAt: new Date("2026-10-02T00:00:00Z"), bodyText: "Review the attached invoice.", warnings: [], attachments: [{ partId: "2", fileName: "invoice.xml", mediaType: "application/xml", content: Buffer.from("<InfNfse><Numero>00001</Numero></InfNfse>") }] };
const batch: ImapSyncBatch = { uidValidity: "100", cursorUid: 11, hasMore: false, messages: [message] };
const hasStatus = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;

async function withEncryptionKey(operation: () => Promise<void>) {
  const previous = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try { await operation(); } finally {
    if (previous === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = previous;
  }
}

function persistenceFixture(existing = false, fenced = true) {
  const updates: Prisma.MailConnectionUpdateManyArgs[] = [];
  const creates: Prisma.MailMessageCreateArgs[] = [];
  const transaction = {
    mailConnection: { updateMany: async (args: Prisma.MailConnectionUpdateManyArgs) => { updates.push(args); return { count: fenced ? 1 : 0 }; } },
    mailMessage: {
      findUnique: async (args: Prisma.MailMessageFindUniqueArgs) => {
        assert.deepEqual(args.where.companyId_mailboxVersion_uidValidity_uid, { companyId: connection.companyId, mailboxVersion: connection.mailboxVersion, uidValidity: "100", uid: BigInt(11) });
        return existing ? { id: "existing-message" } : null;
      },
      create: async (args: Prisma.MailMessageCreateArgs) => { creates.push(args); return { id: "message-a" }; },
    },
  } as unknown as Prisma.TransactionClient;
  return { transaction, updates, creates };
}

test("mail leases are tenant scoped and prevent concurrent or disabled synchronization", async () => {
  const now = new Date("2026-10-03T00:00:00Z");
  let request: Prisma.MailConnectionUpdateManyArgs | undefined;
  const client = { mailConnection: {
    updateMany: async (args: Prisma.MailConnectionUpdateManyArgs) => { request = args; return { count: 1 }; },
    findFirst: async (args: Prisma.MailConnectionFindFirstArgs) => { assert.equal(args.where?.companyId, connection.companyId); assert.equal(args.where?.syncToken, request?.data.syncToken); return connection; },
  } } as unknown as Prisma.TransactionClient;
  const leased = await acquireMailLease(client, connection.companyId, now);
  assert.deepEqual(request?.where, { companyId: connection.companyId, enabled: true, OR: [{ syncUntil: null }, { syncUntil: { lte: now } }] });
  assert.equal(request?.data.lastSyncAttemptAt, now);
  assert.equal((request?.data.syncUntil as Date).valueOf(), now.valueOf() + 90000);
  assert.equal(typeof leased.token, "string");
  const busy = { mailConnection: { updateMany: async () => ({ count: 0 }) } } as unknown as Prisma.TransactionClient;
  await assert.rejects(acquireMailLease(busy, connection.companyId), hasStatus(409));
});

test("synchronization stores encrypted review data and atomically advances a fenced cursor", async () => withEncryptionKey(async () => {
  const fixture = persistenceFixture();
  const result = await persistMailBatch(fixture.transaction, connection, "lease-a", batch);
  assert.deepEqual(result, { imported: 1, skipped: 0, hasMore: false });
  const data = fixture.creates[0].data;
  assert.equal(data.companyId, connection.companyId);
  assert.equal(decrypt(data.bodyTextEncrypted), message.bodyText);
  const files = data.attachments?.create as Prisma.MailAttachmentUncheckedCreateWithoutMessageInput[];
  assert.equal(files.length, 1);
  assert.equal(Object.hasOwn(files[0], "companyId"), false);
  assert.equal(decrypt(files[0].contentEncrypted), message.attachments[0].content.toString("base64"));
  assert.equal(fixture.updates[0].where?.mailboxVersion, connection.mailboxVersion);
  assert.equal(fixture.updates[0].where?.syncToken, "lease-a");
  assert.equal(fixture.updates[1].data.cursorUid, BigInt(11));
  assert.equal(fixture.updates[1].data.syncToken, null);
}));

test("repeated UIDs are not duplicated and superseded leases cannot write messages", async () => withEncryptionKey(async () => {
  const repeated = persistenceFixture(true);
  assert.deepEqual(await persistMailBatch(repeated.transaction, connection, "lease-a", batch), { imported: 0, skipped: 1, hasMore: false });
  assert.equal(repeated.creates.length, 0);
  const superseded = persistenceFixture(false, false);
  await assert.rejects(persistMailBatch(superseded.transaction, connection, "lease-a", batch), hasStatus(409));
  assert.equal(superseded.creates.length, 0);
}));

test("invalid document data is reported but encryption failures stop cursor advancement", async () => withEncryptionKey(async () => {
  const invalid = persistenceFixture();
  const input = { ...batch, messages: [{ ...message, attachments: [{ ...message.attachments[0], content: Buffer.from('<!DOCTYPE invoice><invoice/>') }] }] };
  await persistMailBatch(invalid.transaction, connection, "lease-a", input);
  assert.deepEqual(invalid.creates[0].data.attachments?.create, []);
  assert.deepEqual(invalid.creates[0].data.warnings, ["An invalid XML or PDF attachment was skipped."]);
  process.env.DATA_ENCRYPTION_KEY = "invalid";
  const failed = persistenceFixture();
  await assert.rejects(persistMailBatch(failed.transaction, connection, "lease-a", batch), /DATA_ENCRYPTION_KEY/);
  assert.equal(failed.creates.length, 0);
  assert.equal(failed.updates.length, 0);
}));

test("synchronization rejects regressing, unordered and out-of-range cursor data", async () => {
  for (const invalid of [
    { ...batch, cursorUid: 9, messages: [] },
    { ...batch, uidValidity: "not-a-number" },
    { ...batch, messages: [message, message] },
    { ...batch, messages: [{ ...message, uid: 12 }] },
    { ...batch, cursorUid: 4294967296, messages: [] },
  ]) {
    const fixture = persistenceFixture();
    await assert.rejects(persistMailBatch(fixture.transaction, connection, "lease-a", invalid), hasStatus(502));
    assert.equal(fixture.updates.length, 0);
  }
});

test("a transport failure releases only its lease and never starts a persistence transaction", async () => withEncryptionKey(async () => {
  const requests: Prisma.MailConnectionUpdateManyArgs[] = [];
  const client = {
    mailConnection: { updateMany: async (args: Prisma.MailConnectionUpdateManyArgs) => { requests.push(args); return { count: 1 }; }, findFirst: async () => ({ ...connection, passwordEncrypted: encrypt("abcdefghijklmnop") }) },
    $transaction: async () => { assert.fail("A failed download cannot write review data"); },
  } as unknown as Parameters<typeof synchronizeMailbox>[0];
  await assert.rejects(synchronizeMailbox(client, connection.companyId, async (input) => { assert.equal(input.password, "abcdefghijklmnop"); throw new Error("Transport failure with private provider details"); }), hasStatus(502));
  assert.equal(requests.length, 2);
  assert.equal(requests[1].where?.companyId, connection.companyId);
  assert.equal(requests[1].where?.syncToken, requests[0].data.syncToken);
  assert.equal(requests[1].data.syncToken, null);
  assert.equal(String(requests[1].data.lastSyncError).includes("private provider details"), false);
}));
