"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getWorkspaceBreadcrumbs } from "../breadcrumbs";
import { useLocale } from "@/modules/settings/components/preferences-provider";

export function WorkspaceBreadcrumbs() {
  const { t } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const breadcrumbs = getWorkspaceBreadcrumbs(pathname, searchParams.toString());

  return (
    <nav className="workspace-breadcrumbs" aria-label={t("Caminho de navegação")}>
      <ol className="breadcrumb-list">
        {breadcrumbs.map((breadcrumb, index) => (
          <li className="breadcrumb-item" key={breadcrumb.href ?? `current-${pathname}`}>
            {index > 0 && <ChevronRight className="breadcrumb-separator" size={14} aria-hidden="true" focusable="false" />}
            {breadcrumb.href ? (
              <Link className="breadcrumb-link" href={breadcrumb.href}>{t(breadcrumb.label)}</Link>
            ) : (
              <span className="breadcrumb-current" aria-current="page">{t(breadcrumb.label)}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
