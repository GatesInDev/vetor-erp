import { ImapFlow } from "imapflow";
import type { ImapAttachment, ImapMessage, ImapSyncBatch, ImapSyncInput, MailTransport } from "./types";

const attachmentLimit = 2 * 1024 * 1024;
const messageAttachmentLimit = 10 * 1024 * 1024;
const bodyTextLimit = 16 * 1024;
const searchWindow = 500;
const maximumSearchWindows = 10;

export type MailboxClient = Pick<ImapFlow, "connect" | "close" | "mailboxOpen" | "search" | "fetchOne" | "download" | "capabilities" | "on">;
type MessageData = NonNullable<Exclude<Awaited<ReturnType<ImapFlow["fetchOne"]>>, boolean>>;
type BodyNode = NonNullable<MessageData["bodyStructure"]>;
type ClientFactory = (options: ConstructorParameters<typeof ImapFlow>[0]) => MailboxClient;

export class MailTransportError extends Error {
  constructor(message = "Unable to read Gmail. Check the connection settings and try again.") {
    super(message);
    this.name = "MailTransportError";
  }
}

class DeadlineError extends MailTransportError {
  constructor() { super("Gmail synchronization timed out. Try again to continue importing."); }
}

function boundedText(value: string | undefined, maximum: number) {
  return (value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, maximum);
}

function bodyParts(root: BodyNode | undefined): BodyNode[] {
  if (!root) return [];
  const stack = [{ node: root, depth: 0 }];
  const result: BodyNode[] = [];
  let visited = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (++visited > 512 || current.depth > 32) throw new MailTransportError("Message MIME structure is too complex.");
    if (current.node.type.toLowerCase().startsWith("multipart/") && current.node.childNodes?.length) {
      for (let index = current.node.childNodes.length - 1; index >= 0; index -= 1) stack.push({ node: current.node.childNodes[index], depth: current.depth + 1 });
    } else {
      result.push(current.node);
    }
  }
  return result;
}

function attachmentInfo(part: BodyNode): Omit<ImapAttachment, "content"> | null {
  const type = part.type?.toLowerCase() ?? "";
  const providedName = part.dispositionParameters?.filename ?? part.parameters?.name ?? "";
  const extension = /\.(xml|pdf)$/i.exec(providedName)?.[1].toLowerCase();
  const kind = type === "application/pdf" ? "pdf" : ["application/xml", "text/xml"].includes(type) ? "xml" : extension;
  if (!kind || (extension && extension !== kind)) return null;
  if (!["application/pdf", "application/xml", "text/xml", "application/octet-stream", ""].includes(type)) return null;
  const rawName = providedName || `attachment-${part.part ?? "1"}.${kind}`;
  const cleanName = rawName.replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim();
  const stem = cleanName.replace(/\.(xml|pdf)$/i, "").slice(0, 170) || "attachment";
  return { partId: part.part || "1", fileName: `${stem}.${kind}`, mediaType: kind === "pdf" ? "application/pdf" : "application/xml" };
}

async function readPart(client: MailboxClient, uid: number, part: BodyNode, maximum: number, checkDeadline: () => void) {
  checkDeadline();
  const download = await client.download(uid, part.part || "1", { uid: true, maxBytes: maximum + 1, chunkSize: 32 * 1024 });
  checkDeadline();
  if (!download.content) throw new MailTransportError("A Gmail attachment disappeared during synchronization. Try again.");
  const chunks: Buffer[] = [];
  let size = 0;
  let exceeded = false;
  for await (const chunk of download.content) {
    checkDeadline();
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const previousSize = size;
    size += bytes.length;
    if (previousSize < maximum) chunks.push(bytes.subarray(0, maximum - previousSize));
    if (size > maximum) {
      exceeded = true;
    }
    if (size > maximum + 32 * 1024) {
      download.content.destroy();
      throw new MailTransportError("Attachment download exceeded its bounded response.");
    }
  }
  checkDeadline();
  return { content: Buffer.concat(chunks), exceeded, charset: download.meta.charset, contentType: download.meta.contentType };
}

async function readMessage(client: MailboxClient, message: MessageData, checkDeadline: () => void): Promise<ImapMessage> {
  const envelope = message.envelope;
  const receivedAt = message.internalDate instanceof Date ? message.internalDate : new Date(message.internalDate || 0);
  if (Number.isNaN(receivedAt.valueOf())) throw new MailTransportError("Gmail returned an invalid message date.");
  const result: ImapMessage = {
    uid: message.uid,
    messageId: envelope?.messageId ? boundedText(envelope.messageId, 1000) : null,
    subject: boundedText(envelope?.subject, 500),
    from: boundedText(envelope?.from?.map((sender) => sender.address ? `${sender.name ? `${sender.name} ` : ""}<${sender.address}>` : sender.name ?? "").join(", "), 1000),
    receivedAt,
    bodyText: "",
    warnings: [],
    attachments: [],
  };
  let parts: BodyNode[];
  try { parts = bodyParts(message.bodyStructure); } catch {
    result.warnings.push("Message MIME structure is too complex; its content was not imported.");
    return result;
  }
  const plain = parts.find((part) => part.type?.toLowerCase() === "text/plain" && part.disposition?.toLowerCase() !== "attachment" && !part.dispositionParameters?.filename && !part.parameters?.name);
  if (plain) {
    const text = await readPart(client, message.uid, plain, bodyTextLimit, checkDeadline);
    try { result.bodyText = boundedText(new TextDecoder(text.charset || plain.parameters?.charset || "utf-8").decode(text.content), bodyTextLimit); } catch {
      result.bodyText = boundedText(text.content.toString("utf8"), bodyTextLimit);
      result.warnings.push("The message text uses an unsupported charset and may contain replacement characters.");
    }
    if (text.exceeded || (plain.size ?? 0) > bodyTextLimit) result.warnings.push("The plain text body is limited to a 16 KiB preview.");
  } else if (parts.some((part) => part.type?.toLowerCase() === "text/html")) {
    result.warnings.push("This message has no plain text body. HTML was not imported.");
  }
  let total = 0;
  let candidates = 0;
  for (const part of parts) {
    const isAttachment = part.disposition?.toLowerCase() === "attachment" || Boolean(part.dispositionParameters?.filename || part.parameters?.name) || ["application/pdf", "application/xml", "text/xml", "message/rfc822"].includes(part.type?.toLowerCase() ?? "");
    if (!isAttachment) continue;
    const info = attachmentInfo(part);
    if (!info) {
      result.warnings.push(`Unsupported attachment skipped: ${boundedText(part.dispositionParameters?.filename || part.parameters?.name || part.type, 180)}.`);
      continue;
    }
    candidates += 1;
    if (candidates > 10) {
      if (candidates === 11) result.warnings.push("Only the first 10 XML/PDF attachment parts are considered per message.");
      continue;
    }
    const available = Math.min(attachmentLimit, messageAttachmentLimit - total);
    if (available <= 0) {
      result.warnings.push(`Attachment skipped because the message reached its 10 MiB limit: ${info.fileName}.`);
      continue;
    }
    const file = await readPart(client, message.uid, part, available, checkDeadline);
    if (file.exceeded || !file.content.length) {
      result.warnings.push(`Attachment skipped because it is empty or exceeds the 2 MiB file / 10 MiB message limit: ${info.fileName}.`);
      continue;
    }
    if (file.contentType && ![info.mediaType, "application/octet-stream", ...(info.mediaType === "application/xml" ? ["text/xml"] : [])].includes(file.contentType.toLowerCase())) {
      result.warnings.push(`Attachment skipped because its MIME metadata is inconsistent: ${info.fileName}.`);
      continue;
    }
    total += file.content.length;
    result.attachments.push({ ...info, content: file.content });
  }
  return result;
}

export function createMailboxTransport(createClient: ClientFactory = (options) => new ImapFlow(options)): MailTransport {
  return async (input: ImapSyncInput) => {
    if (!Number.isInteger(input.afterUid) || input.afterUid < 0 || input.afterUid > 4294967295 || Number.isNaN(input.importSince.valueOf()) || !Number.isFinite(input.limit) || !Number.isFinite(input.deadlineMs)) throw new MailTransportError("Invalid mailbox import cursor.");
    const duration = Math.min(25000, Math.max(1, input.deadlineMs));
    const deadline = Date.now() + duration;
    const limit = Math.min(20, Math.max(1, Math.floor(input.limit)));
    const client = createClient({
      host: "imap.gmail.com", port: 993, secure: true, servername: "imap.gmail.com",
      auth: { user: input.username, pass: input.password }, tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
      logger: false, logRaw: false, emitLogs: false, disableAutoIdle: true, disableCompression: true,
      connectionTimeout: Math.min(20000, duration), greetingTimeout: Math.min(10000, duration), socketTimeout: Math.min(20000, duration),
    });
    let cancelled = false;
    let result: ImapSyncBatch | null = null;
    let rejectFailure: (error: Error) => void = () => undefined;
    const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
    const stop = (error: Error) => {
      if (cancelled) return;
      cancelled = true;
      rejectFailure(error);
      client.close();
    };
    client.on("error", () => stop(new MailTransportError()));
    const timer = setTimeout(() => stop(new DeadlineError()), duration);
    const checkDeadline = () => { if (cancelled || Date.now() >= deadline) throw new DeadlineError(); };
    const receive = async () => {
      await client.connect();
      checkDeadline();
      const mailbox = await client.mailboxOpen(input.folder, { readOnly: true });
      checkDeadline();
      if (!mailbox.readOnly) throw new MailTransportError("Gmail did not open the mailbox in read-only mode.");
      const uidValidity = mailbox.uidValidity.toString();
      const lastUid = mailbox.uidNext - 1;
      if (!Number.isInteger(lastUid) || lastUid < 0 || lastUid > 4294967295 || !/^\d+$/.test(uidValidity)) throw new MailTransportError("Gmail returned an invalid mailbox cursor.");
      result = { uidValidity, cursorUid: input.uidValidity === uidValidity ? Math.min(input.afterUid, lastUid) : 0, hasMore: true, messages: [] };
      let batchBytes = 0;
      if (result.cursorUid < lastUid && client.capabilities.has("ESEARCH")) {
        const first = await client.search({ uid: `${result.cursorUid + 1}:${lastUid}`, since: input.importSince }, { uid: true, returnOptions: ["MIN"] });
        checkDeadline();
        if (!first || Array.isArray(first)) throw new MailTransportError("Gmail returned an invalid bounded search response.");
        if (first.min === undefined) result.cursorUid = lastUid;
        else if (Number.isInteger(first.min) && first.min > result.cursorUid && first.min <= lastUid) result.cursorUid = first.min - 1;
        else throw new MailTransportError("Gmail returned an invalid bounded search cursor.");
      }
      for (let window = 0; window < maximumSearchWindows && result.cursorUid < lastUid && result.messages.length < limit && batchBytes < messageAttachmentLimit; window += 1) {
        checkDeadline();
        const start = result.cursorUid + 1;
        const end = Math.min(lastUid, result.cursorUid + searchWindow);
        const found = await client.search({ uid: `${start}:${end}`, since: input.importSince }, { uid: true });
        checkDeadline();
        if (!Array.isArray(found)) throw new MailTransportError("Gmail returned an invalid search response.");
        const uids = [...new Set(found || [])].sort((left, right) => left - right);
        if (uids.length > searchWindow || uids.some((uid) => !Number.isInteger(uid) || uid < start || uid > end)) throw new MailTransportError("Gmail returned an out-of-range message identifier.");
        for (const uid of uids) {
          if (result.messages.length >= limit || batchBytes >= messageAttachmentLimit) break;
          checkDeadline();
          const message = await client.fetchOne(uid, { uid: true, envelope: true, bodyStructure: true, internalDate: true }, { uid: true });
          checkDeadline();
          if (message) {
            if (message.uid !== uid) throw new MailTransportError("Gmail returned an unexpected message identifier.");
            const imported = await readMessage(client, message, checkDeadline);
            checkDeadline();
            result.messages.push(imported);
            batchBytes += imported.attachments.reduce((total, attachment) => total + attachment.content.length, 0);
          }
          result.cursorUid = uid;
        }
        if (!uids.length || result.cursorUid === uids[uids.length - 1]) result.cursorUid = end;
      }
      result.hasMore = result.cursorUid < lastUid;
      return result;
    };
    try {
      return await Promise.race([receive(), failure]);
    } catch (error) {
      const partial = result as ImapSyncBatch | null;
      if (error instanceof DeadlineError && partial && partial.messages.length) return { ...partial, hasMore: true, messages: [...partial.messages] };
      throw error instanceof MailTransportError ? error : new MailTransportError();
    } finally {
      cancelled = true;
      clearTimeout(timer);
      client.close();
    }
  };
}

export const fetchMailboxBatch = createMailboxTransport();
