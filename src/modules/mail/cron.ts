import { createHash, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/auth";
import type { MailSyncResult } from "./types";

type AutomaticSyncClient = Pick<Prisma.TransactionClient, "mailConnection">;
type SynchronizeCompany = (companyId: string, deadlineMs: number) => Promise<MailSyncResult>;

export function authorizeMailCron(authorization: string | null, secret: string | undefined): void {
  if (!secret || secret.length < 32) throw new HttpError(503, "Email scheduling is not configured");
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(authorization ?? "").digest();
  if (!timingSafeEqual(expected, received)) throw new HttpError(401, "Invalid scheduler authorization");
}

export async function synchronizeAutomaticMailboxes(client: AutomaticSyncClient, synchronize: SynchronizeCompany, clock = Date.now) {
  const startedAt = clock();
  const deadline = startedAt + 220000;
  const connections = await client.mailConnection.findMany({
    where: { enabled: true, autoSync: true, OR: [{ syncUntil: null }, { syncUntil: { lte: new Date(startedAt) } }] },
    select: { companyId: true },
    orderBy: [{ lastSyncAttemptAt: { sort: "asc", nulls: "first" } }, { companyId: "asc" }],
    take: 5,
  });
  let completed = 0;
  let failed = 0;
  let imported = 0;
  let skipped = 0;
  let hasMore = false;
  for (const connection of connections) {
    if (deadline - clock() < 45000) break;
    try {
      const result = await synchronize(connection.companyId, 25000);
      imported += result.imported;
      skipped += result.skipped;
      hasMore ||= result.hasMore;
      completed += 1;
    } catch {
      failed += 1;
    }
  }
  return { completed, failed, imported, skipped, hasMore, deferred: connections.length - completed - failed };
}
