"use client";

import Link from "next/link";

export type PlanTabId = "meals" | "shopping";

type TabItem = {
  id: PlanTabId;
  label: string;
  href: string;
  count?: number;
  countLabel?: string; // e.g. "sections" for Shopping (5 sections)
};

type PlanTabsProps = {
  planId: string;
  activeTab: PlanTabId;
  mealCount?: number;
  shoppingSectionCount?: number;
};

export default function PlanTabs({
  planId,
  activeTab,
  mealCount = 0,
  shoppingSectionCount = 0,
}: PlanTabsProps) {
  const tabs: TabItem[] = [
    { id: "meals", label: "Meals", href: `/pt/app/plans/${planId}`, count: mealCount },
    {
      id: "shopping",
      label: "Shopping",
      href: `/pt/app/plans/${planId}/shopping`,
      count: shoppingSectionCount,
      countLabel: "sections",
    },
  ];

  return (
    <div className="border-t border-neutral-100 bg-neutral-50/80">
      <div
        className="flex gap-2 p-2 overflow-x-auto scrollbar-none"
        role="tablist"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const countText =
            tab.count != null && tab.count > 0
              ? tab.countLabel
                ? ` (${tab.count} ${tab.countLabel})`
                : ` (${tab.count})`
              : "";

          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-current={isActive ? "true" : undefined}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-neutral-900 shadow-sm border border-neutral-200 font-semibold"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-white/70"
              }`}
            >
              {tab.label}{countText}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
