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
