"use client";

import { useState } from "react";

export type MealPlanHeaderProps = {
  clientLabel: string;
  weekCommencingLabel: string;
  weekCommencingIso: string;
  onWeekCommencingChange: (isoDate: string) => void;
  dailyCaloriesTarget?: number | null;
  avgProtein?: number | null;
  budgetTier?: string | null;
  weeklySpend: number;
  calorieAlignmentPercent?: number | null;
  systemStatusMacroAligned?: boolean;
  systemStatusOverlapMinimised?: boolean;
  coachName?: string | null;
};

function statusPillFromAlignment(percent: number | null | undefined): { label: string; className: string } | null {
  if (percent == null) return null;
  if (percent >= 95) return { label: "On track", className: "bg-emerald-100 text-emerald-800" };
  if (percent >= 85) return { label: "Needs tweaks", className: "bg-amber-100 text-amber-800" };
  return { label: "Off target", className: "bg-red-100 text-red-800" };
}

export default function MealPlanHeader({
  clientLabel,
  weekCommencingLabel,
  weekCommencingIso,
  onWeekCommencingChange,
  dailyCaloriesTarget,
  avgProtein,
  budgetTier,
  weeklySpend,
  calorieAlignmentPercent,
  systemStatusMacroAligned,
  systemStatusOverlapMinimised,
  coachName,
}: MealPlanHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const statusPill = statusPillFromAlignment(calorieAlignmentPercent);
  const showBudget = budgetTier != null && budgetTier !== "" && budgetTier !== "—";

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm mb-4" data-plan-authority>
      <div className="px-5 py-5 bg-gradient-to-br from-neutral-50 to-white">
        {/* Top row: label + client | status pill */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Meal Plan</p>
            <h1 className="text-2xl font-bold text-neutral-900 mt-0.5">{clientLabel}</h1>
          </div>
          {statusPill != null && (
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${statusPill.className}`}>
              {statusPill.label}
            </span>
          )}
        </div>

        {/* Second row: week commencing + Change */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-sm text-neutral-600">Week commencing {weekCommencingLabel}</span>
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900 underline"
          >
            Change
          </button>
          {pickerOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setPickerOpen(false)}
                aria-hidden
              />
              <div className="relative z-20 flex items-center gap-2">
                <input
                  type="date"
                  defaultValue={weekCommencingIso.slice(0, 10)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      onWeekCommencingChange(v);
                      setPickerOpen(false);
                    }
                  }}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>
            </>
          )}
        </div>

        {/* Metrics row: compact cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">Daily target</p>
            <p className="text-lg font-bold text-neutral-900 tabular-nums mt-0.5">
              {typeof dailyCaloriesTarget === "number" ? dailyCaloriesTarget : "—"} kcal
            </p>
          </div>
          {avgProtein != null && (
            <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-neutral-500">Protein target</p>
              <p className="text-lg font-bold text-neutral-900 tabular-nums mt-0.5">~{avgProtein}g/day</p>
            </div>
          )}
          {showBudget && (
            <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
              <p className="text-xs font-medium text-neutral-500">Budget tier</p>
              <p className="text-lg font-bold text-neutral-900 mt-0.5 capitalize">{String(budgetTier)}</p>
            </div>
          )}
          <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">Weekly spend</p>
            <p className="text-lg font-bold text-neutral-900 tabular-nums mt-0.5">
              £{typeof weeklySpend === "number" ? weeklySpend.toFixed(2) : "0.00"}
            </p>
          </div>
        </div>

        {/* System status chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          {systemStatusMacroAligned && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              Macro aligned
            </span>
          )}
          {systemStatusOverlapMinimised && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              Overlap minimised
            </span>
          )}
        </div>

        {coachName && (
          <p className="text-xs text-neutral-400 mt-4">Prepared by {coachName}</p>
        )}
      </div>
    </div>
  );
}
