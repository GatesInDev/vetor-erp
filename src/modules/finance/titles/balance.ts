import { Prisma } from "@prisma/client";
import type { FinancialTitleStatus } from "./types";

export function titleBalance(amount: Prisma.Decimal, settled: Prisma.Decimal, cancelled: boolean): {
  amount: string;
  settledAmount: string;
  remaining: string;
  status: FinancialTitleStatus;
} {
  const remaining = Prisma.Decimal.max(amount.minus(settled), 0);
  const status: FinancialTitleStatus = cancelled ? "CANCELLED" : remaining.isZero() ? "SETTLED" : settled.gt(0) ? "PARTIAL" : "OPEN";
  return { amount: amount.toFixed(2), settledAmount: settled.toFixed(2), remaining: cancelled ? "0.00" : remaining.toFixed(2), status };
}
