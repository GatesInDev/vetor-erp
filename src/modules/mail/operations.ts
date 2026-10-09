import type { MailConnection, Prisma } from "@prisma/client";
import { HttpError } from "@/lib/auth";
import { decrypt, encrypt, sha256 } from "@/lib/crypto";
import type { RentalFileInput } from "@/modules/rentals/documents-schema";
import type { MailConnectionInput, MailMessageFilters } from "./schema";
import type { MailAttachmentView, MailConnectionView, MailMessageDetail, MailMessageRow } from "./types";

type MailReadClient = Pick<Prisma.TransactionClient, "mailConnection" | "mailMessage" | "mailAttachment">;
const attachmentSelect = { id: true, fileName: true, mediaType: true, sizeBytes: true, rentalChargeId: true, rentalCharge: { select: { rentalId: true } } } satisfies Prisma.MailAttachmentSelect;
const messageSelect = { id: true, subject: true, from: true, receivedAt: true, attachments: { select: { rentalChargeId: true } } } satisfies Prisma.MailMessageSelect;
type MessageRecord = Prisma.MailMessageGetPayload<{ select: typeof messageSelect }>;

export function mailboxIdentity(companyId: string, username: string, folder: string): string {
  const hash = sha256(JSON.stringify([companyId, username.toLowerCase(), folder]));
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function mailConnectionView(connection: MailConnection): MailConnectionView {
  return { id: connection.id, username: connection.username, host: "imap.gmail.com", port: 993, folder: connection.folder, enabled: connection.enabled, autoSync: connection.autoSync, importSince: connection.importSince.toISOString().slice(0, 10), revision: connection.revision, hasPassword: Boolean(connection.passwordEncrypted), lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null, lastSyncError: connection.lastSyncError, syncing: Boolean(connection.syncUntil && connection.syncUntil > new Date()) };
}

export async function readMailConnection(client: Pick<MailReadClient, "mailConnection">, companyId: string): Promise<MailConnectionView | null> {
  const connection = await client.mailConnection.findUnique({ where: { companyId } });
  return connection ? mailConnectionView(connection) : null;
}

export async function saveMailConnection(transaction: Prisma.TransactionClient, companyId: string, input: MailConnectionInput): Promise<MailConnectionView> {
  const current = await transaction.mailConnection.findUnique({ where: { companyId } });
  const { password, revision, importSince, ...settings } = input;
  if (!current) {
    if (!password) throw new HttpError(422, "Google app password is required");
    if (revision !== undefined) throw new HttpError(409, "Email connection changed; reload before saving");
    const connection = await transaction.mailConnection.create({ data: { companyId, ...settings, mailboxVersion: mailboxIdentity(companyId, settings.username, settings.folder), importSince: new Date(`${importSince}T00:00:00Z`), passwordEncrypted: encrypt(password) } });
    return mailConnectionView(connection);
  }
  if (revision !== current.revision) throw new HttpError(409, "Email connection changed; reload before saving");
  if (settings.username !== current.username && !password) throw new HttpError(422, "A new Google app password is required when changing the account");
  const resetCursor = current.username !== settings.username || current.folder !== settings.folder || current.importSince.toISOString().slice(0, 10) !== importSince;
  const updated = await transaction.mailConnection.updateMany({ where: { companyId, id: current.id, revision }, data: {
    ...settings, importSince: new Date(`${importSince}T00:00:00Z`), ...(password ? { passwordEncrypted: encrypt(password) } : {}),
    ...(resetCursor ? { mailboxVersion: mailboxIdentity(companyId, settings.username, settings.folder), uidValidity: null, cursorUid: 0, lastSyncedAt: null } : {}),
    syncToken: null, syncUntil: null, lastSyncError: null, revision: { increment: 1 },
  } });
  if (updated.count !== 1) throw new HttpError(409, "Email connection changed; reload before saving");
  const saved = await transaction.mailConnection.findUnique({ where: { companyId } });
  if (!saved) throw new HttpError(404, "Email connection not found");
  return mailConnectionView(saved);
}

function messageRow(message: MessageRecord): MailMessageRow {
  return { id: message.id, subject: message.subject, from: message.from, receivedAt: message.receivedAt.toISOString(), attachmentCount: message.attachments.length, importedAttachmentCount: message.attachments.filter((attachment) => attachment.rentalChargeId !== null).length };
}

export async function readMailMessages(client: Pick<MailReadClient, "mailMessage">, companyId: string, filters: MailMessageFilters = {}): Promise<{ messages: MailMessageRow[]; nextCursor: string | null }> {
  const where: Prisma.MailMessageWhereInput = {
    companyId,
    ...(filters.search ? { OR: [{ subject: { contains: filters.search, mode: "insensitive" } }, { from: { contains: filters.search, mode: "insensitive" } }] } : {}),
    ...(filters.status === "PENDING" ? { attachments: { some: { rentalChargeId: null } } } : {}),
    ...(filters.status === "IMPORTED" ? { attachments: { some: {}, every: { rentalChargeId: { not: null } } } } : {}),
  };
  if (filters.cursor) {
    const cursor = await client.mailMessage.findFirst({ where: { companyId, id: filters.cursor }, select: { id: true, receivedAt: true } });
    if (!cursor) throw new HttpError(400, "Invalid email cursor");
    where.AND = [{ OR: [{ receivedAt: { lt: cursor.receivedAt } }, { receivedAt: cursor.receivedAt, id: { lt: cursor.id } }] }];
  }
  const rows = await client.mailMessage.findMany({ where, select: messageSelect, orderBy: [{ receivedAt: "desc" }, { id: "desc" }], take: 31 });
  const messages = rows.slice(0, 30).map(messageRow);
  return { messages, nextCursor: rows.length > 30 ? messages.at(-1)?.id ?? null : null };
}

export async function readMailMessage(client: Pick<MailReadClient, "mailMessage">, companyId: string, id: string): Promise<MailMessageDetail | null> {
  const message = await client.mailMessage.findFirst({ where: { companyId, id }, select: { ...messageSelect, bodyTextEncrypted: true, warnings: true, attachments: { select: attachmentSelect } } });
  if (!message) return null;
  return { ...messageRow(message), bodyText: decrypt(message.bodyTextEncrypted), warnings: Array.isArray(message.warnings) ? message.warnings.filter((warning): warning is string => typeof warning === "string") : [], attachments: message.attachments.map((attachment): MailAttachmentView => ({ id: attachment.id, fileName: attachment.fileName, mediaType: attachment.mediaType as MailAttachmentView["mediaType"], sizeBytes: attachment.sizeBytes, rentalChargeId: attachment.rentalChargeId, rentalId: attachment.rentalCharge?.rentalId ?? null })) };
}

export async function readMailAttachment(client: Pick<MailReadClient, "mailAttachment">, companyId: string, messageId: string, id: string) {
  const attachment = await client.mailAttachment.findFirst({ where: { companyId, messageId, id, message: { companyId } } });
  if (!attachment) throw new HttpError(404, "Email attachment not found");
  return { fileName: attachment.fileName, mediaType: attachment.mediaType, content: Buffer.from(decrypt(attachment.contentEncrypted), "base64") };
}

export async function readMailAttachmentFiles(client: Pick<MailReadClient, "mailMessage" | "mailAttachment">, companyId: string, messageId: string, attachmentIds: string[], requireUnimported = true): Promise<RentalFileInput[]> {
  if (!attachmentIds.length || attachmentIds.length > 3 || new Set(attachmentIds).size !== attachmentIds.length) throw new HttpError(400, "Select one to three distinct attachments");
  const message = await client.mailMessage.findFirst({ where: { companyId, id: messageId }, select: { id: true } });
  if (!message) throw new HttpError(404, "Email message not found");
  const attachments = await client.mailAttachment.findMany({ where: { companyId, messageId, id: { in: attachmentIds } } });
  if (attachments.length !== attachmentIds.length) throw new HttpError(404, "Email attachment not found");
  if (requireUnimported && attachments.some((attachment) => attachment.rentalChargeId !== null)) throw new HttpError(409, "An attachment has already been imported");
  if (attachments.reduce((total, attachment) => total + attachment.sizeBytes, 0) > 2 * 1024 * 1024) throw new HttpError(422, "Selected files must total at most 2 MiB");
  return attachmentIds.map((id) => {
    const attachment = attachments.find((candidate) => candidate.id === id)!;
    return { fileName: attachment.fileName, mediaType: attachment.mediaType as RentalFileInput["mediaType"], contentBase64: decrypt(attachment.contentEncrypted) };
  });
}
