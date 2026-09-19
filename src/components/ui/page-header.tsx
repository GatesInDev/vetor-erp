import type { ReactNode } from "react";

type PageHeaderProps = { eyebrow?: string; title: string; description: string; actions?: ReactNode };

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return <header className="module-header">
    <div>{eyebrow && <p className="section-label">{eyebrow}</p>}<h1>{title}</h1><p className="page-description">{description}</p></div>
    {actions && <div className="header-actions">{actions}</div>}
  </header>;
}
