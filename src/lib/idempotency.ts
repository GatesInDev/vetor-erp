import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { Actor, HttpError } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";

type Transaction = Prisma.TransactionClient;

export async function idempotentMutation<T extends Prisma.InputJsonValue>(
  request: NextRequest,
  actor: Actor,
  operation: string,
  input: unknown,
  execute: (transaction: Transaction) => Promise<T>,
): Promise<NextResponse> {
  const key = request.headers.get("x-idempotency-key");
  if (!key || key.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(key)) throw new HttpError(400, "Valid X-Idempotency-Key required");
  const requestHash = sha256(JSON.stringify(input));
  const where = { companyId_operation_key: { companyId: actor.companyId, operation, key } };
  const existing = await db.idempotencyKey.findUnique({ where });
  if (existing) return replay(existing.requestHash, requestHash, existing.response, existing.statusCode);

  try {
    const response = await db.$transaction(async (transaction) => {
      const result = await execute(transaction);
      await transaction.idempotencyKey.create({ data: {
        companyId: actor.companyId, operation, key, requestHash, response: result,
        statusCode: 201, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      const stored = await db.idempotencyKey.findUnique({ where });
      if (stored) return replay(stored.requestHash, requestHash, stored.response, stored.statusCode);
      throw new HttpError(409, "Concurrent update; retry with the same key");
    }
    throw error;
  }
}

function replay(storedHash: string, requestHash: string, response: Prisma.JsonValue, statusCode: number): NextResponse {
  if (storedHash !== requestHash) throw new HttpError(409, "Idempotency key reused with different input");
  return NextResponse.json(response, { status: statusCode, headers: { "Idempotent-Replay": "true" } });
}
