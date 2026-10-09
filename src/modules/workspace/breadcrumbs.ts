import { workspaceNavigation } from "./navigation";
import { workspaceTabTitle } from "./tab-state";

export type WorkspaceBreadcrumb = {
  label: string;
  href?: string;
};

export function getWorkspaceBreadcrumbs(pathname: string, search = ""): WorkspaceBreadcrumb[] {
  const home = workspaceNavigation[0];
  if (pathname === home.href) return [{ label: home.label }];

  const breadcrumbs: WorkspaceBreadcrumb[] = [{ label: home.label, href: home.href }];
  const currentModule = workspaceNavigation.find((module) => module.href !== "/" && (pathname === module.href || pathname.startsWith(`${module.href}/`)));
  if (!currentModule) return [...breadcrumbs, { label: workspaceTabTitle(pathname) }];

  const sections = (currentModule.items ?? []).flatMap((item) => {
    const [path, query] = item.href.split("?");
    const id = new URLSearchParams(query).get("tab");
    return path === currentModule.href && id ? [{ ...item, id }] : [];
  });

  if (pathname === currentModule.href) {
    const requestedSection = new URLSearchParams(search).get("tab");
    const section = sections.find((item) => item.id === requestedSection) ?? sections[0];
    if (!section) return [...breadcrumbs, { label: currentModule.label }];
    return [...breadcrumbs, { label: currentModule.label, href: currentModule.href }, { label: section.label }];
  }

  breadcrumbs.push({ label: currentModule.label, href: currentModule.href });
  const sectionId = pathname.slice(currentModule.href.length + 1).split("/")[0];
  const section = sections.find((item) => item.id === sectionId);
  if (section) breadcrumbs.push({ label: section.label, href: section.href });
  breadcrumbs.push({ label: workspaceTabTitle(pathname) });
  return breadcrumbs;
}
