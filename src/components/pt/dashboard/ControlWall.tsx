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
