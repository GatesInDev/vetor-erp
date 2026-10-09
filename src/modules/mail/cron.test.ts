import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/auth";
import { authorizeMailCron, synchronizeAutomaticMailboxes } from "./cron";

test("mail scheduler requires the exact bearer secret and rejects unconfigured credentials", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  assert.doesNotThrow(() => authorizeMailCron(`Bearer ${secret}`, secret));
  for (const authorization of [null, secret, `bearer ${secret}`, `Bearer ${secret}x`, `Bearer ${secret.slice(1)}`]) {
    assert.throws(() => authorizeMailCron(authorization, secret), (error) => error instanceof HttpError && error.status === 401);
  }
  for (const configured of [undefined, "", "short"]) assert.throws(() => authorizeMailCron(null, configured), (error) => error instanceof HttpError && error.status === 503);
});

test("automatic mail sync is serial, bounded and fair across enabled tenants, with isolated failures", async () => {
  const calls: string[] = [];
  let active = 0;
  const client = { mailConnection: { findMany: async (args: Prisma.MailConnectionFindManyArgs) => {
    assert.equal(args.take, 5);
    assert.equal(args.where?.enabled, true);
    assert.equal(args.where?.autoSync, true);
    assert.deepEqual(args.orderBy, [{ lastSyncAttemptAt: { sort: "asc", nulls: "first" } }, { companyId: "asc" }]);
    assert.deepEqual(args.select, { companyId: true });
    return ["company-a", "company-b", "company-c"].map((companyId) => ({ companyId }));
  } } } as unknown as Prisma.TransactionClient;
  const result = await synchronizeAutomaticMailboxes(client, async (companyId, deadlineMs) => {
    active += 1;
    assert.equal(active, 1);
    assert.equal(deadlineMs, 25000);
    calls.push(companyId);
    await Promise.resolve();
    active -= 1;
    if (companyId === "company-b") throw new Error("Private provider error");
    return { imported: 2, skipped: 1, hasMore: companyId === "company-c" };
  });
  assert.deepEqual(calls, ["company-a", "company-b", "company-c"]);
  assert.deepEqual(result, { completed: 2, failed: 1, imported: 4, skipped: 2, hasMore: true, deferred: 0 });
});

test("automatic mail sync reserves transaction time and stops taking work before its deadline", async () => {
  let time = 0;
  const client = { mailConnection: { findMany: async () => ["a", "b", "c", "d", "e"].map((companyId) => ({ companyId })) } } as unknown as Prisma.TransactionClient;
  const result = await synchronizeAutomaticMailboxes(client, async () => {
    time += 60000;
    return { imported: 0, skipped: 0, hasMore: false };
  }, () => time);
  assert.equal(result.completed, 3);
  assert.equal(result.deferred, 2);
});
