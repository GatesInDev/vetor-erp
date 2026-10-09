import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import type { ImapFlow } from "imapflow";
import { createMailboxTransport, MailTransportError, type MailboxClient } from "./imap";
import type { ImapSyncInput } from "./types";

type Message = NonNullable<Exclude<Awaited<ReturnType<ImapFlow["fetchOne"]>>, boolean>>;
type Part = NonNullable<Message["bodyStructure"]>;
const input: ImapSyncInput = { username: "mail@example.com", password: "test-app-password", folder: "INBOX", importSince: new Date("2026-10-01T00:00:00Z"), uidValidity: "123", afterUid: 0, limit: 20, deadlineMs: 1000 };

function message(uid: number, parts: Part[] = []): Message {
  return { seq: uid, uid, internalDate: new Date("2026-10-02T10:00:00Z"), envelope: { subject: "Invoice for review", from: [{ name: "Supplier", address: "supplier@example.com" }], messageId: `<message-${uid}>` }, bodyStructure: { type: "multipart/mixed", childNodes: parts } };
}

function file(part: string, fileName = `${part}.pdf`, type = "application/pdf"): Part {
  return { part, type, disposition: "attachment", dispositionParameters: { filename: fileName }, size: 1 };
}

function fixture(messages: Message[], options: { uidValidity?: string; uidNext?: number; extended?: boolean } = {}) {
  const calls = { options: null as ConstructorParameters<typeof ImapFlow>[0] | null, folders: [] as unknown[], searches: [] as { query: { uid?: string; since?: Date | string }; options: unknown }[], downloads: [] as { uid: number | string; part: string | undefined; options: unknown }[], fetches: [] as unknown[], closed: 0 };
  const responses = new Map<string, Buffer>();
  const client = {
    capabilities: new Map(options.extended ? [["ESEARCH", true]] : []),
    on() { return client; },
    connect: async () => undefined,
    close: () => { calls.closed += 1; },
    mailboxOpen: async (folder: string, openOptions: unknown) => {
      calls.folders.push({ folder, options: openOptions });
      return { uidValidity: BigInt(options.uidValidity ?? "123"), uidNext: options.uidNext ?? Math.max(0, ...messages.map((entry) => entry.uid)) + 1, readOnly: true };
    },
    search: async (query: { uid?: string; since?: Date | string }, searchOptions: { returnOptions?: unknown }) => {
      calls.searches.push({ query, options: searchOptions });
      const [start, end] = query.uid!.split(":").map(Number);
      const found = messages.filter((entry) => entry.uid >= start && entry.uid <= end).map((entry) => entry.uid);
      return searchOptions.returnOptions ? { min: found.length ? Math.min(...found) : undefined } : found;
    },
    fetchOne: async (uid: number, query: unknown, fetchOptions: unknown) => {
      calls.fetches.push({ uid, query, options: fetchOptions });
      return messages.find((entry) => entry.uid === uid) ?? false;
    },
    download: async (uid: number | string, part: string | undefined, downloadOptions: { maxBytes: number }) => {
      calls.downloads.push({ uid, part, options: downloadOptions });
      const content = responses.get(`${uid}:${part}`) ?? Buffer.from("%PDF-1.4\n%%EOF");
      return { meta: {}, content: Readable.from([content.subarray(0, downloadOptions.maxBytes)]) };
    },
  };
  const transport = createMailboxTransport((clientOptions) => { calls.options = clientOptions; return client as unknown as MailboxClient; });
  return { client, transport, calls, responses };
}

test("mail transport fixes Gmail TLS settings and opens the mailbox without write access", async () => {
  const mock = fixture([]);
  const result = await mock.transport(input);
  assert.equal(mock.calls.options?.host, "imap.gmail.com");
  assert.equal(mock.calls.options?.port, 993);
  assert.equal(mock.calls.options?.secure, true);
  assert.equal(mock.calls.options?.tls?.rejectUnauthorized, true);
  assert.equal(mock.calls.options?.tls?.minVersion, "TLSv1.2");
  assert.equal(mock.calls.options?.logger, false);
  assert.equal(mock.calls.options?.logRaw, false);
  assert.deepEqual(mock.calls.folders, [{ folder: "INBOX", options: { readOnly: true } }]);
  assert.deepEqual(result, { uidValidity: "123", cursorUid: 0, hasMore: false, messages: [] });
  assert.ok(mock.calls.closed > 0);
});

test("bounded UID searches order messages and stop the cursor before unprocessed messages", async () => {
  const mock = fixture([message(8), message(6), message(7)], { extended: true });
  const result = await mock.transport({ ...input, afterUid: 5, limit: 2 });
  assert.deepEqual(mock.calls.searches[0], { query: { uid: "6:8", since: input.importSince }, options: { uid: true, returnOptions: ["MIN"] } });
  assert.deepEqual(result.messages.map((entry) => entry.uid), [6, 7]);
  assert.equal(result.cursorUid, 7);
  assert.equal(result.hasMore, true);
  assert.deepEqual(mock.calls.fetches[0], { uid: 6, query: { uid: true, envelope: true, bodyStructure: true, internalDate: true }, options: { uid: true } });
});

test("UIDVALIDITY changes restart from the configured date and fallback scans remain bounded", async () => {
  const changed = fixture([message(3)], { uidValidity: "999" });
  const result = await changed.transport({ ...input, afterUid: 100 });
  assert.equal(changed.calls.searches[0].query.uid, "1:3");
  assert.equal(changed.calls.searches[0].query.since, input.importSince);
  assert.equal(result.uidValidity, "999");
  assert.equal(result.cursorUid, 3);
  const empty = fixture([], { uidNext: 100001 });
  const scanned = await empty.transport(input);
  assert.equal(empty.calls.searches.length, 10);
  for (const search of empty.calls.searches) {
    const [start, end] = search.query.uid!.split(":").map(Number);
    assert.ok(end - start < 500);
    assert.equal(search.query.since, input.importSince);
  }
  assert.equal(scanned.cursorUid, 5000);
  assert.equal(scanned.hasMore, true);
});

test("MIME parts import XML and PDF bytes while skipping unsupported files and HTML", async () => {
  const mock = fixture([message(1, [
    { part: "1", type: "text/html" }, file("2", "../invoice.xml", "application/xml"), file("3", "invoice.pdf"), file("4", "files.zip", "application/zip"),
  ])]);
  const xml = Buffer.from("<NFSe><number>0001</number></NFSe>");
  mock.responses.set("1:2", xml);
  const result = await mock.transport(input);
  assert.equal(result.messages[0].bodyText, "");
  assert.deepEqual(mock.calls.downloads.map((entry) => entry.part), ["2", "3"]);
  assert.deepEqual(result.messages[0].attachments[0].content, xml);
  assert.equal(result.messages[0].attachments[0].fileName, ".._invoice.xml");
  assert.equal(result.messages[0].attachments[0].mediaType, "application/xml");
  assert.ok(result.messages[0].warnings.some((warning) => warning.includes("HTML was not imported")));
  assert.ok(result.messages[0].warnings.some((warning) => warning.includes("files.zip")));
  assert.equal(result.messages[0].from, "Supplier <supplier@example.com>");
});

test("plain text is a bounded preview and does not download the full message", async () => {
  const mock = fixture([message(1, [{ part: "1", type: "text/plain", size: 20000 }])]);
  mock.responses.set("1:1", Buffer.alloc(20000, 97));
  const result = await mock.transport(input);
  assert.equal(result.messages[0].bodyText.length, 16 * 1024);
  assert.ok(result.messages[0].warnings.some((warning) => warning.includes("16 KiB preview")));
  assert.deepEqual(mock.calls.downloads[0], { uid: 1, part: "1", options: { uid: true, maxBytes: 16 * 1024 + 1, chunkSize: 32 * 1024 } });
});

test("attachment limits use actual bytes and never persist an oversized truncated file", async () => {
  const mock = fixture([message(1, [file("1"), file("2")])]);
  mock.responses.set("1:1", Buffer.alloc(2 * 1024 * 1024 + 1, 97));
  const result = await mock.transport(input);
  assert.deepEqual(result.messages[0].attachments.map((attachment) => attachment.partId), ["2"]);
  assert.ok(result.messages[0].warnings.some((warning) => warning.includes("exceeds the 2 MiB")));
  assert.equal(result.cursorUid, 1);
});

test("message attachments stop at ten parts and ten MiB without downloading later parts", async () => {
  const mock = fixture([message(1, Array.from({ length: 12 }, (_, index) => file(String(index + 1))))]);
  for (let index = 1; index <= 12; index += 1) mock.responses.set(`1:${index}`, Buffer.alloc(2 * 1024 * 1024, 97));
  const result = await mock.transport(input);
  assert.equal(result.messages[0].attachments.length, 5);
  assert.equal(mock.calls.downloads.length, 5);
  assert.ok(result.messages[0].warnings.some((warning) => warning.includes("first 10")));
  assert.ok(result.messages[0].warnings.some((warning) => warning.includes("10 MiB limit")));
});

test("batch memory limits stop before another message and keep its UID for the next run", async () => {
  const mock = fixture([message(1, Array.from({ length: 5 }, (_, index) => file(String(index + 1)))), message(2)]);
  for (let index = 1; index <= 5; index += 1) mock.responses.set(`1:${index}`, Buffer.alloc(2 * 1024 * 1024, 97));
  const result = await mock.transport(input);
  assert.equal(result.messages.length, 1);
  assert.equal(result.cursorUid, 1);
  assert.equal(result.hasMore, true);
  assert.equal(mock.calls.fetches.length, 1);
});

test("timeouts only return completed messages and do not advance past an unfinished UID", async () => {
  const mock = fixture([message(1), message(2)]);
  const fetchOne = mock.client.fetchOne;
  mock.client.fetchOne = async (uid, query, options) => uid === 2 ? new Promise<never>(() => undefined) : fetchOne(uid, query, options);
  const result = await mock.transport({ ...input, deadlineMs: 25 });
  assert.deepEqual(result.messages.map((entry) => entry.uid), [1]);
  assert.equal(result.cursorUid, 1);
  assert.equal(result.hasMore, true);
  assert.ok(mock.calls.closed > 0);
});

test("download failures reject the batch so persistence can retry without skipping messages", async () => {
  const mock = fixture([message(1), message(2, [file("1")])]);
  mock.client.download = async () => { throw new Error(`Upstream failure with ${input.password}`); };
  await assert.rejects(mock.transport(input), (error: unknown) => error instanceof MailTransportError && !error.message.includes(input.password));
  assert.ok(mock.calls.closed > 0);
});

test("an interrupted attachment stream cannot be stored as a complete file", async () => {
  const mock = fixture([message(1, [file("1")])]);
  mock.client.download = async () => ({ meta: {}, content: Readable.from((async function* () { yield Buffer.from("partial"); throw new Error("Connection closed"); })()) });
  await assert.rejects(mock.transport(input), MailTransportError);
});

test("an unfinished stream times out without advancing its message cursor", async () => {
  const mock = fixture([message(1), message(2, [file("1")])]);
  const stream = new Readable({ read() {} });
  stream.push(Buffer.from("partial attachment"));
  mock.client.download = async () => ({ meta: {}, content: stream });
  try {
    const result = await mock.transport({ ...input, deadlineMs: 25 });
    assert.deepEqual(result.messages.map((entry) => entry.uid), [1]);
    assert.equal(result.cursorUid, 1);
    assert.equal(result.hasMore, true);
  } finally {
    stream.destroy();
  }
});

test("a timeout before the first completed message rejects instead of consuming its UID", async () => {
  const mock = fixture([message(1)]);
  mock.client.fetchOne = async () => new Promise<never>(() => undefined);
  await assert.rejects(mock.transport({ ...input, deadlineMs: 25 }), MailTransportError);
  assert.ok(mock.calls.closed > 0);
});

test("a caller cannot exceed twenty messages per batch", async () => {
  const mock = fixture(Array.from({ length: 25 }, (_, index) => message(index + 1)));
  const result = await mock.transport({ ...input, limit: 100 });
  assert.equal(result.messages.length, 20);
  assert.equal(result.cursorUid, 20);
  assert.equal(result.hasMore, true);
});

test("only the first ten small attachment parts are downloaded", async () => {
  const mock = fixture([message(1, Array.from({ length: 12 }, (_, index) => file(String(index + 1))))]);
  const result = await mock.transport(input);
  assert.equal(result.messages[0].attachments.length, 10);
  assert.equal(mock.calls.downloads.length, 10);
});

test("plain text respects the charset returned by the download decoder", async () => {
  const mock = fixture([message(1, [{ part: "1", type: "text/plain", parameters: { charset: "iso-8859-1" } }])]);
  mock.client.download = async () => ({ meta: { charset: "utf-8", contentType: "text/plain" }, content: Readable.from([Buffer.from("Locação — São Paulo", "utf8")]) });
  const result = await mock.transport(input);
  assert.equal(result.messages[0].bodyText, "Locação — São Paulo");
});

test("a mailbox that is not read-only is rejected before searching", async () => {
  const mock = fixture([message(1)]);
  const open = mock.client.mailboxOpen;
  mock.client.mailboxOpen = async (folder, options) => ({ ...await open(folder, options), readOnly: false });
  await assert.rejects(mock.transport(input), MailTransportError);
  assert.equal(mock.calls.searches.length, 0);
});

test("unexpected fetch identifiers reject the batch without exposing upstream data", async () => {
  const mock = fixture([message(1)]);
  mock.client.fetchOne = async () => message(2);
  await assert.rejects(mock.transport(input), MailTransportError);
});
