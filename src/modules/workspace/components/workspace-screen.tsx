"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { subscribeToDataChanges } from "@/lib/client-data-events";
import { usePreferences } from "@/modules/settings/components/preferences-provider";
import { retainWorkspaceScreen, workspaceScreenLocation, workspaceScreenNeedsRefresh, type CachedScreen, type ScreenLocation } from "../screen-cache";

type Screen = CachedScreen<ReactNode>;
type ScreensContextValue = {
  screens: Screen[];
  register: (location: ScreenLocation, content: ReactNode) => void;
  release: (key: string) => void;
  navigate: (href: string) => void;
  protect: (keys: string[]) => void;
};

const ScreensContext = createContext<ScreensContextValue | null>(null);
const ScreenContext = createContext<{ key: string; active: boolean } | null>(null);

export function useWorkspaceScreens() {
  const context = useContext(ScreensContext);
  if (!context) throw new Error("Workspace screens provider is required");
  return context;
}

export function useWorkspaceScreenKey() {
  return useContext(ScreenContext)?.key;
}

export function useWorkspaceScreenActive() {
  return useContext(ScreenContext)?.active ?? true;
}

export function WorkspaceScreensProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const location = workspaceScreenLocation(pathname, search);
  const router = useRouter();
  const { preferences } = usePreferences();
  const limit = useRef(preferences.loadedScreenLimit);
  const [screens, setScreens] = useState<Screen[]>([]);
  const screenStore = useRef<Screen[]>([]);
  const protectedKeys = useRef<string[]>([]);
  const visit = useRef(0);
  const scrollPositions = useRef(new Map<string, number>());
  const lastActiveKey = useRef(location.key);
  const currentLocation = useRef(location);
  const refreshingHref = useRef<string | null>(null);
  const releasedKeys = useRef(new Set<string>());

  useLayoutEffect(() => { currentLocation.current = location; });

  const updateScreens = useCallback((update: (previous: Screen[]) => Screen[]) => {
    const next = update(screenStore.current);
    screenStore.current = next;
    setScreens(next);
  }, []);

  const register = useCallback((incoming: ScreenLocation, content: ReactNode) => {
    if (releasedKeys.current.has(incoming.key)) return;
    const previous = screenStore.current.find((screen) => screen.key === incoming.key);
    if (previous && previous.content === content && previous.href === incoming.href) return;
    const selected = workspaceScreenLocation(window.location.pathname, window.location.search);
    updateScreens((entries) => retainWorkspaceScreen(entries, { ...incoming, content, visitedAt: ++visit.current, loadedAt: Date.now(), stale: false }, selected.key, limit.current));
    if (refreshingHref.current === incoming.href) refreshingHref.current = null;
  }, [updateScreens]);

  useEffect(() => {
    limit.current = preferences.loadedScreenLimit;
    const selected = screenStore.current.find((screen) => screen.key === currentLocation.current.key);
    if (selected) updateScreens((entries) => retainWorkspaceScreen(entries, selected, selected.key, limit.current));
  }, [preferences.loadedScreenLimit, updateScreens]);

  const release = useCallback((key: string) => {
    releasedKeys.current.add(key);
    scrollPositions.current.delete(key);
    updateScreens((previous) => previous.filter((screen) => screen.key !== key));
  }, [updateScreens]);

  const protect = useCallback((keys: string[]) => { protectedKeys.current = keys; }, []);

  const refreshIfNeeded = useCallback((target: ScreenLocation, screen?: Screen) => {
    if (screen && (protectedKeys.current.includes(target.key) || !workspaceScreenNeedsRefresh(screen))) return;
    if (refreshingHref.current === target.href) return;
    refreshingHref.current = target.href;
    router.refresh();
  }, [router]);

  const navigate = useCallback((href: string) => {
    const url = new URL(href, window.location.origin);
    const target = workspaceScreenLocation(url.pathname, url.search);
    const screen = screenStore.current.find((entry) => entry.key === target.key && entry.href === target.href);
    releasedKeys.current.delete(target.key);
    scrollPositions.current.set(currentLocation.current.key, window.scrollY);
    if (screen) {
      window.history.pushState(null, "", target.href);
      refreshIfNeeded(target, screen);
    } else {
      router.push(target.href);
      if (target.href === currentLocation.current.href) router.refresh();
    }
  }, [router, refreshIfNeeded]);

  useEffect(() => subscribeToDataChanges(() => {
    updateScreens((previous) => previous.map((screen) => ({ ...screen, stale: true })));
  }), [updateScreens]);

  useEffect(() => {
    const handlePopState = () => {
      const target = workspaceScreenLocation(window.location.pathname, window.location.search);
      releasedKeys.current.delete(target.key);
      const screen = screenStore.current.find((entry) => entry.key === target.key && entry.href === target.href);
      refreshIfNeeded(target, screen);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [refreshIfNeeded]);

  useLayoutEffect(() => {
    const selected = screenStore.current.find((screen) => screen.key === location.key);
    if (selected) updateScreens((previous) => previous.map((screen) => screen.key === location.key ? { ...screen, visitedAt: ++visit.current } : screen));
    if (lastActiveKey.current !== location.key) {
      lastActiveKey.current = location.key;
      window.scrollTo({ top: scrollPositions.current.get(location.key) ?? 0, behavior: "instant" });
    }
  }, [location.key, location.href, updateScreens]);

  useEffect(() => {
    const rememberScroll = () => scrollPositions.current.set(currentLocation.current.key, window.scrollY);
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, []);

  function interceptCachedLink(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin || url.hash) return;
    const target = workspaceScreenLocation(url.pathname, url.search);
    if (!screenStore.current.some((screen) => screen.key === target.key && screen.href === target.href)) {
      releasedKeys.current.delete(target.key);
      return;
    }
    event.preventDefault();
    navigate(target.href);
  }

  return <ScreensContext.Provider value={{ screens, register, release, navigate, protect }}><div className="workspace-screen-host" onClickCapture={interceptCachedLink}>{children}</div></ScreensContext.Provider>;
}

export function WorkspaceScreen({ pathname, search = {}, children }: { pathname: string; search?: Record<string, string | string[] | undefined>; children: ReactNode }) {
  const { register, screens } = useWorkspaceScreens();
  const currentPathname = usePathname();
  const currentSearch = useSearchParams().toString();
  const params = new URLSearchParams();
  Object.entries(search).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
    else if (value !== undefined) params.set(key, value);
  });
  const location = workspaceScreenLocation(pathname, params.toString());
  const currentHref = workspaceScreenLocation(currentPathname, currentSearch).href;
  const registered = screens.some((screen) => screen.key === location.key && screen.href === location.href);
  useLayoutEffect(() => {
    if (location.href === currentHref) register(location, children);
  }, [location.key, location.href, pathname, currentHref, registered, children, register]);
  return null;
}

export function WorkspaceScreenOutlet({ activeKey, children }: { activeKey: string; children: ReactNode }) {
  const { screens } = useWorkspaceScreens();
  const activeScreen = screens.find((screen) => screen.key === activeKey);
  return <>
    <div className="workspace-route-loader" hidden={Boolean(activeScreen)}>{children}</div>
    {screens.map((screen) => <ScreenContext.Provider key={screen.key} value={{ key: screen.key, active: screen.key === activeKey }}>
      <div className="workspace-screen" data-screen-key={screen.key} hidden={screen.key !== activeKey} inert={screen.key !== activeKey}>{screen.content}</div>
    </ScreenContext.Provider>)}
  </>;
}
