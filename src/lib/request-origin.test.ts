import assert from "node:assert/strict";
import test from "node:test";
import { hasSameOrigin } from "./request-origin";

test("same-origin uses the actual host for localhost, IPv4, IPv6 and deployment domains", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "erp.example.com"]) {
    assert.equal(hasSameOrigin({ headers: new Headers({ host, origin: `http://${host}` }), nextUrl: { protocol: "http:" } }), true);
  }
  assert.equal(hasSameOrigin({ headers: new Headers({ host: "erp.example.com", origin: "https://erp.example.com" }), nextUrl: { protocol: "https:" } }), true);
});

test("same-origin rejects foreign domains, other ports, protocol mismatch and null origins", () => {
  for (const origin of ["https://attacker.example", "https://erp.example.com.attacker.example", "http://erp.example.com", "https://erp.example.com:444", "null", ""]) {
    assert.equal(hasSameOrigin({ headers: new Headers({ host: "erp.example.com", origin }), nextUrl: { protocol: "https:" } }), false);
  }
  assert.equal(hasSameOrigin({ headers: new Headers({ origin: "https://erp.example.com" }), nextUrl: { protocol: "https:" } }), false);
  assert.equal(hasSameOrigin({ headers: new Headers({ host: "erp.example.com" }), nextUrl: { protocol: "https:" } }), false);
});
