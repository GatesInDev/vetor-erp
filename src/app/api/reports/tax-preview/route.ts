import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { authorize, currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.VIEWER]);
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const windowStart = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 12, 1));
    const [services, goods, brackets] = await Promise.all([
      db.serviceInvoice.findMany({ where: { companyId: actor.companyId, serviceDate: { gte: windowStart, lt: periodStart }, status: { not: "CANCELLED" } }, select: { amount: true } }),
      db.goodsSale.findMany({ where: { companyId: actor.companyId, soldAt: { gte: windowStart, lt: periodStart }, cancelled: false }, select: { amount: true } }),
      db.taxBracket.findMany({ where: { companyId: actor.companyId, effectiveFrom: { lte: periodStart }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: periodStart } }] }, orderBy: { lowerLimit: "asc" } }),
    ]);
    const zero = new Prisma.Decimal(0);
    const rbt12 = [...services, ...goods].reduce((sum, item) => sum.plus(item.amount), zero);
    const annexes = ["III", "IV"].map((annex) => {
      const bracket = brackets.find((item) => item.annex === annex && rbt12.gte(item.lowerLimit) && rbt12.lte(item.upperLimit));
      if (!bracket || rbt12.isZero()) return { annex, effectiveRate: null, reason: "No applicable configured bracket or zero RBT12" };
      const rate = rbt12.mul(bracket.nominalRate).minus(bracket.deduction).div(rbt12);
      return { annex, effectiveRate: rate.toFixed(6), reason: "Preliminary rate based on configured bracket" };
    });
    return NextResponse.json({ periodStart: periodStart.toISOString(), windowStart: windowStart.toISOString(), rbt12: rbt12.toFixed(2), annexes, advisory: "Estimate only; verify revenue segregation, withholding, exclusions and PGDAS-D with the accountant" });
  } catch (error) { return errorResponse(error); }
}
