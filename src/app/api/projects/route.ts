import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { authorize, currentActor, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkOrigin, errorResponse } from "@/lib/http";
import { idempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(200),
  active: z.boolean().default(true),
}).strict();

export async function GET() {
  try {
    const actor = authorize(await currentActor(), Object.values(Role));
    const projects = await db.project.findMany({
      where: { companyId: actor.companyId },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, active: true },
    });
    return NextResponse.json({ projects });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = authorize(await currentActor(), [Role.ADMIN, Role.ACCOUNTANT, Role.FINANCE, Role.OPERATIONS]);
    const input = schema.parse(await request.json());
    return await idempotentMutation(request, actor, "project.create", input, async (transaction) => {
      const existing = await transaction.project.findFirst({ where: { companyId: actor.companyId, code: input.code }, select: { id: true } });
      if (existing) throw new HttpError(409, "Project code already exists");
      const project = await transaction.project.create({ data: { companyId: actor.companyId, ...input } });
      return { projectId: project.id };
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return errorResponse(error);
  }
}
