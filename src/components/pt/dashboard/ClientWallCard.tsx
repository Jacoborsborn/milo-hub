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
