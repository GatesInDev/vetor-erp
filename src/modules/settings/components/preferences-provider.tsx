"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/client-api";
import type { UserPreferences } from "../schema";
import { translate } from "../translations";

type PreferencesContextValue = {
  preferences: UserPreferences;
  savePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ initial, children }: { initial: UserPreferences; children: ReactNode }) {
  const [preferences, setPreferences] = useState(initial);
  const queue = useRef(Promise.resolve());

  useEffect(() => { document.documentElement.lang = preferences.locale; }, [preferences.locale]);

  const savePreferences = useCallback((patch: Partial<UserPreferences>) => {
    const request = queue.current.catch(() => {}).then(async () => {
      const result = await apiRequest<{ preferences: UserPreferences }>("/api/settings/preferences", { method: "PATCH", body: patch });
      setPreferences(result.preferences);
    });
    queue.current = request;
    return request;
  }, []);

  return <PreferencesContext.Provider value={{ preferences, savePreferences }}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("Preferences provider is required");
  return context;
}

export function useLocale() {
  const { preferences: { locale, decimalPlaces } } = usePreferences();
  return useMemo(() => ({
    locale,
    decimalPlaces,
    t: (source: string) => translate(locale, source),
    formatNumber: (value: number | string) => new Intl.NumberFormat(locale, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(Number(value)),
    formatMoney: (value: number | string) => new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(Number(value)),
    formatDate: (value: string | Date, options: Intl.DateTimeFormatOptions = {}) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(new Date(value)),
  }), [locale, decimalPlaces]);
}
