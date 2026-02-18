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
