import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { authorize, currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.VIEWER]);
    const [accounts, projects, entries] = await Promise.all([
      db.account.findMany({ where: { companyId: actor.companyId }, select: { id: true, code: true, name: true, type: true } }),
      db.project.findMany({ where: { companyId: actor.companyId }, select: { id: true, code: true, name: true } }),
      db.journalEntry.findMany({ where: { companyId: actor.companyId }, select: { debitAccountId: true, creditAccountId: true, projectId: true, amount: true } }),
    ]);
    const zero = new Prisma.Decimal(0);
    const balances = new Map(accounts.map((account) => [account.id, zero]));
    const projectMargins = new Map(projects.map((project) => [project.id, { projectId: project.id, code: project.code, name: project.name, revenue: zero, directCost: zero }]));
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    for (const entry of entries) {
      const amount = entry.amount;
      balances.set(entry.debitAccountId, (balances.get(entry.debitAccountId) ?? zero).plus(amount));
      balances.set(entry.creditAccountId, (balances.get(entry.creditAccountId) ?? zero).minus(amount));
      const margin = entry.projectId ? projectMargins.get(entry.projectId) : undefined;
      if (margin) {
        if (accountById.get(entry.creditAccountId)?.type === "REVENUE") margin.revenue = margin.revenue.plus(amount);
        if (accountById.get(entry.debitAccountId)?.type === "COST") margin.directCost = margin.directCost.plus(amount);
      }
    }
    const lines = accounts.map((account) => ({ code: account.code, name: account.name, type: account.type, balance: (balances.get(account.id) ?? zero).mul(["LIABILITY", "EQUITY", "REVENUE"].includes(account.type) ? -1 : 1) }));
    const total = (type: string) => lines.filter((line) => line.type === type).reduce((sum, line) => sum.plus(line.balance), zero);
    const revenue = total("REVENUE");
    const directCost = total("COST");
    const operatingExpense = total("EXPENSE");
    return NextResponse.json({
      incomeStatement: { revenue: revenue.toFixed(2), directCost: directCost.toFixed(2), grossProfit: revenue.minus(directCost).toFixed(2), operatingExpense: operatingExpense.toFixed(2), netIncome: revenue.minus(directCost).minus(operatingExpense).toFixed(2) },
      balanceSheet: { assets: total("ASSET").toFixed(2), liabilities: total("LIABILITY").toFixed(2), equity: total("EQUITY").toFixed(2), currentEarnings: revenue.minus(directCost).minus(operatingExpense).toFixed(2), accounts: lines.map((line) => ({ ...line, balance: line.balance.toFixed(2) })) },
      projectMargins: [...projectMargins.values()].map((margin) => ({ ...margin, revenue: margin.revenue.toFixed(2), directCost: margin.directCost.toFixed(2), grossProfit: margin.revenue.minus(margin.directCost).toFixed(2) })),
    });
  } catch (error) { return errorResponse(error); }
}
