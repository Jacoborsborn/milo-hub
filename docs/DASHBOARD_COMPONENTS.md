# Dashboard components – full code reference

Redesign reference: all PT dashboard components and the dashboard page with their full source.

- **Route:** `/pt/app`
- **Page:** `src/app/pt/app/page.tsx` (auth + layout; renders `ControlWall`)
- **Dashboard components:** `src/components/pt/dashboard/`
- **Data:** `getPtDashboardSummary()` from `@/lib/services/dashboard` (types: `PtDashboardSummary`, `DashboardClient`, etc.)
- **Shared UI used by dashboard:** `MetricCard`, `ActivityFeed`, `QuickActions`, `EmptyState`, `PrimaryButton` from `@/components/ui`

---

## 1. Dashboard page

**File:** `src/app/pt/app/page.tsx`

```tsx
import { supabaseServer } from "../../../lib/supabase/server";
import { redirect } from "next/navigation";
import ControlWall from "@/components/pt/dashboard/ControlWall";

export default async function Dashboard() {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      redirect("/pt/auth/login");
    }

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">Live overview of clients, plans, and deadlines.</p>
        </header>
        <ControlWall />
      </div>
    );
  } catch (error) {
    if ((error as any)?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p className="text-red-600">
          {error instanceof Error ? error.message : "Missing Supabase configuration. Please set environment variables."}
        </p>
        <p className="mt-4">
          <a href="/pt/auth/login" className="text-neutral-600 underline hover:no-underline">Go to Login</a>
        </p>
      </div>
    );
  }
}
```

---

## 2. ControlWall

**File:** `src/components/pt/dashboard/ControlWall.tsx`  
Main dashboard container: metrics row, priority cards grid, notifications, drafts, Today’s focus, activity feed, quick actions.

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getPtDashboardSummary } from "@/lib/services/dashboard";
import type { PtDashboardSummary, DashboardClient } from "@/lib/services/dashboard";
import MetricCard from "@/components/ui/MetricCard";
import PriorityCardsGrid, { type PriorityCardItem } from "./PriorityCardsGrid";
import TodaysFocusCard from "./TodaysFocusCard";
import ActivityFeed from "@/components/ui/ActivityFeed";
import QuickActions from "@/components/ui/QuickActions";
import EmptyState from "@/components/ui/EmptyState";
import PrimaryButton from "@/components/ui/PrimaryButton";

type PtNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link_path: string | null;
  is_read: boolean;
  created_at: string;
};
import {
  demoDashboardStats,
  demoClientCards,
  type DemoClientCard,
  type DemoDashboardStats,
} from "@/lib/demo/dashboardDemoData";

// Toggle demo mode here. When true: no API calls; UI uses demo data only.
const DEMO_DASHBOARD = false;

function formatTimeSaved(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function DemoMetricsRow({ stats }: { stats: DemoDashboardStats }) {
  const items = [
    { label: "Active clients", value: stats.activeClients, subtext: "Across all programs" },
    { label: "Plans this week", value: stats.plansThisWeek, subtext: "Generated or updated" },
    { label: "Time saved", value: stats.timeSavedLabel, subtext: "Estimated vs manual" },
    { label: "Plans this month", value: stats.plansThisMonth, subtext: "Monthly output" },
  ];
  return (
    <section
      aria-label="Overview metrics"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {items.map(({ label, value, subtext }) => (
        <div
          key={label}
          className="rounded-[18px] border border-neutral-200 bg-white px-5 py-4 shadow-md min-w-0"
        >
          <p className="text-3xl md:text-[2rem] font-semibold tabular-nums text-neutral-900 leading-tight">
            {value}
          </p>
          <p className="text-xs font-medium uppercase tracking-wider mt-1 text-neutral-500/80">
            {label}
          </p>
          <p className="text-[11px] text-neutral-400 mt-1.5">{subtext}</p>
        </div>
      ))}
    </section>
  );
}

/** Map demo cards to shared PriorityCardItem shape (primaryCtaHref = "#" for no-op) */
function demoToPriorityItems(cards: DemoClientCard[]): PriorityCardItem[] {
  return cards.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: c.subtitle,
    status: c.status,
    lastUpdatedLabel: c.lastUpdatedLabel,
    primaryCtaLabel: c.primaryCtaLabel,
    primaryCtaHref: "#",
  }));
}

function getRealCta(
  status: DashboardClient["status"],
  clientId: string,
  latestPlanId: string | null
): { label: string; href: string } {
  if (status === "no_plan") {
    return { label: "Create plan", href: `/pt/app/clients/${clientId}/meals/new` };
  }
  if (status === "due_soon" || status === "overdue") {
    return { label: "Generate next week", href: `/pt/app/generate?client=${clientId}` };
  }
  return {
    label: "View plan",
    href: latestPlanId ? `/pt/app/plans/${latestPlanId}` : `/pt/app/clients/${clientId}`,
  };
}

/** Map real dashboard clients to PriorityCardItem for the shared grid */
function realToPriorityItems(clients: DashboardClient[]): PriorityCardItem[] {
  return clients.map((c) => {
    const cta = getRealCta(c.status, c.id, c.latestPlanId);
    let lastUpdatedLabel = "No plan created yet";
    if (c.latestPlanDate) {
      const dateStr = new Date(c.latestPlanDate).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      if (c.status === "overdue" && c.overdueByDays != null) {
        lastUpdatedLabel = `Overdue by ${c.overdueByDays} day${c.overdueByDays !== 1 ? "s" : ""}`;
      } else if (c.status === "due_soon" && c.dueInDays != null) {
        lastUpdatedLabel = `Plan due in ${c.dueInDays} day${c.dueInDays !== 1 ? "s" : ""}`;
      } else {
        lastUpdatedLabel = `Last plan: ${dateStr}`;
      }
    }
    return {
      id: c.id,
      name: c.name,
      subtitle: "",
      status: c.status,
      lastUpdatedLabel,
      primaryCtaLabel: cta.label,
      primaryCtaHref: cta.href,
    };
  });
}

function DemoView() {
  const demoItems = useMemo(() => demoToPriorityItems(demoClientCards), []);

  return (
    <div className="space-y-6 relative">
      <span
        className="absolute top-0 right-0 text-[10px] font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
        aria-label="Demo mode active"
      >
        Demo mode
      </span>

      <DemoMetricsRow stats={demoDashboardStats} />

      <PriorityCardsGrid items={demoItems} />
    </div>
  );
}

export default function ControlWall() {
  const [summary, setSummary] = useState<PtDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<PtNotification[]>([]);

  useEffect(() => {
    fetch("/api/notifications?unread_only=true&limit=10")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setUnreadNotifications(Array.isArray(data) ? data : []))
      .catch(() => setUnreadNotifications([]));
  }, []);

  useEffect(() => {
    if (DEMO_DASHBOARD) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    getPtDashboardSummary()
      .then((data) => {
        if (mounted) setSummary(data);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (DEMO_DASHBOARD) {
    return <DemoView />;
  }


  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
        {error}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm font-medium underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasClients = (summary?.clients.length ?? 0) > 0;
  const realPriorityItems = useMemo(
    () => realToPriorityItems(summary?.clients ?? []),
    [summary?.clients]
  );

  return (
    <div className="space-y-6">
      {/* Top row: 4 metric cards */}
      <section aria-label="Overview metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          label="Active clients"
          value={loading ? "—" : (summary?.activeClients ?? 0)}
          loading={loading}
          subtext="Across all clients"
        />
        <MetricCard
          label="Plans this week"
          value={loading ? "—" : (summary?.plansThisWeek ?? 0)}
          loading={loading}
          subtext="Last 7 days"
        />
        <MetricCard
          label="Time saved"
          value={loading ? "—" : (summary?.timeSavedLabel ?? (summary ? formatTimeSaved(summary.timeSavedMinutes) : "—"))}
          loading={loading}
          subtext="Estimated vs manual"
        />
        <MetricCard
          label="Plans this month"
          value={loading ? "—" : (summary?.plansThisMonth ?? 0)}
          loading={loading}
          subtext="Month to date"
        />
      </section>

      {/* Full-width empty state when no clients */}
      {!loading && !hasClients && (
        <EmptyState
          title="Your dashboard will light up here"
          description="Add clients and create plans to see priorities, metrics, and activity."
          action={
            <PrimaryButton href="/pt/app/clients/new">Add first client</PrimaryButton>
          }
        />
      )}

      {/* Main content: priorities + activity column */}
      {(loading || hasClients) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {!loading && hasClients && (summary?.overdueCount ?? 0) === 0 && (summary?.dueSoonCount ?? 0) === 0 && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-neutral-600">All caught up</span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0 text-sm">
                  <a
                    href="/pt/app/generate"
                    className="text-neutral-600 hover:text-neutral-900 hover:underline"
                  >
                    Generate plan
                  </a>
                  <a
                    href="/pt/app/clients/new"
                    className="text-neutral-600 hover:text-neutral-900 hover:underline"
                  >
                    Add client
                  </a>
                </div>
              </div>
            )}
            <PriorityCardsGrid items={realPriorityItems} loading={loading} />
          </div>
          <div className="space-y-6">
            {unreadNotifications.length > 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide mb-2">
                  Notifications
                </h3>
                <p className="text-xs text-neutral-500 mb-3">
                  Unread — open to go to the plan.
                </p>
                <ul className="space-y-2">
                  {unreadNotifications.map((n) => (
                    <li key={n.id}>
                      {n.link_path ? (
                        <Link
                          href={n.link_path}
                          className="text-sm font-medium text-neutral-900 hover:underline"
                        >
                          {n.message}
                        </Link>
                      ) : (
                        <span className="text-sm text-neutral-700">{n.message}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(summary?.autoDrafts?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide mb-2">
                  Drafts Ready
                </h3>
                <p className="text-xs text-neutral-500 mb-3">
                  Auto-generated drafts — review before sending.
                </p>
                <ul className="space-y-2">
                  {(summary?.autoDrafts ?? []).slice(0, 5).map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/pt/app/plans/${d.id}`}
                        className="text-sm font-medium text-neutral-900 hover:underline"
                      >
                        {d.planName} · {d.clientName}
                      </Link>
                    </li>
                  ))}
                </ul>
                {(summary?.autoDrafts?.length ?? 0) > 5 && (
                  <Link
                    href="/pt/app/review-plans"
                    className="mt-2 inline-block text-xs font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    View all ({summary?.autoDrafts?.length ?? 0})
                  </Link>
                )}
              </div>
            )}
            <TodaysFocusCard
              overdueCount={summary?.overdueCount ?? 0}
              dueSoonCount={summary?.dueSoonCount ?? 0}
              noPlanCount={summary?.noPlanCount ?? 0}
            />
            <ActivityFeed
              items={
                summary?.recentActivity?.map((a) => ({
                  id: a.planId,
                  label: `Plan delivered to ${a.clientName}`,
                  href: `/pt/app/plans/${a.planId}`,
                  time: new Date(a.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
                })) ?? []
              }
            />
            {(summary?.activeClients ?? 0) <= 3 && <QuickActions />}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 3. PriorityCardsGrid

**File:** `src/components/pt/dashboard/PriorityCardsGrid.tsx`  
Tabbed grid of client priority cards (All / On track / Due soon / Overdue / No plan).

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import PrimaryButton from "@/components/ui/PrimaryButton";

export type PriorityCardStatus = "on_track" | "due_soon" | "overdue" | "no_plan" | "plan_needed";

export type PriorityCardItem = {
  id: string;
  name: string;
  subtitle: string;
  status: PriorityCardStatus;
  lastUpdatedLabel: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
};

type TabKey = "all" | PriorityCardStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "on_track", label: "On track" },
  { key: "due_soon", label: "Due soon" },
  { key: "overdue", label: "Overdue" },
  { key: "no_plan", label: "No plan" },
];

function statusBadgeClass(status: PriorityCardStatus): string {
  switch (status) {
    case "overdue":
      return "bg-red-50 text-red-800 border-red-200";
    case "due_soon":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "plan_needed":
    case "no_plan":
      return "bg-neutral-100 text-neutral-700 border-neutral-300";
    case "on_track":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    default:
      return "bg-neutral-100 text-neutral-600 border-neutral-200";
  }
}

function statusLabel(status: PriorityCardStatus): string {
  switch (status) {
    case "overdue":
      return "Overdue";
    case "due_soon":
      return "Due soon";
    case "plan_needed":
    case "no_plan":
      return "Plan needed";
    case "on_track":
      return "On track";
    default:
      return String(status);
  }
}

function cardBgClass(status: PriorityCardStatus): string {
  if (status === "overdue") return "bg-red-50/70";
  return "bg-white";
}

function buttonClass(item: PriorityCardItem): string {
  if (item.status === "on_track") {
    return "inline-flex items-center justify-center min-h-[36px] px-3 font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm transition-colors shrink-0";
  }
  if (item.status === "plan_needed" || item.status === "no_plan" || item.status === "due_soon" || item.status === "overdue") {
    return "inline-flex items-center justify-center min-h-[36px] px-3 font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm transition-colors shrink-0";
  }
  return "inline-flex items-center justify-center min-h-[36px] px-3 font-medium rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 text-sm transition-colors shrink-0";
}

const EMPTY_BY_TAB: Record<TabKey, { title: string; description: string }> = {
  all: { title: "No clients yet", description: "Add your first client to see priorities here." },
  on_track: { title: "No clients on track", description: "Clients with recent plans show here." },
  due_soon: { title: "Nothing due soon", description: "All caught up." },
  overdue: { title: "No overdue plans", description: "All caught up." },
  no_plan: { title: "All clients have a plan", description: "Everyone has at least one plan." },
  plan_needed: { title: "All clients have a plan", description: "Everyone has at least one plan." },
};

type PriorityCardsGridProps = {
  items: PriorityCardItem[];
  loading?: boolean;
};

function PriorityCard({ item }: { item: PriorityCardItem }) {
  const isDemoNoOp = item.primaryCtaHref === "#";
  return (
    <div
      className={`rounded-xl border border-neutral-100 p-5 min-h-[140px] flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow ${cardBgClass(item.status)}`}
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <p className="text-lg font-semibold text-neutral-900 min-w-0 truncate">{item.name}</p>
        <span
          className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}
        >
          {statusLabel(item.status)}
        </span>
      </div>
      {item.subtitle ? (
        <p className="text-sm text-gray-500 truncate">{item.subtitle}</p>
      ) : (
        <p className="text-sm text-gray-500">&nbsp;</p>
      )}
      <div className="flex items-center justify-between gap-3 mt-auto">
        <p className="text-xs text-gray-400 truncate min-w-0">{item.lastUpdatedLabel}</p>
        {isDemoNoOp ? (
          <a href="#" onClick={(e) => e.preventDefault()} className={buttonClass(item)}>
            {item.primaryCtaLabel}
          </a>
        ) : (
          <Link href={item.primaryCtaHref} className={buttonClass(item)}>
            {item.primaryCtaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function PriorityCardsGrid({ items, loading }: PriorityCardsGridProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const filtered = useMemo(() => {
    if (activeTab === "all") return items;
    if (activeTab === "no_plan") return items.filter((i) => i.status === "no_plan" || i.status === "plan_needed");
    return items.filter((i) => i.status === activeTab);
  }, [items, activeTab]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      on_track: items.filter((i) => i.status === "on_track").length,
      due_soon: items.filter((i) => i.status === "due_soon").length,
      overdue: items.filter((i) => i.status === "overdue").length,
      no_plan: items.filter((i) => i.status === "no_plan" || i.status === "plan_needed").length,
    };
  }, [items]);

  const getCount = (key: TabKey) =>
    key === "all" ? counts.all : key === "no_plan" || key === "plan_needed" ? counts.no_plan : counts[key];

  return (
    <section id="todays-priorities" className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold text-neutral-900">Today&apos;s priorities</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Clients by plan status — act on what matters next.
        </p>
        <div className="flex flex-wrap gap-1 mt-3">
          {TABS.map(({ key, label }) => {
            const count = getCount(key);
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-blue-600 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-5 pb-5">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-neutral-100 bg-white p-5 min-h-[140px] shadow-sm animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={EMPTY_BY_TAB[activeTab === "plan_needed" ? "no_plan" : activeTab].title}
            description={EMPTY_BY_TAB[activeTab === "plan_needed" ? "no_plan" : activeTab].description}
            action={
              activeTab === "all" ? (
                <PrimaryButton href="/pt/app/clients/new">Add first client</PrimaryButton>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((item) => (
              <PriorityCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

---

## 4. NeedsAttention

**File:** `src/components/pt/dashboard/NeedsAttention.tsx`  
Sidebar-style “Needs attention” block with overdue/due soon/no-plan counts and filter + “Create plan” CTA. (Not currently used in ControlWall; available for redesign.)

```tsx
"use client";

import Link from "next/link";

type AttentionItem = {
  id: string;
  label: string;
  count: number;
  filter: "overdue" | "due_soon" | "no_plan" | null;
};

export type AttentionFilterType = "overdue" | "due_soon" | "no_plan" | "issues" | null;

type NeedsAttentionProps = {
  overdueCount: number;
  dueSoonCount: number;
  noPlanCount: number;
  activeFilter: AttentionFilterType;
  onFilter: (filter: AttentionFilterType) => void;
};

export default function NeedsAttention({
  overdueCount,
  dueSoonCount,
  noPlanCount,
  activeFilter,
  onFilter,
}: NeedsAttentionProps) {
  const totalIssues = overdueCount + dueSoonCount + noPlanCount;
  const items: AttentionItem[] = [
    { id: "overdue", label: overdueCount === 1 ? "plan overdue" : "plans overdue", count: overdueCount, filter: "overdue" as const },
    { id: "due_soon", label: dueSoonCount === 1 ? "plan due soon" : "plans due soon", count: dueSoonCount, filter: "due_soon" as const },
    { id: "no_plan", label: noPlanCount === 1 ? "client has no plan" : "clients have no plan", count: noPlanCount, filter: "no_plan" as const },
  ].filter((i) => i.count > 0);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 shadow-sm">
        <div className="flex items-start gap-2">
          <span className="text-amber-600 text-lg leading-none" aria-hidden>⚠</span>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Needs attention</h3>
            <p className="text-xs text-neutral-600 mt-1">Nothing urgent right now.</p>
          </div>
        </div>
      </div>
    );
  }

  const bodyCopy =
    totalIssues === 1 && noPlanCount === 1
      ? "1 client needs a plan"
      : `${totalIssues} clients need attention`;

  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50/80 p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="text-amber-600 text-lg leading-none shrink-0" aria-hidden>⚠</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">Needs attention</h3>
          <p className="text-xs text-neutral-700 mt-0.5">{bodyCopy}</p>
          <ul className="mt-2 space-y-0.5">
            {items.map((item) => {
              const isActive = activeFilter === item.filter;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onFilter(isActive ? null : item.filter)}
                    className={`w-full text-left text-xs rounded-md px-2 py-1 transition-colors ${
                      isActive ? "bg-amber-200/80 text-neutral-900 font-medium" : "text-neutral-600 hover:bg-amber-100/80"
                    }`}
                  >
                    {item.count} {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onFilter(activeFilter === "issues" || activeFilter ? null : "issues")}
              className="w-full rounded-lg border border-amber-400/80 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-amber-100/60"
            >
              {activeFilter === "issues" || activeFilter ? "Show all" : "Show only issues"}
            </button>
            <Link
              href="/pt/app/generate"
              className="w-full text-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Create plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. TodaysFocusCard

**File:** `src/components/pt/dashboard/TodaysFocusCard.tsx`  
Right-column card: “Today’s focus” with overdue/due soon/no-plan counts and link to priorities or “Add client”.

```tsx
"use client";

import Link from "next/link";

type TodaysFocusCardProps = {
  overdueCount: number;
  dueSoonCount: number;
  noPlanCount: number;
};

export default function TodaysFocusCard({
  overdueCount,
  dueSoonCount,
  noPlanCount,
}: TodaysFocusCardProps) {
  const allZero = overdueCount === 0 && dueSoonCount === 0 && noPlanCount === 0;

  return (
    <div className="rounded-xl shadow-sm bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">Today&apos;s focus</h2>
      {allZero ? (
        <>
          <p className="text-sm text-neutral-600 mt-2">
            You&apos;re all caught up. Consider adding a new client or updating templates.
          </p>
          <Link
            href="/pt/app/clients/new"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add client
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-700 mt-2">
            Overdue: {overdueCount} · Due soon: {dueSoonCount} · No plan: {noPlanCount}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Clear the red first. Keep clients feeling supported.
          </p>
          <a
            href="#todays-priorities"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Work through priorities
          </a>
        </>
      )}
    </div>
  );
}
```

---

## 6. ClientWallCard

**File:** `src/components/pt/dashboard/ClientWallCard.tsx`  
Single client card (name, status badge, due line, latest plan date, primary CTA). Used where a compact client list is needed; not currently used in ControlWall.

```tsx
"use client";

import Link from "next/link";
import type { PlanStatus } from "@/lib/services/dashboard";

type ClientWallCardProps = {
  clientId: string;
  name: string;
  status: PlanStatus;
  dueInDays: number | null;
  overdueByDays: number | null;
  latestPlanDate: string | null;
  latestPlanId: string | null;
  skeleton?: boolean;
};

const STATUS_STYLES: Record<PlanStatus, string> = {
  on_track: "bg-emerald-100 text-emerald-800 border-emerald-200",
  due_soon: "bg-amber-100 text-amber-800 border-amber-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  no_plan: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

const STATUS_STRIP: Record<PlanStatus, string> = {
  on_track: "border-l-emerald-500",
  due_soon: "border-l-amber-500",
  overdue: "border-l-red-500",
  no_plan: "border-l-neutral-400",
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  on_track: "On track",
  due_soon: "Due soon",
  overdue: "Overdue",
  no_plan: "Plan needed",
};

function getSecondRow(
  status: PlanStatus,
  dueInDays: number | null,
  overdueByDays: number | null
): string {
  if (status === "no_plan") return "No plan created yet";
  if (status === "overdue" && overdueByDays != null)
    return `Overdue by ${overdueByDays} day${overdueByDays !== 1 ? "s" : ""}`;
  if (status === "due_soon" && dueInDays != null)
    return `Plan due in ${dueInDays} day${dueInDays !== 1 ? "s" : ""}`;
  return "";
}

function getCta(
  status: PlanStatus,
  clientId: string,
  latestPlanId: string | null
): { label: string; href: string } {
  if (status === "no_plan") {
    return { label: "Create plan", href: `/pt/app/clients/${clientId}/meals/new` };
  }
  if (status === "due_soon" || status === "overdue") {
    return { label: "Generate next week", href: `/pt/app/generate?client=${clientId}` };
  }
  return {
    label: "View plan",
    href: latestPlanId ? `/pt/app/plans/${latestPlanId}` : `/pt/app/clients/${clientId}`,
  };
}

export default function ClientWallCard({
  clientId,
  name,
  status,
  dueInDays,
  overdueByDays,
  latestPlanDate,
  latestPlanId,
  skeleton,
}: ClientWallCardProps) {
  const cta = getCta(status, clientId, latestPlanId);
  const statusStyle = STATUS_STYLES[status];
  const stripStyle = STATUS_STRIP[status];
  const statusLabel = STATUS_LABELS[status];
  const secondRow = getSecondRow(status, dueInDays, overdueByDays);

  if (skeleton) {
    return (
      <div className="rounded-lg border border-neutral-200 border-l-4 border-l-neutral-200 bg-white p-3">
        <div className="h-4 w-2/3 rounded bg-neutral-200 animate-pulse" />
        <div className="h-3 w-16 mt-1.5 rounded bg-neutral-100 animate-pulse" />
        <div className="h-3 w-full mt-1.5 rounded bg-neutral-100 animate-pulse" />
        <div className="h-8 w-full mt-2 rounded bg-neutral-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-neutral-200 border-l-4 bg-white p-3 flex flex-col min-h-0 ${stripStyle}`}
    >
      {/* Row 1: Name + Badge */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <h3 className="text-sm font-semibold text-neutral-900 truncate min-w-0">{name}</h3>
        <span
          className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusStyle}`}
        >
          {statusLabel}
        </span>
      </div>
      {/* Row 2: Due line */}
      {secondRow && (
        <p className="text-[11px] text-neutral-600 mt-1 truncate">{secondRow}</p>
      )}
      {/* Row 3: Latest plan date */}
      {latestPlanDate && (
        <p className="text-[10px] text-neutral-400 mt-0.5">
          Latest: {new Date(latestPlanDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}
      {/* Bottom: Primary action */}
      <Link
        href={cta.href}
        className="mt-2 inline-block w-full text-center rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        {cta.label}
      </Link>
    </div>
  );
}
```

---

## 7. StatTile

**File:** `src/components/pt/dashboard/StatTile.tsx`  
Generic stat block: label + value, optional subtext; optional “hero” variant with accent strip and sessions text.

```tsx
"use client";

type StatTileProps = {
  label: string;
  value: string | number | null;
  skeleton?: boolean;
  /** Micro narrative under value (e.g. "Stable this month") */
  subtext?: string;
  /** Hero variant: larger, accent strip + tint */
  hero?: boolean;
  /** Hero-only: helper under number */
  heroHelper?: string;
  /** Hero-only: e.g. "≈ 2 coaching sessions" (45 min/session) */
  heroSessions?: number | null;
};

export default function StatTile({
  label,
  value,
  skeleton,
  subtext,
  hero,
  heroHelper,
  heroSessions,
}: StatTileProps) {
  if (hero) {
    return (
      <div
        className="relative rounded-xl border border-neutral-200 overflow-hidden shadow-sm min-w-0 col-span-2 md:col-span-2"
        style={{ backgroundColor: "rgba(37, 99, 235, 0.08)" }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" aria-hidden />
        <div className="px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700/90 truncate">
            {label}
          </p>
          {skeleton ? (
            <div className="h-10 w-24 mt-1 rounded bg-blue-200/50 animate-pulse" aria-hidden />
          ) : (
            <p className="mt-1 text-2xl md:text-3xl font-bold tabular-nums text-neutral-900 truncate">
              {value ?? "—"}
            </p>
          )}
          {!skeleton && heroHelper && (
            <p className="text-xs text-neutral-500 mt-0.5">{heroHelper}</p>
          )}
          {!skeleton && heroSessions != null && heroSessions > 0 && (
            <p className="text-xs font-medium text-blue-700/90 mt-0.5">≈ {heroSessions} coaching session{heroSessions !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 truncate">
        {label}
      </p>
      {skeleton ? (
        <div className="h-8 w-16 mt-1 rounded bg-neutral-200 animate-pulse" aria-hidden />
      ) : (
        <>
          <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900 truncate">
            {value ?? "—"}
          </p>
          {subtext && <p className="text-[11px] text-neutral-500 mt-0.5">{subtext}</p>}
        </>
      )}
    </div>
  );
}
```

---

## Usage summary

| Component           | Used in ControlWall | Purpose |
|--------------------|----------------------|---------|
| **ControlWall**    | Page                 | Main dashboard layout and data loading |
| **PriorityCardsGrid** | ControlWall       | Tabbed client priority cards |
| **TodaysFocusCard**   | ControlWall       | Sidebar “Today’s focus” summary |
| **NeedsAttention**   | No                  | Optional “Needs attention” block with filters |
| **ClientWallCard**   | No                  | Optional compact client row/card |
| **StatTile**         | No                  | Optional stat block (metrics use `MetricCard` instead) |

Data and types: `@/lib/services/dashboard` (`getPtDashboardSummary`, `PtDashboardSummary`, `DashboardClient`, `PlanStatus`, etc.). Demo data: `@/lib/demo/dashboardDemoData`.
