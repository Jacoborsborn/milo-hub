"use client";

import { useState } from "react";
import {
  formatKcal,
  formatMacrosCompact,
  ingredientsPreview,
  inferPrepTimeLabel,
  getPreparationStepsList,
} from "@/lib/meals/uiFormat";

export type Meal = {
  mealType?: string;
  name?: string;
  cuisine?: string;
  ingredientsPerPortion?: { foodId?: string; name?: string; amount?: number; unit?: string }[];
  macrosPerPortion?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
  recipe?: string;
  preparationSteps?: string[];
};

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** At most one: High Protein (≥35g), Carb Focused (>55% kcal), Energy Dense (>40% fat kcal). */
function getImpactChip(meal: Meal): string | null {
  const m = meal.macrosPerPortion;
  if (!m) return null;
  const p = m.protein_g ?? 0;
  const pKcal = p * 4;
  const cKcal = (m.carbs_g ?? 0) * 4;
  const fKcal = (m.fat_g ?? 0) * 9;
  const totalKcal = pKcal + cKcal + fKcal;
  if (totalKcal <= 0) return null;
  if (p >= 35) return "High protein";
  if (cKcal / totalKcal > 0.55) return "Carb-focused";
  if (fKcal / totalKcal > 0.4) return "Energy dense";
  return null;
}

function mealTypeAccent(mealType: string): string {
  const t = (mealType ?? "").toLowerCase();
  if (t.includes("breakfast")) return "bg-amber-100 text-amber-800 border-amber-200";
  if (t.includes("lunch")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (t.includes("dinner") || t.includes("supper")) return "bg-slate-100 text-slate-800 border-slate-200";
  if (t.includes("snack")) return "bg-violet-100 text-violet-800 border-violet-200";
  return "bg-neutral-100 text-neutral-700 border-neutral-200";
}

/** Thin segmented macro bar (P / C / F). */
function CompactMacroBar({
  protein_g = 0,
  carbs_g = 0,
  fat_g = 0,
}: {
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}) {
  const pKcal = (protein_g ?? 0) * 4;
  const cKcal = (carbs_g ?? 0) * 4;
  const fKcal = (fat_g ?? 0) * 9;
  const totalKcal = pKcal + cKcal + fKcal;
  if (totalKcal <= 0) return null;
  const pct = (n: number) => (n / totalKcal) * 100;
  return (
    <div
      className="flex h-1.5 w-full min-w-[80px] max-w-[160px] rounded-full overflow-hidden bg-neutral-100"
      role="img"
      aria-label={`Protein ${Math.round(pct(pKcal))}%, Carbs ${Math.round(pct(cKcal))}%, Fat ${Math.round(pct(fKcal))}%`}
    >
      <div
        className="h-full bg-slate-600"
        style={{ width: `${pct(pKcal)}%` }}
      />
      <div
        className="h-full bg-stone-500"
        style={{ width: `${pct(cKcal)}%` }}
      />
      <div
        className="h-full bg-zinc-500"
        style={{ width: `${pct(fKcal)}%` }}
      />
    </div>
  );
}

export type MealCardProps = {
  meal: Meal;
  dayIndex: number;
  mealIndex: number;
  isCompleted: boolean;
  onToggleComplete: () => void;
  completionEnabled: boolean;
};

export default function MealCard({
  meal,
  dayIndex,
  mealIndex,
  isCompleted,
  onToggleComplete,
  completionEnabled,
}: MealCardProps) {
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const [recipeExpanded, setRecipeExpanded] = useState(false);

  const mealType = meal.mealType ?? "Meal";
  const mealName = meal.name ?? "—";
  const steps = getPreparationStepsList(meal);
  const hasSteps = steps.length > 0;
  const hasRecipe = Boolean(meal.recipe?.trim());
  const ingredients = meal.ingredientsPerPortion ?? [];
  const hasIngredients = ingredients.length > 0;
  const impactChip = getImpactChip(meal);
  const prepLabel = inferPrepTimeLabel(steps);
  const macros = meal.macrosPerPortion;

  const accent = mealTypeAccent(mealType);

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all ${
        isCompleted ? "border-l-4 border-l-emerald-500 opacity-90" : "border-neutral-200"
      }`}
    >
      <div className="p-4">
        {/* Header: icon/emoji + name + completion toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <span className="text-lg shrink-0" aria-hidden>
              {mealType.toLowerCase().includes("breakfast") && "🍳"}
              {mealType.toLowerCase().includes("lunch") && "🥗"}
              {mealType.toLowerCase().includes("dinner") && "🍽️"}
              {mealType.toLowerCase().includes("snack") && "🍎"}
              {!["breakfast", "lunch", "dinner", "snack"].some((t) =>
                mealType.toLowerCase().includes(t)
              ) && "🍽️"}
            </span>
            <h3
              className="font-bold text-neutral-900 truncate"
              title={mealName.length > 32 ? mealName : undefined}
            >
              {titleCase(mealType)}: {mealName}
            </h3>
          </div>
          {completionEnabled && (
            <button
              type="button"
              onClick={onToggleComplete}
              className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-neutral-400 ${
                isCompleted ? "border-emerald-500 bg-emerald-50" : "border-neutral-300 bg-transparent"
              }`}
              aria-label={isCompleted ? "Mark as not done" : "Mark as done"}
            >
              {isCompleted && (
                <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Tag row */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${accent}`}>
            {titleCase(mealType)}
          </span>
          {impactChip && (
            <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
              {impactChip}
            </span>
          )}
          {prepLabel && (
            <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
              {prepLabel}
            </span>
          )}
        </div>

        {/* Numbers row: kcal + compact macros + segmented bar */}
        {macros && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
              {formatKcal(macros.calories)}
            </span>
            <span className="text-xs text-neutral-600 tabular-nums">
              {formatMacrosCompact(macros)}
            </span>
            <CompactMacroBar
              protein_g={macros.protein_g}
              carbs_g={macros.carbs_g}
              fat_g={macros.fat_g}
            />
          </div>
        )}

        {/* Collapsible: Ingredients */}
        {hasIngredients && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setIngredientsOpen((o) => !o)}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 py-1.5 px-3 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
            >
              {ingredientsOpen ? "Hide ingredients" : `Ingredients (${ingredients.length})`}
              {!ingredientsOpen && (
                <span className="text-neutral-500 font-normal ml-1">
                  {ingredientsPreview(ingredients, 3)}
                </span>
              )}
            </button>
            {ingredientsOpen && (
              <ul className="mt-2 text-sm text-neutral-700 space-y-1 list-none pl-0">
                {ingredients.map((ing, i) => {
                  const name = ing.name?.trim() || (ing.foodId ?? "").replace(/_/g, " ") || `Item ${i + 1}`;
                  const amount = ing.amount != null ? ing.amount : "";
                  const unit = ing.unit ?? "g";
                  return (
                    <li key={i} className="text-neutral-600">
                      {amount !== "" && (
                        <span className="tabular-nums text-neutral-500">{amount}{unit} </span>
                      )}
                      {name}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Collapsible: Prep */}
        {hasSteps && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setPrepOpen((o) => !o)}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 py-1.5 px-3 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
            >
              {prepOpen ? "Hide prep" : `${steps.length} steps`}
            </button>
            {prepOpen && (
              <ul className="mt-2 text-sm text-neutral-600 space-y-1 list-disc list-inside pl-1">
                {steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Long recipe: collapsed with "Show more" */}
        {hasRecipe && !hasSteps && (
          <div className="mt-3">
            <p className="text-sm text-neutral-600 whitespace-pre-wrap">
              {recipeExpanded ? meal.recipe : `${(meal.recipe ?? "").slice(0, 120).trim()}${(meal.recipe ?? "").length > 120 ? "…" : ""}`}
            </p>
            {(meal.recipe ?? "").length > 120 && (
              <button
                type="button"
                onClick={() => setRecipeExpanded((e) => !e)}
                className="text-xs font-medium text-neutral-600 hover:underline mt-1"
              >
                {recipeExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
