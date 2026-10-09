import { cache } from "react";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserPreferences } from "@/modules/settings/server/preferences";

export const getWorkspaceContext = cache(async () => {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const [company, user, preferences] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: actor.companyId }, select: { name: true } }),
    db.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { email: true } }),
    getUserPreferences(actor.userId),
  ]);
  return { actor, company, user, preferences };
});
