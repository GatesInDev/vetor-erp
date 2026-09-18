import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { authorize, currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

function clean(value: string): string {
  const normalized = value.replace(/[\t\r\n]/g, " ");
  return /^[=+@-]/.test(normalized) ? `'${normalized}` : normalized;
}

export async function GET() {
  try {
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    const entries = await db.journalEntry.findMany({
      where: { companyId: actor.companyId },
      include: { debitAccount: { select: { code: true } }, creditAccount: { select: { code: true } }, project: { select: { code: true } } },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    const header = "entry_id\tdate\tdebit_account\tcredit_account\tamount_brl\tproject\tdescription";
    const rows = entries.map((entry) => [
      entry.id, entry.occurredAt.toISOString().slice(0, 10), entry.debitAccount.code, entry.creditAccount.code,
      entry.amount.toFixed(2), entry.project?.code ?? "", clean(entry.description),
    ].join("\t"));
    return new NextResponse([header, ...rows].join("\r\n") + "\r\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": "attachment; filename=accounting-ledger.txt", "Cache-Control": "no-store" },
    });
  } catch (error) { return errorResponse(error); }
}
