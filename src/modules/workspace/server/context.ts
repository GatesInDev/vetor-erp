import { cache } from "react";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { db } from "@/lib/db";

export const getWorkspaceContext = cache(async () => {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const [company, user] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: actor.companyId }, select: { name: true } }),
    db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { email: true } }),
  ]);
  return { actor, company, user };
});
