"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import GenerateDrawer from "./GenerateDrawer";
import GenerationCenterButton from "@/components/generation/GenerationCenterButton";
import { getBrandLogoUrl, getFallbackLogoUrl } from "@/lib/branding";

type PtNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link_path: string | null;
  is_read: boolean;
  created_at: string;
};

const STORAGE_KEY = "miloSidebarCollapsed";
const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 72;

type NavItem = {
  label: string;
  href: string;
  match?: "exact" | "prefix";
};

const NAV: NavItem[] = [
  // Home hidden from sidebar (still reachable via /)
  { label: "Dashboard", href: "/pt/app", match: "exact" },
  { label: "Clients", href: "/pt/app/clients", match: "prefix" },
  { label: "Programs", href: "/templates", match: "prefix" },
  { label: "Review Plans", href: "/pt/app/review-plans", match: "prefix" },
  { label: "Automation", href: "/pt/app/automation", match: "exact" },
  { label: "Tutorial", href: "/pt/app/tutorial", match: "exact" },
  { label: "Billing", href: "/pt/app/billing", match: "prefix" },
];

function isActive(pathname: string, item: NavItem) {
  const match = item.match ?? "prefix";
  if (match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function titleFromPath(pathname: string) {
  if (pathname === "/pt/app") return "Dashboard";
  if (pathname.startsWith("/pt/app/clients")) return "Clients";
  if (pathname.startsWith("/pt/app/billing")) return "Billing";
  if (pathname.startsWith("/pt/app/plans")) return "Plans";
  if (pathname.startsWith("/pt/app/settings")) return "Settings";
  if (pathname.startsWith("/pt/app/profile")) return "Profile";
  if (pathname.startsWith("/pt/app/review-plans")) return "Review Plans";
  if (pathname.startsWith("/pt/app/automation")) return "Automation";
  if (pathname.startsWith("/pt/app/tutorial")) return "Tutorial";
  if (pathname.startsWith("/pt/app/terms")) return "Terms & Conditions";
  if (pathname.startsWith("/pt/app/privacy")) return "Privacy Policy";
  if (pathname.startsWith("/templates")) return "Programs";
  return "Milo Hub";
}

function PrimaryAction({
  pathname,
  searchParams,
}: {
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  if (pathname.startsWith("/pt/app/clients")) {
    return (
      <Link
        href="/pt/app/clients/new"
        className="rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        New Client
      </Link>
    );
  }
  if (pathname.startsWith("/templates")) {
    const tab = searchParams.get("tab") === "meals" ? "meals" : "workouts";
    return (
      <Link
        href={`/templates?create=1&tab=${tab}`}
        className="rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        New Program
      </Link>
    );
  }
  if (pathname === "/pt/app") {
    return (
      <Link
        href="/pt/app/generate"
        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Create plan
      </Link>
    );
  }
  return null;
}

type BillingProfile = { brand_logo_url?: string | null; subscription_tier?: string | null } | null;

const NavIcon = ({ label }: { label: string }) => {
  const iconClass = "w-5 h-5 shrink-0";
  switch (label) {
    case "Home":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case "Dashboard":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
    case "Clients":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "Programs":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case "Billing":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    case "Review Plans":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      );
    case "Automation":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "Tutorial":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    default:
      return <span className="w-5 h-5 shrink-0 flex items-center justify-center text-xs font-bold">?</span>;
  }
};

export default function PtShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/pt/app";
  const searchParams = useSearchParams();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [profile, setProfile] = useState<BillingProfile>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [notifications, setNotifications] = useState<PtNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const title = useMemo(() => titleFromPath(pathname), [pathname]);
  const logoUrl = logoError ? getFallbackLogoUrl() : getBrandLogoUrl(profile);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      setSidebarCollapsed(raw === "true");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const check = () => setIsDesktop(typeof window !== "undefined" && window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    fetch("/api/billing/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (pathname === "/pt/app/generate") setGenerateOpen(true);
  }, [pathname]);

  const fetchUnreadCount = useCallback(() => {
    fetch("/api/notifications/count")
      .then((res) => (res.ok ? res.json() : { unread: 0 }))
      .then((data) => setUnreadCount(data.unread ?? 0))
      .catch(() => setUnreadCount(0));
  }, []);

  const fetchNotifications = useCallback(() => {
    fetch("/api/notifications?limit=10")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => setNotifications([]));
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (notificationsOpen) fetchNotifications();
  }, [notificationsOpen, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [notificationsOpen]);

  const markAsRead = useCallback(
    (id: string) => {
      fetch(`/api/notifications/${id}`, { method: "PATCH" })
        .then(() => {
          setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
          setUnreadCount((c) => Math.max(0, c - 1));
        })
        .catch(() => {});
    },
    []
  );

  const markAllRead = useCallback(() => {
    fetch("/api/notifications/mark-all-read", { method: "POST" })
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "g" && e.target !== null) {
        const t = e.target as HTMLElement;
        const inInput = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
        if (!inInput) {
          e.preventDefault();
          setGenerateOpen((open) => !open);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
  const mainMarginLeft = isDesktop ? sidebarWidth : 0;

  const navContent = (collapsed: boolean) => (
    <>
      {/* Single brand row: logo + one "Milo Hub" label only (no "Milo PT Hub", no duplicate) */}
      <div className={`flex items-center min-w-0 shrink-0 px-6 py-6 ${collapsed ? "justify-center" : "gap-3"}`}>
        <Link href="/pt/app" className="flex items-center gap-3 min-w-0 shrink-0" title={collapsed ? "Milo Hub" : undefined}>
          <img
            key={logoUrl}
            src={logoUrl}
            alt="Milo Hub"
            className="h-8 w-8 shrink-0 rounded-full object-cover"
            onError={() => setLogoError(true)}
          />
          {!collapsed && !logoError && (
            <span
              className="text-[18px] font-semibold tracking-[-0.01em] shrink-0 truncate"
              style={{ color: "#111" }}
            >
              Milo Hub
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={[
                  "flex items-center py-3 text-[15px] font-medium transition-colors border-l-[3px]",
                  "leading-[1.4]",
                  collapsed ? "justify-center px-2" : "px-6 gap-3",
                  active
                    ? "border-l-[#2c2c2c] bg-[rgba(0,0,0,0.04)] text-neutral-900 font-semibold"
                    : "border-transparent text-neutral-700 hover:bg-[rgba(0,0,0,0.02)]",
                ].join(" ")}
              >
                <span className={`flex items-center gap-3 min-w-0 ${active ? "opacity-100" : "opacity-75"}`}>
                  <NavIcon label={item.label} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-4">
          {!collapsed && (
            <div className="px-6 text-[12px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "#777" }}>
              Quick Actions
            </div>
          )}
          <div className="space-y-0.5">
            <Link
              href="/pt/app/clients/new"
              title={collapsed ? "New Client" : undefined}
              className={`flex items-center py-3 text-[15px] font-medium text-neutral-700 hover:bg-[rgba(0,0,0,0.04)] transition-colors ${collapsed ? "justify-center px-2" : "px-6 gap-3"}`}
            >
              <svg className="w-5 h-5 shrink-0 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              {!collapsed && <span className="truncate">+ New Client</span>}
            </Link>
            <Link
              href="/templates?create=1"
              title={collapsed ? "New Program" : undefined}
              className={`flex items-center py-3 text-[15px] font-medium text-neutral-700 hover:bg-[rgba(0,0,0,0.04)] transition-colors ${collapsed ? "justify-center px-2" : "px-6 gap-3"}`}
            >
              <svg className="w-5 h-5 shrink-0 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!collapsed && <span className="truncate">+ New Program</span>}
            </Link>
          </div>
        </div>
      </nav>

      <div className="mt-auto border-t border-neutral-200 pt-4 pb-2">
        <div className={`space-y-0.5 ${collapsed ? "px-2 flex flex-col items-center" : "px-6"}`}>
          <Link
            href="/pt/app/terms"
            className="block py-2 text-[13px] text-neutral-500 hover:text-neutral-700 transition-colors truncate"
          >
            {collapsed ? "Terms" : "Terms & Conditions"}
          </Link>
          <Link
            href="/pt/app/privacy"
            className="block py-2 text-[13px] text-neutral-500 hover:text-neutral-700 transition-colors truncate"
          >
            {collapsed ? "Privacy" : "Privacy Policy"}
          </Link>
        </div>
        <div className={`border-t border-neutral-200 py-2 ${collapsed ? "px-2 flex justify-center" : "px-6"}`}>
          <button
            type="button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className="w-5 h-5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
              style={{ transform: sidebarCollapsed ? "rotate(180deg)" : undefined }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Desktop sidebar: fixed, collapsible width */}
      <aside
        className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:flex-col md:border-r md:border-black/10 md:bg-white md:transition-[width] md:duration-200 md:ease-out z-20"
        style={{ width: sidebarWidth }}
      >
        {navContent(sidebarCollapsed)}
      </aside>

      {/* Mobile: overlay when drawer open */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile: slide-over drawer */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-[240px] max-w-[85vw] flex flex-col border-r border-black/10 bg-white transform transition-transform duration-200 ease-out md:hidden",
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {navContent(false)}
      </aside>

      {/* Main area: margin-left = sidebar width on desktop; 0 on mobile */}
      <div
        className="min-h-screen transition-[margin-left] duration-200 ease-out"
        style={{ marginLeft: mainMarginLeft }}
      >
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen((o) => !o)}
                className="md:hidden rounded-lg p-2 text-neutral-600 hover:bg-neutral-100"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-neutral-900">{title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PrimaryAction pathname={pathname} searchParams={searchParams} />
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((o) => !o)}
                  className="relative rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                  aria-label="Notifications"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 w-[320px] rounded-lg border border-neutral-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
                      <span className="text-sm font-semibold text-neutral-900">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-[320px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-neutral-500">No notifications</div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`border-b border-neutral-100 px-3 py-2 last:border-0 ${!n.is_read ? "bg-neutral-50/80" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                {n.link_path ? (
                                  <Link
                                    href={n.link_path}
                                    onClick={() => {
                                      if (!n.is_read) markAsRead(n.id);
                                      setNotificationsOpen(false);
                                    }}
                                    className="block"
                                  >
                                    <span className="text-sm font-medium text-neutral-900">{n.title}</span>
                                    <p className="mt-0.5 truncate text-xs text-neutral-600">{n.message}</p>
                                  </Link>
                                ) : (
                                  <>
                                    <span className="text-sm font-medium text-neutral-900">{n.title}</span>
                                    <p className="mt-0.5 truncate text-xs text-neutral-600">{n.message}</p>
                                  </>
                                )}
                              </div>
                              {!n.is_read && (
                                <button
                                  type="button"
                                  onClick={() => markAsRead(n.id)}
                                  className="shrink-0 text-xs text-neutral-500 hover:text-neutral-700"
                                  title="Mark as read"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Link
                href="/pt/app/profile"
                className="rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                aria-label="Profile"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-4 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/10 bg-white md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileDrawerOpen(false)}
                className={[
                  "flex flex-col items-center justify-center gap-1 px-2 py-3 text-xs font-medium",
                  active ? "text-black" : "text-neutral-500",
                ].join(" ")}
              >
                <span className={["h-1 w-10 rounded-full", active ? "bg-black" : "bg-transparent"].join(" ")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <GenerateDrawer
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        initialClientId={searchParams.get("client") ?? undefined}
      />
      <GenerationCenterButton />
    </div>
  );
}
