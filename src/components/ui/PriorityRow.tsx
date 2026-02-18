"use client";

import Link from "next/link";
import Tag from "./Tag";
import type { PlanStatus } from "@/lib/services/dashboard";

type PriorityRowProps = {
  clientId: string;
  name: string;
  status: PlanStatus;
  dueInDays: number | null;
  overdueByDays: number | null;
  latestPlanDate: string | null;
  latestPlanId: string | null;
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  on_track: "On track",
  due_soon: "Due soon",
  overdue: "Overdue",
  no_plan: "No plan",
};

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

export default function PriorityRow({
  clientId,
  name,
  status,
  latestPlanDate,
  latestPlanId,
}: PriorityRowProps) {
  const cta = getCta(status, clientId, latestPlanId);

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 border-b border-neutral-100 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 truncate">{name}</p>
        {latestPlanDate && (
          <p className="text-xs text-neutral-500 mt-0.5">
            Last plan: {new Date(latestPlanDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>
      <Tag label={STATUS_LABELS[status]} status={status} variant="status" />
      <Link
        href={cta.href}
        className="shrink-0 inline-flex items-center justify-center min-h-[36px] px-3 font-medium rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-sm transition-colors"
      >
        {cta.label}
      </Link>
    </div>
  );
}
