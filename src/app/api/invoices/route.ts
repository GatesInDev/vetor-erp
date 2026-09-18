import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { accountCodes, money, nonnegativeMoney, postEntry } from "@/lib/finance";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

const schema = z.object({
  number: z.string().min(1).max(60), customerId: z.uuid(), projectId: z.uuid(),
  amount: z.string(), issAmount: z.string().default("0"), inssAmount: z.string().default("0"),
  serviceDate: z.iso.datetime(), dueAt: z.iso.datetime(), taxAnnex: z.enum(["III", "IV"]),
});

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    const input = schema.parse(await request.json());
    const amount = money(input.amount);
    const iss = nonnegativeMoney(input.issAmount);
    const inss = nonnegativeMoney(input.inssAmount);
    if (iss.plus(inss).gte(amount)) throw new HttpError(400, "Invalid withholding amounts");
    return await idempotentMutation(request, actor, "invoice.create", input, async (transaction) => {
      const [project, customer] = await Promise.all([
        transaction.project.findFirst({ where: { id: input.projectId, companyId: actor.companyId, active: true } }),
        transaction.partner.findFirst({ where: { id: input.customerId, companyId: actor.companyId, customer: true } }),
      ]);
      if (!project || !customer) throw new HttpError(422, "Project or customer not found");
      const invoice = await transaction.serviceInvoice.create({ data: {
        companyId: actor.companyId, number: input.number, customerId: customer.id, projectId: project.id,
        amount, issAmount: iss, inssAmount: inss, issWithheld: iss.gt(0), inssWithheld: inss.gt(0),
        serviceDate: new Date(input.serviceDate), taxAnnex: input.taxAnnex,
      } });
      const net = amount.minus(iss).minus(inss);
      await transaction.receivable.create({ data: {
        companyId: actor.companyId, invoiceId: invoice.id, customerId: customer.id, projectId: project.id,
        amount: net, dueAt: new Date(input.dueAt),
      } });
      const base = { companyId: actor.companyId, projectId: project.id, creditCode: accountCodes.serviceRevenue,
        source: "INVOICE" as const, sourceId: invoice.id, occurredAt: new Date(input.serviceDate), createdById: actor.userId };
      await postEntry(transaction, { ...base, debitCode: accountCodes.receivable, amount: net, description: `Invoice ${invoice.number} receivable` });
      if (iss.gt(0)) await postEntry(transaction, { ...base, debitCode: accountCodes.issRetention, amount: iss, description: `Invoice ${invoice.number} ISS withheld` });
      if (inss.gt(0)) await postEntry(transaction, { ...base, debitCode: accountCodes.inssRetention, amount: inss, description: `Invoice ${invoice.number} INSS withheld` });
      return { invoiceId: invoice.id, receivable: net.toFixed(2), total: amount.toFixed(2) };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
