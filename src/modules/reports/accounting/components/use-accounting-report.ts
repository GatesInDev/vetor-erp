"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { subscribeToDataChanges } from "@/lib/client-data-events";

export function useAccountingReport<T>(endpoint: string) {
  const [report, setReport] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [outdated, setOutdated] = useState(false);
  const request = useRef<AbortController | null>(null);
  const dataVersion = useRef(0);

  useEffect(() => subscribeToDataChanges(() => {
    dataVersion.current += 1;
    setOutdated(true);
  }), []);

  useEffect(() => () => request.current?.abort(), []);

  const generate = useCallback(async (filters: Record<string, string>) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = dataVersion.current;
    setLoading(true);
    setReport(null);
    setError("");
    try {
      const result = await apiRequest<T>(`${endpoint}?${new URLSearchParams(filters)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setReport(result);
      setOutdated(version !== dataVersion.current);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Não foi possível gerar o demonstrativo. Tente novamente.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [endpoint]);

  return { report, loading, error, outdated, generate };
}
