"use client";

import { useEffect } from "react";
import Link from "next/link";
import MealPlanRenderer from "@/components/MealPlanRenderer";

type Plan = {
  id: string;
  plan_type: string;
  content_json: Record<string, unknown>;
  created_at: string;
};

export default function PublicMealShareView({
  plan,
  createdDate,
  weekCommencing,
  coachDisplayName,
  token,
}: {
  plan: Plan;
  createdDate: string;
  weekCommencing: string;
  coachDisplayName: string;
  token: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      window.print();
    }
  }, []);

  const content = plan.content_json as {
    dailyCaloriesTarget?: number;
    days?: {
      totalCalories?: number;
      meals?: {
        macrosPerPortion?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
        ingredientsPerPortion?: { foodId?: string }[];
      }[];
    }[];
    meta?: { mealInputs?: { budgetTier?: string } };
  };
  const dailyCaloriesTarget =
    typeof content.dailyCaloriesTarget === "number" && content.dailyCaloriesTarget > 0
      ? content.dailyCaloriesTarget
      : null;
  const days = content.days ?? [];
  const dayTotals = days.map((d) => ({
    kcal: d.totalCalories ?? (d.meals ?? []).reduce((s, m) => s + (m.macrosPerPortion?.calories ?? 0), 0),
  }));
  const alignmentScore = (actual: number, target: number) =>
    target <= 0 ? null : Math.max(0, Math.min(100, 100 - (Math.abs(actual - target) / target) * 100));
  const calorieAlignments =
    dailyCaloriesTarget != null && dayTotals.length > 0
      ? dayTotals
          .map((d) => (d.kcal > 0 ? alignmentScore(d.kcal, dailyCaloriesTarget) : null))
          .filter((x): x is number => x != null)
      : [];
  const calorieAlignmentPercent =
    calorieAlignments.length > 0
      ? Math.round(calorieAlignments.reduce((a, b) => a + b, 0) / calorieAlignments.length)
      : null;
  const budgetTier = content.meta?.mealInputs?.budgetTier;
  const budgetFitVisible = !!budgetTier && budgetTier !== "—";

  const sharedIngredientCount = (() => {
    const mealToFoodIds = new Map<string, Set<string>>();
    let mealKey = 0;
    for (const day of days) {
      for (const meal of day.meals ?? []) {
        const ids = new Set<string>();
        for (const ing of meal.ingredientsPerPortion ?? []) {
          const id = (ing.foodId ?? "").trim();
          if (id) ids.add(id);
        }
        if (ids.size > 0) mealToFoodIds.set(String(mealKey++), ids);
      }
    }
    const foodIdToMealCount = new Map<string, number>();
    for (const ids of mealToFoodIds.values()) {
      for (const id of ids) foodIdToMealCount.set(id, (foodIdToMealCount.get(id) ?? 0) + 1);
    }
    let shared = 0;
    for (const count of foodIdToMealCount.values()) if (count > 1) shared++;
    return shared;
  })();
  const systemStatusMacroAligned = calorieAlignmentPercent != null && calorieAlignmentPercent >= 90;
  const systemStatusBudgetOptimised = budgetFitVisible;
  const systemStatusOverlapMinimised = sharedIngredientCount > 2;
  const hasAnySystemStatus = systemStatusMacroAligned || systemStatusBudgetOptimised || systemStatusOverlapMinimised;

  return (
    <div className="min-h-screen bg-white print:bg-white">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 print:border-neutral-300 safe-area-inset-top">
        <div className="max-w-xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-neutral-900">Your Meal Plan</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Week commencing: {weekCommencing}</p>
          <p className="text-sm text-neutral-500">Prepared by: {coachDisplayName}</p>
          {(calorieAlignmentPercent != null || budgetFitVisible) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 mt-2">
              {calorieAlignmentPercent != null && (
                <span title="Alignment compares planned totals vs targets.">
                  Calorie alignment: {calorieAlignmentPercent}%
                </span>
              )}
              {budgetFitVisible && <span>Budget fit: On target</span>}
            </div>
          )}
          {hasAnySystemStatus && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 mt-2 pt-2 border-t border-neutral-100">
              <span className="font-medium text-neutral-500">System status:</span>
              {systemStatusMacroAligned && <span>✔ Macro aligned</span>}
              {systemStatusBudgetOptimised && <span>✔ Budget optimised</span>}
              {systemStatusOverlapMinimised && <span>✔ Ingredient overlap minimised</span>}
            </div>
          )}
        </div>
        <div className="max-w-xl mx-auto px-4 py-2 border-t border-neutral-100 flex flex-wrap items-center gap-2 bg-neutral-50/80">
          <Link
            href={`/share/meal/${token}`}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-neutral-200 text-neutral-800"
          >
            Meals
          </Link>
          <Link
            href={`/share/meal/${token}/shopping`}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            Shopping
          </Link>
          <span className="px-3 py-1.5 rounded-md text-sm font-medium text-neutral-400">Overview</span>
          <Link
            href={`/share/meal/${token}#top`}
            className="ml-auto text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main id="top" className="max-w-xl mx-auto px-4 py-6 pb-10 print:py-6 print:pb-6">
        <div className="text-base" style={{ fontSize: "14px" }}>
          <MealPlanRenderer
            data={plan.content_json}
            hideGrocery
            shareToken={token}
          />
        </div>
      </main>
    </div>
  );
}
