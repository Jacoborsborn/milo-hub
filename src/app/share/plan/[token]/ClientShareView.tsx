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

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const radius = 28;
  const stroke = 4;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = total === 0 ? 0 : completed / total;
  const strokeDashoffset = circumference - progress * circumference;
  const isComplete = completed === total && total > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="-rotate-90">
          <circle
            stroke="#e5e7eb"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={isComplete ? "#16a34a" : "#6366f1"}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s ease" }}
          />
        </svg>
        <span className="absolute text-xs font-bold text-neutral-700">
          {completed}/{total}
        </span>
      </div>
      <span className="text-xs text-neutral-500 font-medium">
        {isComplete ? "Complete 🎉" : "days done"}
      </span>
    </div>
  );
}

export default function ClientShareView({
  plan,
  planTitle,
  planType,
  createdDate,
  shareToken,
  clientName,
}: {
  plan: Plan;
  planTitle: string;
  planType: "meal" | "workout";
  createdDate: string;
  shareToken: string;
  clientName: string | null;
}) {
  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [allDoneShown, setAllDoneShown] = useState(false);

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

  const weeks = (plan.content_json?.weeks as { days?: unknown[] }[] | undefined) ?? [];

  const totalDays = useMemo(() => {
    return weeks.reduce((acc, w) => acc + (w.days?.length ?? 0), 0);
  }, [weeks]);

  const completedCount = completedDays.size;
  const isAllComplete = totalDays > 0 && completedCount >= totalDays;

  useEffect(() => {
    if (isAllComplete && !allDoneShown) {
      setAllDoneShown(true);
    }
  }, [isAllComplete, allDoneShown]);

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
        body: JSON.stringify({ token: shareToken, week_number, day_index, completed }),
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

  const weekNumbers = useMemo(
    () => weeks.map((w, i) => (w as { week?: number })?.week ?? i + 1),
    [weeks]
  );

  const scrollToWeek = useCallback((weekNum: number) => {
    const el = document.getElementById(`week-${weekNum}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const coachMessage =
    plan.content_json?.meta &&
    typeof plan.content_json.meta === "object" &&
    "coachMessage" in (plan.content_json.meta as object)
      ? (plan.content_json.meta as { coachMessage?: string }).coachMessage
      : undefined;
  const hasCoachMessage = typeof coachMessage === "string" && coachMessage.trim().length > 0;

  const firstName = clientName?.split(" ")[0] ?? null;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* All complete celebration banner */}
      {allDoneShown && (
        <div className="bg-green-600 text-white text-center py-3 px-4 text-sm font-semibold tracking-wide">
          🎉 You crushed it this week. Your coach will be proud.
        </div>
      )}

      <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 shadow-sm safe-area-inset-top">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            {/* Personalised greeting */}
            {firstName ? (
              <h1 className="text-xl font-bold text-neutral-900">
                Hey {firstName} 👋
              </h1>
            ) : (
              <h1 className="text-xl font-bold text-neutral-900">
                Your Plan
              </h1>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <PlanTypeBadge planType={planType} />
              <span className="text-xs text-neutral-400">{createdDate}</span>
            </div>
            {planType === "workout" && weekNumbers.length > 1 && (
              <div className="flex items-center gap-2 mt-2">
                <label htmlFor="week-select" className="text-sm font-medium text-neutral-600 shrink-0">
                  Jump to:
                </label>
                <select
                  id="week-select"
                  onChange={(e) => scrollToWeek(Number(e.target.value))}
                  className="flex-1 min-w-0 min-h-[44px] text-base rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 touch-manipulation"
                  aria-label="Select week"
                >
                  {weekNumbers.map((num) => (
                    <option key={num} value={num}>Week {num}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Progress ring — workout only */}
          {planType === "workout" && totalDays > 0 && (
            <div className="shrink-0 pt-1">
              <ProgressRing completed={completedCount} total={totalDays} />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 pb-12">
        <div className="break-words overflow-x-hidden flex flex-col gap-5">

          {/* Coach message — elevated, personal */}
          {hasCoachMessage && (
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-5 shadow-sm">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                Message from your coach
              </p>
              <p className="text-sm leading-relaxed text-neutral-800 whitespace-pre-wrap">
                {coachMessage!.trim()}
              </p>
            </div>
          )}

          {/* Progress nudge — only show if partially done */}
          {planType === "workout" && totalDays > 0 && completedCount > 0 && !isAllComplete && (
            <div className="rounded-xl bg-white border border-neutral-200 px-4 py-3 flex items-center gap-3 shadow-sm">
              <span className="text-2xl">🔥</span>
              <p className="text-sm text-neutral-700 font-medium">
                {completedCount} down, {totalDays - completedCount} to go. Keep the streak alive.
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