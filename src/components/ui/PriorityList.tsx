"use client";

import { useMemo, useState } from "react";
import SectionHeader from "./SectionHeader";
import PriorityRow from "./PriorityRow";
import EmptyState from "./EmptyState";
import PrimaryButton from "./PrimaryButton";
import type { DashboardClient, PlanStatus } from "@/lib/services/dashboard";

type TabKey = "all" | PlanStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "on_track", label: "On track" },
  { key: "due_soon", label: "Due soon" },
  { key: "overdue", label: "Overdue" },
  { key: "no_plan", label: "No plan" },
];

type PriorityListProps = {
  clients: DashboardClient[];
  loading?: boolean;
};

export default function PriorityList({ clients, loading }: PriorityListProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const filtered = useMemo(() => {
    if (activeTab === "all") return clients;
    return clients.filter((c) => c.status === activeTab);
  }, [clients, activeTab]);

  const counts = useMemo(() => {
    return {
      all: clients.length,
      on_track: clients.filter((c) => c.status === "on_track").length,
      due_soon: clients.filter((c) => c.status === "due_soon").length,
      overdue: clients.filter((c) => c.status === "overdue").length,
      no_plan: clients.filter((c) => c.status === "no_plan").length,
    };
  }, [clients]);

  const getCount = (key: TabKey) => (key === "all" ? counts.all : counts[key]);

  const emptyByTab: Record<TabKey, { title: string; description: string }> = {
    all: { title: "No clients yet", description: "Add your first client to see priorities here." },
    on_track: { title: "No clients on track", description: "Clients with recent plans show here." },
    due_soon: { title: "Nothing due soon", description: "All caught up." },
    overdue: { title: "No overdue plans", description: "All caught up." },
    no_plan: { title: "All clients have a plan", description: "Everyone has at least one plan." },
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <SectionHeader
          title="Today's priorities"
          subtitle="Clients by plan status — act on what matters next."
        />
        <div className="flex flex-wrap gap-1">
          {TABS.map(({ key, label }) => {
            const count = getCount(key);
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
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
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={emptyByTab[activeTab].title}
            description={emptyByTab[activeTab].description}
            action={
              activeTab === "all" ? (
                <PrimaryButton href="/pt/app/clients/new">Add first client</PrimaryButton>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-neutral-100 -mx-1">
            {filtered.map((c) => (
              <PriorityRow
                key={c.id}
                clientId={c.id}
                name={c.name}
                status={c.status}
                dueInDays={c.dueInDays}
                overdueByDays={c.overdueByDays}
                latestPlanDate={c.latestPlanDate}
                latestPlanId={c.latestPlanId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
