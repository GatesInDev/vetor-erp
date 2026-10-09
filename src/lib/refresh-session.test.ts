import assert from "node:assert/strict";
import test from "node:test";
import { rotateStoredSession } from "./refresh-session";

function sessionStore() {
  const session = { id: "session-1", expiresAt: new Date(Date.now() + 60_000), revokedAt: null as Date | null, user: { active: true } };
  let currentHash = "old-hash";
  let replacements = 0;
  return {
    session,
    replacements: () => replacements,
    find: async (hash: string) => hash === currentHash ? session : null,
    replaceHash: async (sessionId: string, previousHash: string, nextHash: string) => {
      if (sessionId !== session.id || previousHash !== currentHash) return false;
      currentHash = nextHash;
      replacements += 1;
      return true;
    },
  };
}

test("rotation invalidates the previous refresh token", async () => {
  const store = sessionStore();
  assert.equal(await rotateStoredSession(store, "old-hash", "new-hash"), store.session);
  assert.equal(await rotateStoredSession(store, "old-hash", "replayed-hash"), null);
  assert.equal(await rotateStoredSession(store, "new-hash", "next-hash"), store.session);
  assert.equal(store.replacements(), 2);
});

test("concurrent refresh attempts have only one successful rotation", async () => {
  const store = sessionStore();
  const results = await Promise.all([rotateStoredSession(store, "old-hash", "first-hash"), rotateStoredSession(store, "old-hash", "second-hash")]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(store.replacements(), 1);
});

test("expired, revoked and inactive sessions cannot rotate", async () => {
  for (const status of ["expired", "revoked", "inactive"]) {
    const store = sessionStore();
    if (status === "expired") store.session.expiresAt = new Date(0);
    if (status === "revoked") store.session.revokedAt = new Date();
    if (status === "inactive") store.session.user.active = false;
    assert.equal(await rotateStoredSession(store, "old-hash", "new-hash"), null);
    assert.equal(store.replacements(), 0);
  }
});
