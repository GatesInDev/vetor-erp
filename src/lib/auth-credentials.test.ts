import assert from "node:assert/strict";
import test from "node:test";
import { isJsonContentType, requiresOriginCheck, selectRequestCredential } from "./auth-credentials";
import { hasSameOrigin } from "./request-origin";

test("authorization takes precedence over cookies even when malformed", () => {
  assert.deepEqual(selectRequestCredential("Bearer header.payload.signature", "cookie-token"), { source: "bearer", token: "header.payload.signature" });
  for (const header of ["", "Basic credential", "Bearer", "Bearer invalid", "Bearer a.b.c, Bearer d.e.f", "Bearer a.b.c extra"]) {
    assert.deepEqual(selectRequestCredential(header, "valid-cookie-token"), { source: "invalid", token: null });
  }
  assert.deepEqual(selectRequestCredential(null, "cookie-token"), { source: "cookie", token: "cookie-token" });
  assert.deepEqual(selectRequestCredential(null), { source: "none", token: null });
});

test("cookie mutations still require the actual request origin", () => {
  assert.equal(requiresOriginCheck(null), true);
  assert.equal(requiresOriginCheck("Basic credential"), true);
  assert.equal(hasSameOrigin({ headers: new Headers({ host: "erp.example.com", origin: "https://evil.example" }), nextUrl: { protocol: "https:" } }), false);
  assert.equal(hasSameOrigin({ headers: new Headers({ host: "erp.example.com" }), nextUrl: { protocol: "https:" } }), false);
});

test("origin exemption selects only the bearer credential and cannot use a cookie fallback", () => {
  const forgedHeader = "Bearer forged.payload.signature";
  assert.equal(requiresOriginCheck(forgedHeader), false);
  assert.deepEqual(selectRequestCredential(forgedHeader, "signed-cookie-token"), { source: "bearer", token: "forged.payload.signature" });
});

test("native authentication only accepts JSON media types", () => {
  for (const type of ["application/json", "application/json; charset=utf-8", "Application/JSON"]) assert.equal(isJsonContentType(type), true);
  for (const type of [null, "text/plain", "application/x-www-form-urlencoded", "multipart/form-data", "application/jsonp"]) assert.equal(isJsonContentType(type), false);
});
