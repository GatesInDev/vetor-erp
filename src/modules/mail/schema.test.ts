import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { HttpError } from "@/lib/auth";
import { mailQuery, readMailSettingsBody, rejectMailOwnerOverrides } from "@/app/api/mail/validation";
import { mailConnectionInputSchema, mailMessageFiltersSchema } from "./schema";

const input = { username: "mailbox@example.com", enabled: true, autoSync: false, importSince: "2026-10-01" };

test("Gmail settings normalize app passwords and accounts while rejecting hosts, owner overrides and invalid dates", () => {
  const parsed = mailConnectionInputSchema.parse({ ...input, username: " Mailbox@EXAMPLE.com ", password: "abcd efgh ijkl mnop" });
  assert.equal(parsed.username, "mailbox@example.com");
  assert.equal(parsed.password, "abcdefghijklmnop");
  assert.equal(parsed.folder, "INBOX");
  for (const changes of [{ host: "localhost" }, { port: 25 }, { companyId: "company-b" }, { importSince: "2026-02-30" }, { password: "regular-password" }, { folder: "INBOX\r\nLOGOUT" }, { revision: 0 }]) {
    assert.equal(mailConnectionInputSchema.safeParse({ ...input, ...changes }).success, false);
  }
});

test("mail filters reject duplicated or tenant-overriding query parameters", () => {
  assert.throws(() => mailQuery(new NextRequest("http://localhost/api/mail/messages?companyId=other")), (error) => error instanceof HttpError && error.status === 403);
  assert.throws(() => mailQuery(new NextRequest("http://localhost/api/mail/messages?search=a&search=b")), (error) => error instanceof HttpError && error.status === 400);
  assert.throws(() => rejectMailOwnerOverrides({ userId: "other" }), (error) => error instanceof HttpError && error.status === 403);
  assert.equal(mailMessageFiltersSchema.safeParse({ status: "PENDING", search: "invoice" }).success, true);
  assert.equal(mailMessageFiltersSchema.safeParse({ cursor: "invalid" }).success, false);
  assert.equal(mailMessageFiltersSchema.safeParse({ skip: "1000000" }).success, false);
});

test("mail settings enforce actual streamed body size even with misleading content length", async () => {
  assert.deepEqual(await readMailSettingsBody(new Request("http://localhost", { method: "PUT", body: JSON.stringify(input) })), input);
  const oversized = new Request("http://localhost", { method: "PUT", body: JSON.stringify({ data: "x".repeat(8200) }), headers: { "content-length": "1" } });
  await assert.rejects(readMailSettingsBody(oversized), (error) => error instanceof HttpError && error.status === 413);
  const multibyte = new Request("http://localhost", { method: "PUT", body: JSON.stringify({ data: "ã".repeat(5000) }) });
  await assert.rejects(readMailSettingsBody(multibyte), (error) => error instanceof HttpError && error.status === 413);
  await assert.rejects(readMailSettingsBody(new Request("http://localhost", { method: "PUT", body: "not-json" })), SyntaxError);
});
