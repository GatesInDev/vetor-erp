import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { SignJWT } from "jose";
import { issueAccessToken, sessionActor, verifyAccessToken, type Actor, type SessionIdentity } from "./access-token";

const originalSecret = process.env.JWT_SECRET;
const testSecret = "isolated-auth-test-secret-with-at-least-32-characters";
const actor: Actor = { userId: "user-1", companyId: "company-1", role: "ADMIN", sessionId: "session-1" };
const now = new Date("2026-01-01T00:00:00.000Z");

before(() => { process.env.JWT_SECRET = testSecret; });
after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

function activeSession(): SessionIdentity {
  return { id: actor.sessionId, userId: actor.userId, revokedAt: null, expiresAt: new Date("2026-01-02T00:00:00.000Z"), user: { id: actor.userId, companyId: actor.companyId, role: "VIEWER", active: true } };
}

test("signed access tokens preserve session and tenant identity", async () => {
  assert.deepEqual(await verifyAccessToken(await issueAccessToken(actor)), actor);
});

test("forged, expired and unbounded tokens are rejected", async () => {
  await assert.rejects(verifyAccessToken("forged.payload.signature"));
  const key = new TextEncoder().encode(testSecret);
  const claims = { companyId: actor.companyId, role: actor.role, sessionId: actor.sessionId };
  const expired = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject(actor.userId).setIssuedAt().setExpirationTime(new Date("2000-01-01T00:00:00Z")).sign(key);
  await assert.rejects(verifyAccessToken(expired));
  const unbounded = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject(actor.userId).setIssuedAt().sign(key);
  await assert.rejects(verifyAccessToken(unbounded));
});

test("authorization uses the current database role instead of the token role", () => {
  assert.deepEqual(sessionActor(actor, activeSession(), now), { ...actor, role: "VIEWER" });
});

test("access is rejected after session revocation, expiry or user deactivation", () => {
  assert.equal(sessionActor(actor, null, now), null);
  const session = activeSession();
  assert.equal(sessionActor(actor, { ...session, revokedAt: now }, now), null);
  assert.equal(sessionActor(actor, { ...session, expiresAt: now }, now), null);
  assert.equal(sessionActor(actor, { ...session, user: { ...session.user, active: false } }, now), null);
});

test("session lookup cannot authorize another user, tenant or session", () => {
  const session = activeSession();
  assert.equal(sessionActor(actor, { ...session, id: "session-2" }, now), null);
  assert.equal(sessionActor(actor, { ...session, userId: "user-2" }, now), null);
  assert.equal(sessionActor(actor, { ...session, user: { ...session.user, id: "user-2" } }, now), null);
  assert.equal(sessionActor(actor, { ...session, user: { ...session.user, companyId: "company-2" } }, now), null);
});
