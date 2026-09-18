import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { accountCodes, postEntry } from "@/lib/finance";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

const schema = z.object({ dueAt: z.iso.datetime() });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    return await idempotentMutation(request, actor, "measurement.approve", { id, ...input }, async (transaction) => {
      const measurement = await transaction.measurement.findFirst({ where: { id, contract: { companyId: actor.companyId } }, include: { contract: { include: { measurements: { where: { approvedAt: { not: null } }, select: { amount: true, issAmount: true, inssAmount: true } } } } } });
      if (!measurement) throw new HttpError(404, "Measurement not found");
      if (measurement.approvedAt) throw new HttpError(409, "Measurement already approved");
      const contract = measurement.contract;
      const zero = new Prisma.Decimal(0);
      const approved = contract.measurements.reduce((sum, item) => sum.plus(item.amount), zero);
      const priorIss = contract.measurements.reduce((sum, item) => sum.plus(item.issAmount), zero);
      const priorInss = contract.measurements.reduce((sum, item) => sum.plus(item.inssAmount), zero);
      const finalMeasurement = approved.plus(measurement.amount).eq(contract.amount);
      const iss = finalMeasurement ? contract.issAmount.minus(priorIss) : measurement.amount.mul(contract.issAmount).div(contract.amount).toDecimalPlaces(2);
      const inss = finalMeasurement ? contract.inssAmount.minus(priorInss) : measurement.amount.mul(contract.inssAmount).div(contract.amount).toDecimalPlaces(2);
      const net = measurement.amount.minus(iss).minus(inss);
      if (net.lte(0)) throw new HttpError(422, "Invalid measurement withholding");
      const updated = await transaction.measurement.updateMany({ where: { id, approvedAt: null }, data: { approvedAt: new Date(), issAmount: iss, inssAmount: inss } });
      if (updated.count !== 1) throw new HttpError(409, "Measurement already approved");
      const payable = await transaction.payable.create({ data: {
        companyId: actor.companyId, contractId: contract.id, measurementId: id,
        contractorId: contract.contractorId, projectId: contract.projectId, amount: net, dueAt: new Date(input.dueAt),
      } });
      const base = { companyId: actor.companyId, debitCode: accountCodes.laborCost,
        projectId: contract.projectId, source: "MEASUREMENT" as const, sourceId: id, occurredAt: measurement.measuredAt, createdById: actor.userId };
      await postEntry(transaction, { ...base, creditCode: accountCodes.contractorPayable, amount: net, description: `Measurement ${id} payable` });
      if (iss.gt(0)) await postEntry(transaction, { ...base, creditCode: accountCodes.issPayable, amount: iss, description: `Measurement ${id} ISS withheld` });
      if (inss.gt(0)) await postEntry(transaction, { ...base, creditCode: accountCodes.inssPayable, amount: inss, description: `Measurement ${id} INSS withheld` });
      return { payableId: payable.id, amount: net.toFixed(2) };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
