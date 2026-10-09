"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/modules/settings/components/preferences-provider";

type PageHeaderProps = { eyebrow?: string; title: string; description: string; actions?: ReactNode };

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  const { t } = useLocale();
  return <header className="module-header">
    <div>{eyebrow && <p className="section-label">{t(eyebrow)}</p>}<h1>{t(title)}</h1><p className="page-description">{t(description)}</p></div>
    {actions && <div className="header-actions">{actions}</div>}
  </header>;
}
