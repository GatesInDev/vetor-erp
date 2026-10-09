import assert from "node:assert/strict";
import test from "node:test";
import { defaultPreferences, updateUserPreferencesSchema, userPreferencesSchema } from "./schema";

test("default preferences keep the existing display precision and loaded screen limit", () => {
  assert.deepEqual(userPreferencesSchema.parse(defaultPreferences), { theme: "dark", locale: "pt-BR", decimalPlaces: 2, loadedScreenLimit: 8 });
});

test("preference patches accept partial changes without filling unchanged fields", () => {
  assert.deepEqual(updateUserPreferencesSchema.parse({ theme: "light" }), { theme: "light" });
  assert.deepEqual(updateUserPreferencesSchema.parse({ locale: "en-US", decimalPlaces: 0, loadedScreenLimit: 1 }), { locale: "en-US", decimalPlaces: 0, loadedScreenLimit: 1 });
  assert.deepEqual(updateUserPreferencesSchema.parse({ decimalPlaces: 6, loadedScreenLimit: 8 }), { decimalPlaces: 6, loadedScreenLimit: 8 });
});

test("preference patches reject empty requests and identity or unknown fields", () => {
  for (const input of [{}, { theme: undefined }, { theme: "light", userId: "another-user" }, { companyId: "another-company" }, { role: "ADMIN" }, { currency: "USD" }, null, []]) {
    assert.equal(updateUserPreferencesSchema.safeParse(input).success, false);
  }
});

test("display precision and loaded screen limits reject fractions, strings and out of range values", () => {
  for (const decimalPlaces of [-1, 7, 1.5, "2", null, Infinity, NaN]) assert.equal(updateUserPreferencesSchema.safeParse({ decimalPlaces }).success, false);
  for (const loadedScreenLimit of [0, 9, 1.5, "8", null, Infinity, NaN]) assert.equal(updateUserPreferencesSchema.safeParse({ loadedScreenLimit }).success, false);
  assert.equal(updateUserPreferencesSchema.safeParse({ theme: "system" }).success, false);
  assert.equal(updateUserPreferencesSchema.safeParse({ locale: "es-ES" }).success, false);
});
