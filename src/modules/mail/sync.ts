import { createHash, randomUUID } from "node:crypto";
import { Prisma, type MailConnection } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { prepareRentalFiles } from "@/modules/rentals/documents";
import type { ImapMessage, ImapSyncBatch, MailSyncResult, MailTransport } from "./types";

type SyncClient = Pick<Prisma.TransactionClient, "mailConnection"> & { $transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number }): Promise<T> };
const leaseDurationMs = 90000;
const maximumUid = 4294967295;

export async function acquireMailLease(client: Pick<SyncClient, "mailConnection">, companyId: string, now = new Date()) {
  const token = randomUUID();
  const updated = await client.mailConnection.updateMany({ where: { companyId, enabled: true, OR: [{ syncUntil: null }, { syncUntil: { lte: now } }] }, data: { syncToken: token, syncUntil: new Date(now.valueOf() + leaseDurationMs), lastSyncAttemptAt: now } });
  if (updated.count !== 1) throw new HttpError(409, "Email connection is disabled or already synchronizing");
  const connection = await client.mailConnection.findFirst({ where: { companyId, syncToken: token } });
  if (!connection) throw new HttpError(409, "Email connection changed; synchronize again");
  return { connection, token };
}

async function prepareMessage(message: ImapMessage) {
  const files: Prisma.MailAttachmentUncheckedCreateWithoutMessageInput[] = [];
  const warnings = message.warnings.slice(0, 30).map((warning) => warning.slice(0, 300));
  const hashes = new Set<string>();
  const parts = new Set<string>();
  let total = 0;
  for (const attachment of message.attachments) {
    if (files.length === 10 || attachment.content.length > 2 * 1024 * 1024 || total + attachment.content.length > 10 * 1024 * 1024) {
      warnings.push("An attachment exceeded the email import limits and was skipped.");
      continue;
    }
    const hash = createHash("sha256").update(attachment.content).digest("hex");
    if (hashes.has(hash) || parts.has(attachment.partId)) continue;
    if (!attachment.partId || attachment.partId.length > 80) {
      warnings.push("An attachment could not be identified and was skipped.");
      continue;
    }
    try {
      const [file] = await prepareRentalFiles([{ fileName: attachment.fileName, mediaType: attachment.mediaType, contentBase64: attachment.content.toString("base64") }]);
      files.push({ ...file, partId: attachment.partId, contentHash: hash });
      total += attachment.content.length;
      hashes.add(hash);
      parts.add(attachment.partId);
    } catch (error) {
      if (!(error instanceof z.ZodError) && !(error instanceof HttpError && error.status === 400)) throw error;
      warnings.push("An invalid XML or PDF attachment was skipped.");
    }
  }
  return { message, files, warnings: [...new Set(warnings)].slice(0, 30) };
}

function validateBatch(connection: MailConnection, batch: ImapSyncBatch): void {
  if (!/^\d{1,40}$/.test(batch.uidValidity) || !Number.isInteger(batch.cursorUid) || batch.cursorUid < 0 || batch.cursorUid > maximumUid || batch.messages.length > 20) throw new HttpError(502, "Invalid email synchronization response");
  let previous = connection.uidValidity === batch.uidValidity ? Number(connection.cursorUid) : 0;
  if (batch.cursorUid < previous) throw new HttpError(502, "Invalid email synchronization cursor");
  for (const message of batch.messages) {
    if (!Number.isInteger(message.uid) || message.uid <= previous || message.uid > batch.cursorUid || Number.isNaN(message.receivedAt.valueOf())) throw new HttpError(502, "Invalid email message response");
    previous = message.uid;
  }
}

export async function persistMailBatch(transaction: Prisma.TransactionClient, connection: MailConnection, token: string, batch: ImapSyncBatch): Promise<MailSyncResult> {
  validateBatch(connection, batch);
  const prepared = await Promise.all(batch.messages.map(prepareMessage));
  const now = new Date();
  const fenced = await transaction.mailConnection.updateMany({ where: { id: connection.id, companyId: connection.companyId, mailboxVersion: connection.mailboxVersion, syncToken: token, syncUntil: { gt: now }, enabled: true }, data: { syncUntil: new Date(now.valueOf() + leaseDurationMs) } });
  if (fenced.count !== 1) throw new HttpError(409, "Email synchronization expired or the connection changed");
  let imported = 0;
  let skipped = 0;
  for (const { message, files, warnings } of prepared) {
    const key = { companyId: connection.companyId, mailboxVersion: connection.mailboxVersion, uidValidity: batch.uidValidity, uid: BigInt(message.uid) };
    const existing = await transaction.mailMessage.findUnique({ where: { companyId_mailboxVersion_uidValidity_uid: key }, select: { id: true } });
    if (existing) { skipped += 1; continue; }
    await transaction.mailMessage.create({ data: { ...key, messageId: message.messageId?.slice(0, 500) ?? null, subject: message.subject.slice(0, 500), from: message.from.slice(0, 1000), receivedAt: message.receivedAt, bodyTextEncrypted: encrypt(message.bodyText.slice(0, 40000)), warnings, attachments: { create: files } } });
    imported += 1;
  }
  const completed = await transaction.mailConnection.updateMany({ where: { id: connection.id, companyId: connection.companyId, syncToken: token }, data: { uidValidity: batch.uidValidity, cursorUid: BigInt(batch.cursorUid), syncToken: null, syncUntil: null, lastSyncedAt: new Date(), lastSyncError: null } });
  if (completed.count !== 1) throw new HttpError(409, "Email synchronization was superseded");
  return { imported, skipped, hasMore: batch.hasMore };
}

export async function synchronizeMailbox(client: SyncClient, companyId: string, transport: MailTransport, deadlineMs = 25000): Promise<MailSyncResult> {
  const { connection, token } = await acquireMailLease(client, companyId);
  try {
    const batch = await transport({ username: connection.username, password: decrypt(connection.passwordEncrypted), folder: connection.folder, importSince: connection.importSince, uidValidity: connection.uidValidity, afterUid: Number(connection.cursorUid), limit: 20, deadlineMs });
    return await client.$transaction((transaction) => persistMailBatch(transaction, connection, token, batch), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  } catch (error) {
    await client.mailConnection.updateMany({ where: { companyId, syncToken: token }, data: { syncToken: null, syncUntil: null, lastSyncError: "Email synchronization failed. Check the Google app password, mailbox and account access." } });
    if (error instanceof HttpError && error.status === 409) throw error;
    throw new HttpError(502, "Email synchronization failed. Check the Google app password, mailbox and account access.");
  }
}
