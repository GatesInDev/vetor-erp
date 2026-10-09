"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ChevronRight, LogOut, Orbit, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { navigationForRole } from "../navigation";
import { useLocale } from "@/modules/settings/components/preferences-provider";

type NavigationGroup = ReturnType<typeof navigationForRole>[number];
type DrawerProps = {
  companyName: string; email: string; role: string; roleLabel: string;
  loggingOut: boolean; logoutError: string; onLogout: () => void; onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

function isCurrentLink(href: string, pathname: string, search: string) {
  const [path, query] = href.split("?");
  if (path !== pathname) return false;
  const actual = new URLSearchParams(search);
  if (!query) return !actual.has("tab");
  return [...new URLSearchParams(query)].every(([key, value]) => actual.get(key) === value);
}

function SubmenuLinks({ group, pathname, search, onNavigate }: { group: NavigationGroup; pathname: string; search: string; onNavigate: () => void }) {
  const { t, locale } = useLocale();
  const usesDefaultSection = pathname === group.href && !new URLSearchParams(search).has("tab");
  return <nav aria-label={`${locale === "en-US" ? "Options for" : "Opções de"} ${t(group.label)}`} className="drawer-submenu-links">
    {group.items?.map((item, index) => <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={isCurrentLink(item.href, pathname, search) || (usesDefaultSection && index === 0) ? "page" : undefined} className="drawer-submenu-link"><span>{t(item.label)}</span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}
  </nav>;
}

export function NavigationDrawer({ companyName, email, role, roleLabel, loggingOut, logoutError, onLogout, onClose, triggerRef }: DrawerProps) {
  const { t, locale } = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const navigation = navigationForRole(role);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [position, setPosition] = useState({ left: 324, top: 16 });
  const surface = useRef<HTMLDivElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const submenu = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const groupButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeGroup = navigation.find((group) => group.id === activeId);
  const previousLocation = useRef(`${pathname}?${search}`);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const trigger = triggerRef.current;
    const overflow = document.body.style.overflow;
    const paddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      trigger?.focus();
    };
  }, [triggerRef]);

  useEffect(() => {
    const location = `${pathname}?${search}`;
    if (location !== previousLocation.current) onClose();
    previousLocation.current = location;
  }, [pathname, search, onClose]);

  useLayoutEffect(() => {
    if (!activeId) return;
    if (compact && scrollArea.current) scrollArea.current.scrollTop = 0;
    if (submenu.current) submenu.current.scrollTop = 0;
    const firstLink = submenu.current?.querySelector<HTMLAnchorElement>("a[href]");
    firstLink?.focus({ preventScroll: true });
  }, [activeId, compact]);

  useLayoutEffect(() => {
    if (!activeId || compact) return;
    const updatePosition = () => {
      const anchor = groupButtons.current[activeId]?.getBoundingClientRect();
      const panel = submenu.current?.getBoundingClientRect();
      const sidebar = drawer.current?.getBoundingClientRect();
      if (!anchor || !panel || !sidebar) return;
      setPosition({ left: sidebar.right + 12, top: Math.max(16, Math.min(anchor.top, window.innerHeight - panel.height - 16)) });
    };
    const scrollContainer = scrollArea.current;
    const observer = new ResizeObserver(updatePosition);
    if (submenu.current) observer.observe(submenu.current);
    updatePosition();
    scrollContainer?.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);
    return () => {
      observer.disconnect();
      scrollContainer?.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [activeId, compact]);

  function closeSubmenu() {
    const button = activeId ? groupButtons.current[activeId] : null;
    setActiveId(null);
    requestAnimationFrame(() => button?.focus());
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (activeId) closeSubmenu();
      else onClose();
    }
    if (event.key === "ArrowLeft" && activeId && submenu.current?.contains(event.target as Node)) {
      event.preventDefault();
      closeSubmenu();
    }
    if (event.key !== "Tab") return;
    const focusable = [...surface.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]') ?? []].filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  const submenuContent = activeGroup && <>
    <div className="drawer-submenu-heading"><button type="button" className="icon-button" aria-label={`${locale === "en-US" ? "Back to modules from" : "Voltar aos módulos de"} ${t(activeGroup.label)}`} onClick={closeSubmenu}><ArrowLeft size={19} /></button><div><small>{t("EXPLORAR MÓDULO")}</small><h2 id={`drawer-submenu-title-${activeGroup.id}`}>{t(activeGroup.label)}</h2></div></div>
    <SubmenuLinks group={activeGroup} pathname={pathname} search={search} onNavigate={onClose} />
  </>;

  return <>
    <button type="button" className="drawer-backdrop" tabIndex={-1} aria-label={t("Fechar navegação")} onClick={onClose} />
    <div className="drawer-layer" ref={surface} role="dialog" aria-modal="true" aria-label={t("Navegação do workspace")} id="workspace-navigation" onKeyDown={handleKeys}>
      <aside className="navigation-drawer" ref={drawer}>
        <div className="drawer-header">
          <div className="drawer-heading"><Link href="/" className="wordmark" onClick={onClose} aria-label={`Vetor ERP · ${t("Início")}`}><span className="brand-symbol"><Orbit size={28} strokeWidth={1.4} /></span><span>vetor<span className="wordmark-period">.</span><small>WORKSPACE</small></span></Link><button type="button" className="icon-button" ref={closeButton} onClick={onClose} aria-label={t("Fechar menu")}><X size={20} /></button></div>
          <div className="organization"><div className="organization-avatar">{companyName.slice(0, 1).toUpperCase()}</div><div><small>{t("SUA EMPRESA")}</small><strong title={companyName}>{companyName}</strong></div></div>
        </div>
        <div className="drawer-scroll" ref={scrollArea}>
          <div hidden={compact && Boolean(activeGroup)}><p className="navigation-label">{t("MÓDULOS")}</p><nav className="drawer-module-list" aria-label={t("Módulos da aplicação")}>
            {navigation.map(({ id, href, label, icon: Icon, items }) => {
              const current = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
              return items?.length ? <button key={id} type="button" ref={(element) => { groupButtons.current[id] = element; }} className={`navigation-link drawer-module ${current ? "is-active" : ""}`} aria-expanded={activeId === id} aria-controls={activeId === id ? `drawer-submenu-${id}` : undefined} onClick={() => activeId === id ? closeSubmenu() : setActiveId(id)} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); setActiveId(id); } }}><Icon size={20} strokeWidth={1.65} aria-hidden="true" /><span>{t(label)}</span><ChevronRight className="drawer-chevron" size={17} aria-hidden="true" /></button>
                : <Link key={id} href={href} onClick={onClose} className={`navigation-link drawer-module ${current ? "is-active" : ""}`} aria-current={current ? "page" : undefined}><Icon size={20} strokeWidth={1.65} aria-hidden="true" /><span>{t(label)}</span></Link>;
            })}
          </nav></div>
          {compact && activeGroup && <div className="drawer-nested-submenu" ref={submenu} id={`drawer-submenu-${activeGroup.id}`} aria-labelledby={`drawer-submenu-title-${activeGroup.id}`}>{submenuContent}</div>}
        </div>
        <div className="drawer-footer"><div className="account-block"><div className="account-avatar">{email.slice(0, 2).toUpperCase()}</div><div><strong title={email}>{email.split("@")[0]}</strong><small>{roleLabel}</small></div><button type="button" className="icon-button" title={t("Sair da conta")} aria-label={t("Sair da conta")} onClick={onLogout} disabled={loggingOut}><LogOut size={18} /></button></div>{logoutError && <p className="form-error" role="alert">{logoutError}</p>}</div>
      </aside>
      {!compact && activeGroup && <div className="drawer-flyout" ref={submenu} id={`drawer-submenu-${activeGroup.id}`} aria-labelledby={`drawer-submenu-title-${activeGroup.id}`} style={{ left: position.left, top: position.top }}>{submenuContent}</div>}
    </div>
  </>;
}
