import assert from "node:assert/strict";
import test from "node:test";
import type { MailConnection, Prisma } from "@prisma/client";
import { HttpError } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { mailboxIdentity, mailConnectionView, readMailAttachment, readMailAttachmentFiles, readMailMessage, readMailMessages, saveMailConnection } from "./operations";
import type { MailConnectionInput } from "./schema";

const connection: MailConnection = {
  id: "connection-a", companyId: "company-a", username: "test@example.com", passwordEncrypted: "secret-ciphertext", folder: "INBOX", enabled: true, autoSync: true,
  importSince: new Date("2026-10-01T00:00:00Z"), revision: 2, mailboxVersion: "mailbox-a", uidValidity: "100", cursorUid: BigInt(10),
  syncToken: null, syncUntil: null, lastSyncedAt: null, lastSyncAttemptAt: null, lastSyncError: null, createdAt: new Date(), updatedAt: new Date(),
};
const input: MailConnectionInput = { username: connection.username, folder: "INBOX", enabled: true, autoSync: true, importSince: "2026-10-01", revision: 2 };
const hasStatus = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;

async function withEncryptionKey(operation: () => Promise<void>) {
  const previous = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
  try { await operation(); } finally {
    if (previous === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = previous;
  }
}

test("mail settings expose no credential or cursor and mailbox identity is stable per tenant and account", () => {
  const view = mailConnectionView(connection);
  assert.equal(view.hasPassword, true);
  assert.equal("passwordEncrypted" in view, false);
  assert.equal("password" in view, false);
  assert.equal("cursorUid" in view, false);
  assert.equal("syncToken" in view, false);
  assert.equal(mailboxIdentity("a", "TEST@example.com", "INBOX"), mailboxIdentity("a", "test@example.com", "INBOX"));
  assert.notEqual(mailboxIdentity("a", connection.username, "INBOX"), mailboxIdentity("b", connection.username, "INBOX"));
  assert.notEqual(mailboxIdentity("a", connection.username, "INBOX"), mailboxIdentity("a", connection.username, "Invoices"));
});

test("new Gmail settings require a password and persist only encrypted credentials", async () => withEncryptionKey(async () => {
  let saved: Prisma.MailConnectionCreateArgs | undefined;
  const transaction = { mailConnection: {
    findUnique: async (args: Prisma.MailConnectionFindUniqueArgs) => { assert.deepEqual(args.where, { companyId: connection.companyId }); return null; },
    create: async (args: Prisma.MailConnectionCreateArgs) => { saved = args; return { ...connection, ...args.data }; },
  } } as unknown as Prisma.TransactionClient;
  const { revision: omittedRevision, ...newInput } = input;
  assert.equal(omittedRevision, 2);
  await assert.rejects(saveMailConnection(transaction, connection.companyId, newInput), hasStatus(422));
  const result = await saveMailConnection(transaction, connection.companyId, { ...newInput, password: "abcdefghijklmnop" });
  assert.equal(saved?.data.companyId, connection.companyId);
  assert.equal(decrypt(saved!.data.passwordEncrypted), "abcdefghijklmnop");
  assert.equal(JSON.stringify(result).includes("abcdefghijklmnop"), false);
  assert.equal(JSON.stringify(saved).includes('"password":'), false);
}));

test("mail configuration rejects stale revisions and requires new credentials when changing account", async () => {
  const transaction = { mailConnection: { findUnique: async () => connection } } as unknown as Prisma.TransactionClient;
  await assert.rejects(saveMailConnection(transaction, connection.companyId, { ...input, revision: 1 }), hasStatus(409));
  await assert.rejects(saveMailConnection(transaction, connection.companyId, { ...input, username: "other@example.com" }), hasStatus(422));
});

test("changing the import period resets the cursor but preserves mailbox deduplication and invalidates active work", async () => {
  let update: Prisma.MailConnectionUpdateManyArgs | undefined;
  const transaction = { mailConnection: { findUnique: async () => connection, updateMany: async (args: Prisma.MailConnectionUpdateManyArgs) => { update = args; return { count: 1 }; } } } as unknown as Prisma.TransactionClient;
  await saveMailConnection(transaction, connection.companyId, { ...input, importSince: "2026-09-01" });
  assert.deepEqual(update?.where, { companyId: connection.companyId, id: connection.id, revision: 2 });
  assert.equal(update?.data.cursorUid, 0);
  assert.equal(update?.data.uidValidity, null);
  assert.equal(update?.data.mailboxVersion, mailboxIdentity(connection.companyId, connection.username, connection.folder));
  assert.equal(update?.data.syncToken, null);
  assert.equal(update?.data.syncUntil, null);
  assert.equal(update?.data.passwordEncrypted, undefined);
  const raced = { mailConnection: { findUnique: async () => connection, updateMany: async () => ({ count: 0 }) } } as unknown as Prisma.TransactionClient;
  await assert.rejects(saveMailConnection(raced, connection.companyId, input), hasStatus(409));
});

test("mail message pagination validates tenant ownership of cursors and never selects message bodies", async () => {
  const receivedAt = new Date("2026-10-02T00:00:00Z");
  const client = { mailMessage: {
    findFirst: async (args: Prisma.MailMessageFindFirstArgs) => { assert.deepEqual(args.where, { companyId: connection.companyId, id: "cursor-a" }); return { id: "cursor-a", receivedAt }; },
    findMany: async (args: Prisma.MailMessageFindManyArgs) => {
      assert.equal(args.where?.companyId, connection.companyId);
      assert.deepEqual(args.where?.AND, [{ OR: [{ receivedAt: { lt: receivedAt } }, { receivedAt, id: { lt: "cursor-a" } }] }]);
      assert.equal(args.select?.bodyTextEncrypted, undefined);
      assert.equal(args.take, 31);
      return Array.from({ length: 31 }, (_, index) => ({ id: `message-${index}`, subject: "Invoice", from: "supplier@example.com", receivedAt, attachments: [{ rentalChargeId: null }] }));
    },
  } } as unknown as Prisma.TransactionClient;
  const result = await readMailMessages(client, connection.companyId, { cursor: "cursor-a" });
  assert.equal(result.messages.length, 30);
  assert.equal(result.nextCursor, "message-29");
  const foreign = { mailMessage: { findFirst: async () => null } } as unknown as Prisma.TransactionClient;
  await assert.rejects(readMailMessages(foreign, connection.companyId, { cursor: "foreign-cursor" }), hasStatus(400));
});

test("message detail and attachment downloads reject foreign tenant data", async () => {
  const client = {
    mailMessage: { findFirst: async (args: Prisma.MailMessageFindFirstArgs) => { assert.deepEqual(args.where, { companyId: connection.companyId, id: "message-a" }); return null; } },
    mailAttachment: { findFirst: async (args: Prisma.MailAttachmentFindFirstArgs) => { assert.deepEqual(args.where, { companyId: connection.companyId, messageId: "message-a", id: "attachment-a", message: { companyId: connection.companyId } }); return null; } },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await readMailMessage(client, connection.companyId, "message-a"), null);
  await assert.rejects(readMailAttachment(client, connection.companyId, "message-a", "attachment-a"), hasStatus(404));
});

test("attachment selection requires distinct, unimported files belonging to the chosen message and limits total bytes", async () => withEncryptionKey(async () => {
  const files = ["a", "b"].map((id) => ({ id, fileName: `${id}.pdf`, mediaType: "application/pdf", rentalChargeId: null, sizeBytes: 20, contentEncrypted: encrypt(Buffer.from(`file-${id}`).toString("base64")) }));
  const client = {
    mailMessage: { findFirst: async (args: Prisma.MailMessageFindFirstArgs) => { assert.deepEqual(args.where, { companyId: connection.companyId, id: "message-a" }); return { id: "message-a" }; } },
    mailAttachment: { findMany: async (args: Prisma.MailAttachmentFindManyArgs) => { assert.deepEqual(args.where, { companyId: connection.companyId, messageId: "message-a", id: { in: ["b", "a"] } }); return files; } },
  } as unknown as Prisma.TransactionClient;
  const result = await readMailAttachmentFiles(client, connection.companyId, "message-a", ["b", "a"]);
  assert.deepEqual(result.map((file) => file.fileName), ["b.pdf", "a.pdf"]);
  assert.equal(result[0].contentBase64, Buffer.from("file-b").toString("base64"));
  await assert.rejects(readMailAttachmentFiles(client, connection.companyId, "message-a", ["a", "a"]), hasStatus(400));
  const imported = { mailMessage: client.mailMessage, mailAttachment: { findMany: async () => [{ ...files[0], rentalChargeId: "charge-a" }, files[1]] } } as unknown as Prisma.TransactionClient;
  await assert.rejects(readMailAttachmentFiles(imported, connection.companyId, "message-a", ["b", "a"]), hasStatus(409));
  const oversized = { mailMessage: client.mailMessage, mailAttachment: { findMany: async () => files.map((file) => ({ ...file, sizeBytes: 2 * 1024 * 1024 })) } } as unknown as Prisma.TransactionClient;
  await assert.rejects(readMailAttachmentFiles(oversized, connection.companyId, "message-a", ["b", "a"]), hasStatus(422));
  const missing = { mailMessage: client.mailMessage, mailAttachment: { findMany: async () => [] } } as unknown as Prisma.TransactionClient;
  await assert.rejects(readMailAttachmentFiles(missing, connection.companyId, "message-a", ["b", "a"]), hasStatus(404));
}));
