import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { money } from "@/lib/finance";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

const schema = z.object({ amount: z.string(), measuredAt: z.iso.datetime() });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.OPERATIONS, Role.ACCOUNTANT]);
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const amount = money(input.amount);
    return await idempotentMutation(request, actor, "measurement.create", { id, ...input }, async (transaction) => {
      const contract = await transaction.laborContract.findFirst({ where: { id, companyId: actor.companyId }, include: { measurements: { select: { amount: true } } } });
      if (!contract) throw new HttpError(404, "Contract not found");
      const measured = contract.measurements.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
      if (measured.plus(amount).gt(contract.amount)) throw new HttpError(422, "Measurements exceed contract amount");
      const measurement = await transaction.measurement.create({ data: { contractId: contract.id, amount, measuredAt: new Date(input.measuredAt) } });
      return { measurementId: measurement.id };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
