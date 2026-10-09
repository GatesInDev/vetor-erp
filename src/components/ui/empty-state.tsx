"use client";

import type { ReactNode } from "react";
import { Orbit } from "lucide-react";
import { useLocale } from "@/modules/settings/components/preferences-provider";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  const { t } = useLocale();
  return <div className="empty-state"><span className="empty-orbit"><Orbit size={28} strokeWidth={1.25} /></span><h3>{t(title)}</h3><p>{t(description)}</p>{action}</div>;
}
