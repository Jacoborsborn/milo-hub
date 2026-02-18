"use client";

import { useState } from "react";
import {
  formatKcal,
  deriveStatus,
  deriveDayVibeTitle,
  formatMacrosCompact,
} from "@/lib/meals/uiFormat";

export type DayHeaderProps = {
  dayIndex: number;
  dayLabel?: string;
  totalCalories: number;
  dailyCaloriesTarget?: number | null;
  mealsPerDay: number;
  completionCount: number;
  totalMeals: number;
  dietGoal?: string | null;
  proteinAligned?: boolean;
  overlapMinimised?: boolean;
  dayMacros?: { protein_g?: number; carbs_g?: number; fat_g?: number } | null;
};

export default function DayHeader({
  dayIndex,
  dayLabel,
  totalCalories,
  dailyCaloriesTarget,
  mealsPerDay,
  completionCount,
  totalMeals,
  dietGoal,
  proteinAligned,
  overlapMinimised,
  dayMacros,
}: DayHeaderProps) {
  const [macrosExpanded, setMacrosExpanded] = useState(false);
  const status = deriveStatus(totalCalories, dailyCaloriesTarget ?? undefined);
  const vibeTitle = deriveDayVibeTitle(dietGoal, mealsPerDay);
  const progressPct = totalMeals > 0 ? Math.round((completionCount / totalMeals) * 100) : 0;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-5 bg-gradient-to-br from-neutral-50 to-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              {dayLabel ?? `Day ${dayIndex}`}
            </h2>
            <p className="text-sm font-medium text-amber-600 mt-0.5">{vibeTitle}</p>
          </div>
          {status != null && (
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                status === "on_track"
                  ? "bg-emerald-100 text-emerald-800"
                  : status === "slightly_over"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-sky-100 text-sky-800"
              }`}
            >
              {status === "on_track" ? "On track" : status === "slightly_over" ? "Slightly over" : "Under"}
            </span>
          )}
        </div>

        <p className="text-3xl font-bold text-neutral-900 tabular-nums mt-3">
          {formatKcal(totalCalories)}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-neutral-600">
          {proteinAligned && <span>Protein aligned</span>}
          {overlapMinimised && <span>Ingredient overlap minimised</span>}
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-neutral-500 mb-1.5">
            {completionCount}/{totalMeals} meals completed
          </p>
          <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {dayMacros && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setMacrosExpanded((e) => !e)}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 underline"
            >
              {macrosExpanded ? "Hide macros" : "View macros"}
            </button>
            {macrosExpanded && (
              <p className="text-xs text-neutral-600 mt-1 tabular-nums">
                {formatMacrosCompact(dayMacros)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
