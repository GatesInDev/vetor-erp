import { workspaceTabKey } from "./tab-state";

export const workspaceScreenLimit = 8;
export const workspaceScreenMaxAge = 5 * 60 * 1000;
export type ScreenLocation = { key: string; href: string; pathname: string };
export type CachedScreen<T> = ScreenLocation & { content: T; visitedAt: number; loadedAt: number; stale: boolean };

export function workspaceScreenLocation(pathname: string, search = ""): ScreenLocation {
  const params = new URLSearchParams(search);
  params.sort();
  return { pathname, key: workspaceTabKey(pathname, params.toString()), href: params.size ? `${pathname}?${params}` : pathname };
}

export function retainWorkspaceScreen<T>(screens: CachedScreen<T>[], incoming: CachedScreen<T>, activeKey: string, limit = workspaceScreenLimit): CachedScreen<T>[] {
  const next = [...screens.filter((screen) => screen.key !== incoming.key), incoming];
  while (next.length > Math.max(1, Math.min(workspaceScreenLimit, limit))) {
    const oldest = next.filter((screen) => screen.key !== activeKey).sort((left, right) => left.visitedAt - right.visitedAt)[0];
    next.splice(next.indexOf(oldest), 1);
  }
  return next;
}

export function workspaceScreenNeedsRefresh<T>(screen: CachedScreen<T>, now = Date.now()): boolean {
  return screen.stale || now - screen.loadedAt >= workspaceScreenMaxAge;
}
