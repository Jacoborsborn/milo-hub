"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import PlanRenderer from "@/components/PlanRenderer";
import MealPlanRenderer from "@/components/MealPlanRenderer";
import PlanTypeBadge from "@/components/PlanTypeBadge";

type Plan = {
  id: string;
  plan_type: "meal" | "workout";
  content_json: Record<string, unknown>;
  created_at: string;
};

function completionKey(week_number: number, day_index: number) {
  return `${week_number}-${day_index}`;
}

export default function ClientShareView({
  plan,
  planTitle,
  planType,
  createdDate,
  shareToken,
}: {
  plan: Plan;
  planTitle: string;
  planType: "meal" | "workout";
  createdDate: string;
  shareToken: string;
}) {
  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
  const [completionError, setCompletionError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    const url = `/api/share/plan-completions?token=${encodeURIComponent(shareToken)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load completions");
        return res.json();
      })
      .then((list: { week_number: number; day_index: number }[]) => {
        const set = new Set(list.map((r) => completionKey(r.week_number, r.day_index)));
        setCompletedDays(set);
      })
      .catch(() => setCompletedDays(new Set()));
  }, [shareToken]);

  const handleToggleDayComplete = useCallback(
    async (week_number: number, day_index: number, completed: boolean) => {
      const key = completionKey(week_number, day_index);
      setCompletionError(null);
      setCompletedDays((prev) => {
        const next = new Set(prev);
        if (completed) next.add(key);
        else next.delete(key);
        return next;
      });
      const res = await fetch("/api/share/plan-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: shareToken,
          week_number,
          day_index,
          completed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCompletedDays((prev) => {
          const next = new Set(prev);
          if (completed) next.delete(key);
          else next.add(key);
          return next;
        });
        setCompletionError(data?.error ?? "Could not save. Please try again.");
      } else {
        setCompletionError(null);
      }
    },
    [shareToken]
  );

  const weeks = (plan.content_json?.weeks as { week?: number }[] | undefined) ?? [];
  const weekNumbers = useMemo(
    () => weeks.map((w, i) => w?.week ?? i + 1),
    [weeks]
  );

  const scrollToWeek = useCallback((weekNum: number) => {
    const el = document.getElementById(`week-${weekNum}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const coachMessage =
    plan.content_json?.meta &&
    typeof plan.content_json.meta === "object" &&
    "coachMessage" in (plan.content_json.meta as object)
      ? (plan.content_json.meta as { coachMessage?: string }).coachMessage
      : undefined;
  const hasCoachMessage =
    typeof coachMessage === "string" && coachMessage.trim().length > 0;

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 shadow-sm safe-area-inset-top">
        <div className="max-w-xl mx-auto px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-neutral-900 truncate">
              {planTitle}
            </h1>
            <PlanTypeBadge planType={planType} />
          </div>
          {planType === "workout" && (
            <div className="flex items-center gap-2">
              <label htmlFor="week-select" className="text-sm font-medium text-neutral-600 shrink-0">
                Jump to:
              </label>
              <select
                id="week-select"
                onChange={(e) => scrollToWeek(Number(e.target.value))}
                className="flex-1 min-w-0 min-h-[44px] text-base rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 touch-manipulation"
                aria-label="Select week"
              >
                {weekNumbers.map((num) => (
                  <option key={num} value={num}>
                    Week {num}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-neutral-500">Created: {createdDate}</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 pb-8">
        <div className="break-words overflow-x-hidden flex flex-col gap-6">
          {hasCoachMessage && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-base leading-relaxed text-neutral-900 whitespace-pre-wrap">
                {coachMessage!.trim()}
              </p>
            </div>
          )}
          {completionError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {completionError}
            </div>
          )}
          {planType === "meal" ? (
            <MealPlanRenderer data={plan.content_json} />
          ) : (
            <PlanRenderer
              plan={plan.content_json}
              mode="client"
              completedDayKeys={completedDays}
              onToggleDayComplete={handleToggleDayComplete}
            />
          )}
        </div>
      </main>
    </div>
  );
}
