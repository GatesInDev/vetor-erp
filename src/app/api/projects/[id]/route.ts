import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  active: z.boolean(),
}).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const id = z.uuid().parse((await context.params).id);
    const input = schema.parse(await request.json());
    return await idempotentMutation(request, actor, "project.update", { id, ...input }, async (transaction) => {
      const project = await transaction.project.findFirst({ where: { id, companyId: actor.companyId }, select: { id: true } });
      if (!project) throw new HttpError(404, "Project not found");
      const duplicate = await transaction.project.findFirst({ where: { companyId: actor.companyId, code: input.code, id: { not: id } }, select: { id: true } });
      if (duplicate) throw new HttpError(409, "Project code already exists");
      await transaction.project.update({ where: { id, companyId: actor.companyId }, data: input });
      return { projectId: id };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
