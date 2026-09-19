import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), ["ADMIN", "ACCOUNTANT", "FINANCE"]);
    const { id } = await context.params;
    const input = z.object({ completed: z.boolean() }).parse(await request.json());
    return await idempotentMutation(request, actor, "monthly-task.update", { id, ...input }, async (transaction) => {
      const result = await transaction.monthlyTask.updateMany({ where: { id, companyId: actor.companyId }, data: { completedAt: input.completed ? new Date() : null } });
      if (!result.count) throw new HttpError(404, "Task not found");
      return { id, completed: input.completed };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
