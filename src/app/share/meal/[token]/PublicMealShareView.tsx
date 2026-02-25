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
  clientName,
}: {
  plan: Plan;
  createdDate: string;
  weekCommencing: string;
  coachDisplayName: string;
  token: string;
  clientName: string | null;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") window.print();
  }, []);

  const content = plan.content_json as {
    dailyCaloriesTarget?: number;
    dailyProteinTarget?: number;
    days?: {
      totalCalories?: number;
      meals?: {
        macrosPerPortion?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
        ingredientsPerPortion?: { foodId?: string }[];
      }[];
    }[];
    grocery?: {
      sections?: {
        items?: { estimatedPriceGbp?: number }[];
      }[];
      estimatedTotalGbp?: number;
    };
    meta?: {
      mealInputs?: { budgetTier?: string };
      coachMessage?: string;
    };
  };

  const firstName = clientName?.split(" ")[0] ?? null;

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

  // Estimated total from grocery data
  const estimatedTotal: number | null = (() => {
    if (typeof content.grocery?.estimatedTotalGbp === "number") {
      return content.grocery.estimatedTotalGbp;
    }
    const sections = content.grocery?.sections ?? [];
    if (sections.length === 0) return null;
    let total = 0;
    for (const section of sections) {
      for (const item of section.items ?? []) {
        if (typeof item.estimatedPriceGbp === "number") total += item.estimatedPriceGbp;
      }
    }
    return total > 0 ? total : null;
  })();

  const coachMessage = content.meta?.coachMessage;
  const hasCoachMessage = typeof coachMessage === "string" && coachMessage.trim().length > 0;

  // Human-readable stat pills
  const statPills: { label: string; icon: string }[] = [];
  if (calorieAlignmentPercent != null && calorieAlignmentPercent >= 90) {
    statPills.push({ icon: "🎯", label: "Hit your calorie target" });
  }
  if (budgetFitVisible) {
    statPills.push({ icon: "💰", label: "Built for your budget" });
  }
  if (dailyCaloriesTarget != null) {
    statPills.push({ icon: "💪", label: `${dailyCaloriesTarget} kcal daily target` });
  }

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 shadow-sm safe-area-inset-top print:border-neutral-300">
        <div className="max-w-xl mx-auto px-4 py-4">

          {/* Personalised greeting */}
          {firstName ? (
            <h1 className="text-xl font-bold text-neutral-900">Hey {firstName} 👋</h1>
          ) : (
            <h1 className="text-xl font-bold text-neutral-900">Your Meal Plan</h1>
          )}

          <p className="text-sm text-neutral-500 mt-0.5">
            Week commencing {weekCommencing}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">
            Prepared by {coachDisplayName}
          </p>

          {/* Estimated total — hero number */}
          {estimatedTotal != null && (
            <div className="mt-3 inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
              <span className="text-lg">🛒</span>
              <div>
                <p className="text-xs text-green-700 font-medium">Estimated weekly shop</p>
                <p className="text-lg font-bold text-green-800">~£{estimatedTotal.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Human stat pills */}
          {statPills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {statPills.map((pill) => (
                <span
                  key={pill.label}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full px-3 py-1"
                >
                  {pill.icon} {pill.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Nav tabs */}
        <div className="max-w-xl mx-auto px-4 py-2 border-t border-neutral-100 flex items-center gap-2 bg-neutral-50/80">
          <Link
            href={`/share/meal/${token}`}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-neutral-200 text-neutral-800"
          >
            Meals
          </Link>
          <Link
            href={`/share/meal/${token}/shopping`}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            🛒 Shopping list
          </Link>
        </div>
      </header>

      <main id="top" className="max-w-xl mx-auto px-4 py-6 pb-12 print:py-6 print:pb-6">
        <div className="flex flex-col gap-5">

          {/* Coach message */}
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

          <div className="text-sm">
            <MealPlanRenderer
              data={plan.content_json}
              hideGrocery
              shareToken={token}
            />
          </div>
        </div>
      </main>
    </div>
  );
}