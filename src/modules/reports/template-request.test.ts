import assert from "node:assert/strict";
import test from "node:test";
import { readReportTemplateBody } from "./template-request";

test("report template requests parse JSON and reject invalid payloads", async () => {
  assert.deepEqual(await readReportTemplateBody(new Request("http://localhost", { method: "POST", body: '{"name":"Logo"}' })), { name: "Logo" });
  await assert.rejects(readReportTemplateBody(new Request("http://localhost", { method: "POST", body: "invalid" })), SyntaxError);
  await assert.rejects(readReportTemplateBody(new Request("http://localhost", { method: "POST" })), /body is required/);
});

test("report template request limit counts actual UTF-8 bytes without trusting content-length", async () => {
  await assert.rejects(readReportTemplateBody(new Request("http://localhost", { method: "PATCH", headers: { "Content-Length": "1" }, body: JSON.stringify({ name: "á".repeat(1024 * 1024) }) })), /too large/);
  await assert.rejects(readReportTemplateBody(new Request("http://localhost", { method: "POST", headers: { "Content-Length": String(2 * 1024 * 1024 + 1) }, body: "{}" })), /too large/);
});
