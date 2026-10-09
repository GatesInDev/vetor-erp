import { z } from "zod";

export const userPreferencesSchema = z.object({
  theme: z.enum(["light", "dark"]),
  locale: z.enum(["pt-BR", "en-US"]),
  decimalPlaces: z.number().int().min(0).max(6),
  loadedScreenLimit: z.number().int().min(1).max(8),
}).strict();

export const updateUserPreferencesSchema = userPreferencesSchema.partial().refine(
  (input) => Object.values(input).some((value) => value !== undefined),
  { message: "At least one preference is required" },
);

export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;

export const defaultPreferences: UserPreferences = {
  theme: "dark",
  locale: "pt-BR",
  decimalPlaces: 2,
  loadedScreenLimit: 8,
};
