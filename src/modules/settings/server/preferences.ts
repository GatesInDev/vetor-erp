import "server-only";

import { db } from "@/lib/db";
import { defaultPreferences, updateUserPreferencesSchema, userPreferencesSchema, type UserPreferences, type UserPreferencesInput } from "@/modules/settings/schema";

const preferencesSelection = { theme: true, locale: true, decimalPlaces: true, loadedScreenLimit: true } as const;

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const preferences = await db.userPreference.findUnique({ where: { userId }, select: preferencesSelection });
  return preferences ? userPreferencesSchema.parse(preferences) : { ...defaultPreferences };
}

export async function updateUserPreferences(userId: string, input: UserPreferencesInput): Promise<UserPreferences> {
  const changes = updateUserPreferencesSchema.parse(input);
  const preferences = await db.userPreference.upsert({
    where: { userId },
    create: { userId, ...defaultPreferences, ...changes },
    update: changes,
    select: preferencesSelection,
  });
  return userPreferencesSchema.parse(preferences);
}
