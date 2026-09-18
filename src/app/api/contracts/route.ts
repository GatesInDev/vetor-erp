import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { money, nonnegativeMoney } from "@/lib/finance";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

const schema = z.object({
  number: z.string().min(1).max(60), description: z.string().min(1).max(500),
  contractorId: z.uuid(), projectId: z.uuid(), amount: z.string(),
  issAmount: z.string().default("0"), inssAmount: z.string().default("0"),
});

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const input = schema.parse(await request.json());
    const amount = money(input.amount);
    const iss = nonnegativeMoney(input.issAmount);
    const inss = nonnegativeMoney(input.inssAmount);
    if (iss.plus(inss).gte(amount)) throw new HttpError(400, "Invalid withholding amounts");
    return await idempotentMutation(request, actor, "contract.create", input, async (transaction) => {
      const [project, contractor] = await Promise.all([
        transaction.project.findFirst({ where: { id: input.projectId, companyId: actor.companyId, active: true } }),
        transaction.partner.findFirst({ where: { id: input.contractorId, companyId: actor.companyId, supplier: true } }),
      ]);
      if (!project || !contractor) throw new HttpError(422, "Project or contractor not found");
      const contract = await transaction.laborContract.create({ data: {
        companyId: actor.companyId, projectId: project.id, contractorId: contractor.id,
        number: input.number, description: input.description, amount,
        issWithheld: iss.gt(0), inssWithheld: inss.gt(0), issAmount: iss, inssAmount: inss,
      } });
      return { contractId: contract.id };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
