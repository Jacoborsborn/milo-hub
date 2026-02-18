"use client";

import { useState, useEffect, useCallback } from "react";
import DayHeader from "@/components/meals/DayHeader";
import MealCard from "@/components/meals/MealCard";
import {
  getCompletionKeyPrefix,
  loadDayCompletion,
  saveDayCompletion,
} from "@/lib/meals/uiFormat";

export type Meal = {
  mealType?: string;
  name?: string;
  cuisine?: string;
  ingredientsPerPortion?: { foodId?: string; amount?: number; unit?: string }[];
  macrosPerPortion?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
  recipe?: string;
  preparationSteps?: string[];
};

type Day = {
  dayIndex?: number;
  meals?: Meal[];
  totalCalories?: number;
};

type GroceryItem = {
  foodId?: string;
  name?: string;
  buy?: string;
  needed?: string;
  estimatedPriceGBP?: number;
  priceBand?: string;
};

type GrocerySection = {
  label?: string;
  items?: GroceryItem[];
};

export type MealPlanData = {
  days?: Day[];
  grocerySections?: GrocerySection[];
  groceryTotals?: {
    totalPriceGBP?: number;
    breakdownGBP?: Record<string, number>;
    estimatedTotalWeek?: number;
  };
  plan_name?: string;
  dailyCaloriesTarget?: number;
  mealsPerDay?: number;
};

function deepCopy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function getMealKey(meal: Meal): string {
  return `${meal.mealType ?? "meal"}:${meal.name ?? ""}`;
}

export default function MealPlanRenderer({
  data,
  hideGrocery = false,
  editMode = false,
  onSave,
  saving = false,
  shareToken,
  planId,
}: {
  data: MealPlanData;
  hideGrocery?: boolean;
  editMode?: boolean;
  onSave?: (data: MealPlanData) => void;
  saving?: boolean;
  /** When set (public share), enable meal completion toggles persisted in localStorage. */
  shareToken?: string;
  /** When set (PT plan view), enable meal completion persisted in localStorage by plan. */
  planId?: string;
}) {
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);
  const [editedData, setEditedData] = useState<MealPlanData>(() => deepCopy(data));
  const [dayCompleted, setDayCompleted] = useState<Record<string, boolean>>({});

  const completionKeyPrefix = getCompletionKeyPrefix(planId, shareToken);

  useEffect(() => {
    if (completionKeyPrefix != null) {
      setDayCompleted(loadDayCompletion(completionKeyPrefix, activeDayIndex));
    }
  }, [completionKeyPrefix, activeDayIndex]);

  useEffect(() => {
    if (editMode) setEditedData(deepCopy(data));
  }, [data, editMode]);

  const displayData = editMode ? editedData : data;
  const days = displayData.days ?? [];
  const grocerySections = displayData.grocerySections ?? [];
  const groceryTotals = displayData.groceryTotals ?? {};
  const totalPrice = groceryTotals.totalPriceGBP ?? groceryTotals.estimatedTotalWeek ?? 0;

  const updateMeal = useCallback(
    (dayIdx: number, mealIdx: number, updater: (m: Meal) => Meal) => {
      setEditedData((prev) => {
        const next = deepCopy(prev);
        const day = next.days?.[dayIdx];
        const meal = day?.meals?.[mealIdx];
        if (!day?.meals || !meal) return prev;
        day.meals[mealIdx] = updater(meal);
        return next;
      });
    },
    []
  );

  const handleSave = useCallback(() => {
    onSave?.(deepCopy(editedData));
  }, [editedData, onSave]);

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center text-neutral-600">
        No meal plan data.
      </div>
    );
  }

  const currentDay = days[activeDayIndex];
  const meals = currentDay?.meals ?? [];

  const dayKcal =
    typeof currentDay?.totalCalories === "number"
      ? currentDay.totalCalories
      : (meals as Meal[]).reduce((s, m) => s + (m.macrosPerPortion?.calories ?? 0), 0);
  const dayMacros = (meals as Meal[]).reduce(
    (acc, m) => {
      const mp = m.macrosPerPortion;
      return {
        protein_g: (acc.protein_g ?? 0) + (mp?.protein_g ?? 0),
        carbs_g: (acc.carbs_g ?? 0) + (mp?.carbs_g ?? 0),
        fat_g: (acc.fat_g ?? 0) + (mp?.fat_g ?? 0),
      };
    },
    { protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
  const completedCount = meals.filter((m) => dayCompleted[getMealKey(m)]).length;
  const dietGoal =
    (displayData as { meta?: { mealInputs?: { dietGoal?: string } }; mealInputs?: { dietGoal?: string } }).meta?.mealInputs?.dietGoal ??
    (displayData as { mealInputs?: { dietGoal?: string } }).mealInputs?.dietGoal;

  const deriveStatusForDay = (d: Day) => {
    const target = displayData.dailyCaloriesTarget;
    if (target == null || target <= 0) return null;
    const kcal =
      typeof d.totalCalories === "number"
        ? d.totalCalories
        : (d.meals ?? []).reduce((s: number, m: Meal) => s + (m.macrosPerPortion?.calories ?? 0), 0);
    const diff = kcal - target;
    const pct = (diff / target) * 100;
    if (pct >= -5 && pct <= 5) return "on_track";
    if (pct > 5) return "slightly_over";
    return "under";
  };

  return (
    <div className="space-y-6">
      {/* Day tabs (sticky-friendly, status dot per day) */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1">
        {days.map((d, i) => {
          const status = deriveStatusForDay(d);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActiveDayIndex(i)}
              className={`min-w-[72px] shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors touch-manipulation flex items-center justify-center gap-1.5 ${
                activeDayIndex === i
                  ? "border-neutral-800 bg-neutral-800 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {status != null && (
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    status === "on_track" ? "bg-emerald-500" : status === "slightly_over" ? "bg-amber-500" : "bg-sky-500"
                  }`}
                  title={status === "on_track" ? "On track" : status === "slightly_over" ? "Slightly over" : "Under"}
                />
              )}
              Day {d.dayIndex ?? i + 1}
            </button>
          );
        })}
      </div>

      {/* Meals for selected day: new design (DayHeader + MealCard) or edit mode (legacy block) */}
      {!editMode ? (
        <div className="space-y-4">
          <DayHeader
            dayIndex={currentDay?.dayIndex ?? activeDayIndex + 1}
            dayLabel={`Day ${currentDay?.dayIndex ?? activeDayIndex + 1}`}
            totalCalories={dayKcal}
            dailyCaloriesTarget={displayData.dailyCaloriesTarget}
            mealsPerDay={displayData.mealsPerDay ?? 4}
            completionCount={completedCount}
            totalMeals={meals.length}
            dietGoal={dietGoal}
            dayMacros={dayMacros.protein_g + dayMacros.carbs_g + dayMacros.fat_g > 0 ? dayMacros : null}
          />
          <div className="space-y-4">
            {meals.map((meal, mIdx) => {
              const mealKey = getMealKey(meal);
              const isCompleted = !!dayCompleted[mealKey];
              const toggleCompleted =
                completionKeyPrefix != null
                  ? () => {
                      const next = { ...dayCompleted, [mealKey]: !dayCompleted[mealKey] };
                      setDayCompleted(next);
                      saveDayCompletion(completionKeyPrefix, activeDayIndex, next);
                    }
                  : () => {};
              return (
                <MealCard
                  key={mIdx}
                  meal={meal as Meal}
                  dayIndex={activeDayIndex}
                  mealIndex={mIdx}
                  isCompleted={isCompleted}
                  onToggleComplete={toggleCompleted}
                  completionEnabled={completionKeyPrefix != null}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50">
            <span className="text-sm font-medium text-neutral-500">
              Day {currentDay?.dayIndex ?? activeDayIndex + 1}
            </span>
          </div>
          <div className="p-5 space-y-5">
          {meals.map((meal, mIdx) => (
            <div
              key={mIdx}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={meal.name ?? ""}
                    onChange={(e) =>
                      updateMeal(activeDayIndex, mIdx, (m) => ({ ...m, name: e.target.value }))
                    }
                    className="text-base font-semibold text-neutral-900 border border-neutral-300 rounded px-2 py-1 w-full max-w-md"
                    placeholder="Meal name"
                  />
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {(meal.ingredientsPerPortion ?? []).map((ing, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={ing.amount ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? 0 : Number(e.target.value);
                        updateMeal(activeDayIndex, mIdx, (m) => {
                          const list = [...(m.ingredientsPerPortion ?? [])];
                          list[i] = { ...list[i], amount: v };
                          return { ...m, ingredientsPerPortion: list };
                        });
                      }}
                      className="w-20 min-h-[36px] rounded border border-neutral-300 px-2 text-sm"
                    />
                    <input
                      type="text"
                      value={ing.unit ?? "g"}
                      onChange={(e) =>
                        updateMeal(activeDayIndex, mIdx, (m) => {
                          const list = [...(m.ingredientsPerPortion ?? [])];
                          list[i] = { ...list[i], unit: e.target.value || "g" };
                          return { ...m, ingredientsPerPortion: list };
                        })
                      }
                      className="w-12 min-h-[36px] rounded border border-neutral-300 px-2 text-sm"
                    />
                    <span className="text-sm text-neutral-600 flex-1 min-w-0 truncate">
                      {ing.foodId?.replace(/_/g, " ") ?? "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateMeal(activeDayIndex, mIdx, (m) => {
                          const list = (m.ingredientsPerPortion ?? []).filter((_, idx) => idx !== i);
                          return { ...m, ingredientsPerPortion: list };
                        })
                      }
                      className="text-red-600 hover:underline text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateMeal(activeDayIndex, mIdx, (m) => ({
                      ...m,
                      ingredientsPerPortion: [
                        ...(m.ingredientsPerPortion ?? []),
                        { foodId: "new_ingredient", amount: 0, unit: "g" },
                      ],
                    }))
                  }
                  className="text-sm text-blue-600 hover:underline"
                >
                  + Add ingredient
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {editMode && onSave && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px] rounded-lg bg-neutral-800 text-white font-medium px-6 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* Grocery summary – hidden when hideGrocery (e.g. review page uses separate Grocery tab) */}
      {!hideGrocery && (grocerySections.length > 0 || totalPrice > 0) && (
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
            <h3 className="text-base font-semibold text-neutral-900">Grocery list</h3>
            {totalPrice > 0 && (
              <span className="text-sm font-medium text-neutral-700">
                ~£{totalPrice.toFixed(2)} / week
              </span>
            )}
          </div>
          <div className="p-4 space-y-4">
            {grocerySections.map((section, sIdx) => (
              <div key={sIdx}>
                <h4 className="text-sm font-medium text-neutral-600 mb-2">
                  {section.label ?? "Other"}
                </h4>
                <ul className="space-y-1.5">
                  {(section.items ?? []).map((item, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap justify-between gap-2 text-sm text-neutral-800"
                    >
                      <span>{item.name ?? item.buy ?? "—"}</span>
                      {item.buy && (
                        <span className="text-neutral-500 shrink-0">{item.buy}</span>
                      )}
                      {item.estimatedPriceGBP != null && item.estimatedPriceGBP > 0 && (
                        <span className="text-neutral-600">£{item.estimatedPriceGBP.toFixed(2)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
