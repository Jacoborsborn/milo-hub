/**
 * UI formatting and localStorage helpers for meal plan view.
 * No backend or JSON shape changes.
 */

export function formatKcal(kcal: number | undefined | null): string {
  if (kcal == null || Number.isNaN(kcal)) return "—";
  return `${Math.round(kcal)} kcal`;
}

export function formatMacrosCompact(macros: {
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
} | null | undefined): string {
  if (!macros) return "—";
  const p = macros.protein_g ?? 0;
  const c = macros.carbs_g ?? 0;
  const f = macros.fat_g ?? 0;
  return `P ${Math.round(p)} · C ${Math.round(c)} · F ${Math.round(f)}`;
}

type IngredientItem = { foodId?: string; name?: string; amount?: number; unit?: string };

/**
 * Extract a short preview of ingredient names. Uses name or foodId (formatted);
 * if only foodId exists with no name, fallback is "Item N". Does not break on missing fields.
 */
export function ingredientsPreview(
  ingredients: IngredientItem[] | null | undefined,
  maxItems = 5,
  join = " · "
): string {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return "";
  const names = ingredients.slice(0, maxItems).map((ing, i) => {
    const name = ing.name?.trim();
    if (name) return name;
    const foodId = (ing.foodId ?? "").trim();
    if (foodId) return foodId.replace(/_/g, " ");
    return `Item ${i + 1}`;
  });
  const more = ingredients.length > maxItems ? ` … +${ingredients.length - maxItems}` : "";
  return names.join(join) + more;
}

/**
 * Status chip: "On track" (green) / "Slightly over" (amber) / "Under" (blue)
 * based on totalCalories vs dailyCaloriesTarget ± 5%.
 * Returns null if target missing or invalid.
 */
export function deriveStatus(
  totalCalories: number,
  targetCalories: number | undefined | null
): "on_track" | "slightly_over" | "under" | null {
  if (targetCalories == null || targetCalories <= 0) return null;
  const diff = totalCalories - targetCalories;
  const pct = (diff / targetCalories) * 100;
  if (pct >= -5 && pct <= 5) return "on_track";
  if (pct > 5) return "slightly_over";
  return "under";
}

/** localStorage key prefix for share-based completion (legacy). */
export const STORAGE_PREFIX_SHARE = "mealShareDayCompleted:";

/** localStorage key prefix for plan-based completion. */
export const STORAGE_PREFIX_PLAN = "mealCompletion:";

/**
 * Get storage key for completion state. Use with dayIndex: keyPrefix + ":" + dayIndex.
 * Returns null when neither planId nor shareToken is provided.
 */
export function getCompletionKeyPrefix(planId: string | undefined, shareToken: string | undefined): string | null {
  if (shareToken) return `${STORAGE_PREFIX_SHARE}${shareToken}`;
  if (planId) return `${STORAGE_PREFIX_PLAN}${planId}`;
  return null;
}

export function loadDayCompletion(keyPrefix: string, dayIndex: number): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${keyPrefix}:${dayIndex}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed === "object" && parsed !== null
      ? Object.fromEntries(Object.entries(parsed).filter(([, v]) => v === true))
      : {};
  } catch {
    return {};
  }
}

export function saveDayCompletion(
  keyPrefix: string,
  dayIndex: number,
  map: Record<string, boolean>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${keyPrefix}:${dayIndex}`, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Infer "Quick" or "15 min" from preparation steps length (short list = quick). */
export function inferPrepTimeLabel(steps: string[] | null | undefined): string | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  if (steps.length <= 2) return "Quick";
  if (steps.length <= 4) return "15 min";
  return null;
}

/** Derive vibe title for day header from dietGoal and mealsPerDay when no explicit label. */
export function deriveDayVibeTitle(
  dietGoal: string | undefined | null,
  mealsPerDay: number | undefined | null
): string {
  const goal = (dietGoal ?? "").toLowerCase();
  const meals = mealsPerDay ?? 4;
  if (goal === "cut" || goal === "lose") return "Lean day";
  if (goal === "gain" || goal === "bulk") return "Training fuel";
  if (meals >= 5) return "Full day";
  return "Balanced day";
}

type MealLike = {
  preparationSteps?: string[];
  recipe?: string;
  ingredientsPerPortion?: { foodId?: string }[];
  cuisine?: string;
};

/** Derive 3–5 concise preparation steps from recipe, preparationSteps, or ingredients. */
export function getPreparationStepsList(meal: MealLike): string[] {
  if (Array.isArray(meal.preparationSteps) && meal.preparationSteps.length > 0) {
    return meal.preparationSteps.slice(0, 5).map((s) => String(s).trim()).filter(Boolean);
  }
  const recipe = (meal.recipe ?? "").trim();
  if (recipe) {
    const numbered = recipe.match(/^\s*\d+[.)]\s*.+$/gm);
    if (numbered && numbered.length >= 2) {
      return numbered
        .slice(0, 5)
        .map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim())
        .filter(Boolean);
    }
    const parts = recipe
      .split(/\n+|\.\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10 && s.length < 120);
    if (parts.length > 0) return parts.slice(0, 5);
  }
  const ingredients = meal.ingredientsPerPortion ?? [];
  if (ingredients.length === 0) return [];
  const names = ingredients.map((i) => (i.foodId ?? "").replace(/_/g, " ")).filter(Boolean);
  const style = (meal.cuisine ?? "simple").toLowerCase();
  const steps: string[] = [];
  if (names.length > 0) {
    steps.push(`Prepare ${names.slice(0, 3).join(", ")}${names.length > 3 ? " and remaining ingredients" : ""}.`);
  }
  steps.push(style.includes("stir") || style.includes("fry") ? "Heat pan over medium heat." : "Heat oven or hob as needed.");
  steps.push("Combine ingredients and cook until done.");
  steps.push("Season to taste and serve.");
  return steps.slice(0, 5);
}
