/**
 * Built-in meal templates (client-side constants).
 * Not stored in DB until the PT clicks "Add to my library".
 * Create-program inputs: name, diet, mealsPerDay, days, goal.
 * We store dietaryPreference + dietGoal for DB/form compatibility; chips render from these.
 */

/** Canonical shape for built-in meal defaults (required fields for create-program). */
export type MealBuiltInDefaults = {
  dietaryPreference: string;
  mealsPerDay: number;
  days: number;
  dietGoal: string;
  /** Optional; for assign flow. Not used for chips. */
  caloriesTargetPerDay?: number;
  budgetTier?: string;
  allergies?: string[];
  restrictions?: string[];
  [key: string]: unknown;
};

export type BuiltInMealTemplate = {
  name: string;
  defaults: MealBuiltInDefaults;
  description?: string;
};

/** Legacy shape that normalization may receive. */
type LegacyMealDefaults = Record<string, unknown> & {
  dietaryPreference?: string;
  diet?: string;
  mealsPerDay?: number;
  days?: number;
  dietGoal?: string;
  goal?: string;
};

/**
 * Normalize legacy built-in meal defaults to canonical shape.
 * Tags/chips must be rendered from the returned fields only (no title parsing).
 */
export function normalizeMealBuiltInDefaults(raw: LegacyMealDefaults): MealBuiltInDefaults {
  const diet = typeof raw.dietaryPreference === "string" && raw.dietaryPreference
    ? raw.dietaryPreference
    : typeof raw.diet === "string" && raw.diet
      ? raw.diet
      : "balanced";
  const goal = typeof raw.dietGoal === "string" && raw.dietGoal
    ? raw.dietGoal
    : typeof raw.goal === "string" && raw.goal
      ? raw.goal
      : "maintain";
  const base: MealBuiltInDefaults = {
    dietaryPreference: diet,
    mealsPerDay: typeof raw.mealsPerDay === "number" && raw.mealsPerDay > 0 ? raw.mealsPerDay : 4,
    days: typeof raw.days === "number" && raw.days > 0 ? raw.days : 7,
    dietGoal: goal,
    caloriesTargetPerDay: typeof raw.caloriesTargetPerDay === "number" ? raw.caloriesTargetPerDay : undefined,
    budgetTier: typeof raw.budgetTier === "string" ? raw.budgetTier : undefined,
    allergies: Array.isArray(raw.allergies) ? raw.allergies : undefined,
    restrictions: Array.isArray(raw.restrictions) ? raw.restrictions : undefined,
  };
  // Preserve any extra keys (e.g. bulkStyle, cookingTime) for assign flow
  const rest = { ...raw };
  delete rest.dietaryPreference;
  delete rest.diet;
  delete rest.mealsPerDay;
  delete rest.days;
  delete rest.dietGoal;
  delete rest.goal;
  delete rest.caloriesTargetPerDay;
  delete rest.budgetTier;
  delete rest.allergies;
  delete rest.restrictions;
  return { ...rest, ...base };
}

/** Return defaults suitable for createMealTemplate (canonical + extra keys). */
export function getMealDefaultsForApi(template: BuiltInMealTemplate): MealBuiltInDefaults {
  return normalizeMealBuiltInDefaults(template.defaults as LegacyMealDefaults);
}

function assertValidMealBuiltIn(t: BuiltInMealTemplate): void {
  if (!t.name || typeof t.name !== "string") throw new Error("Built-in meal preset missing name");
  const d = normalizeMealBuiltInDefaults(t.defaults as LegacyMealDefaults);
  if (!d.dietaryPreference || typeof d.dietaryPreference !== "string")
    throw new Error(`Built-in meal "${t.name}" missing or invalid dietaryPreference`);
  if (!d.dietGoal || typeof d.dietGoal !== "string")
    throw new Error(`Built-in meal "${t.name}" missing or invalid dietGoal`);
  if (d.mealsPerDay < 1 || d.mealsPerDay > 7)
    throw new Error(`Built-in meal "${t.name}" mealsPerDay out of range: ${d.mealsPerDay}`);
  if (d.days < 1 || d.days > 90)
    throw new Error(`Built-in meal "${t.name}" days out of range: ${d.days}`);
}

export const builtInMealTemplates: BuiltInMealTemplate[] = [
  {
    name: "7 Day Lean (Balanced)",
    description: "Balanced 7-day plan focused on lean loss.",
    defaults: { dietaryPreference: "balanced", caloriesTargetPerDay: 2000, mealsPerDay: 4, days: 7, dietGoal: "lose", budgetTier: "medium", allergies: [], restrictions: [] },
  },
  {
    name: "7 Day Fat Loss (High Protein)",
    description: "High-protein fat loss week.",
    defaults: { dietaryPreference: "balanced", caloriesTargetPerDay: 1900, mealsPerDay: 4, days: 7, dietGoal: "lose", budgetTier: "medium", allergies: [], restrictions: [], bulkStyle: "high-protein" },
  },
  {
    name: "7 Day Maintenance (Simple 3 Meals)",
    description: "Simple 3-meal maintenance plan.",
    defaults: { dietaryPreference: "balanced", caloriesTargetPerDay: 2200, mealsPerDay: 3, days: 7, dietGoal: "maintain", budgetTier: "medium", allergies: [], restrictions: [] },
  },
  {
    name: "7 Day Clean Bulk",
    description: "Higher calories for clean muscle gain.",
    defaults: { dietaryPreference: "balanced", caloriesTargetPerDay: 2800, mealsPerDay: 4, days: 7, dietGoal: "gain", budgetTier: "high", allergies: [], restrictions: [] },
  },
  {
    name: "Budget Cut (Low)",
    description: "Low-budget calorie deficit.",
    defaults: { dietaryPreference: "balanced", caloriesTargetPerDay: 1900, mealsPerDay: 4, days: 7, dietGoal: "lose", budgetTier: "low", allergies: [], restrictions: [] },
  },
  {
    name: "Budget Maintenance (Low)",
    description: "Low-budget maintenance.",
    defaults: { dietaryPreference: "balanced", caloriesTargetPerDay: 2200, mealsPerDay: 4, days: 7, dietGoal: "maintain", budgetTier: "low", allergies: [], restrictions: [] },
  },
  {
    name: "High Protein Budget (Low)",
    description: "High-protein, low-budget maintenance.",
    defaults: { dietaryPreference: "balanced", caloriesTargetPerDay: 2300, mealsPerDay: 4, days: 7, dietGoal: "maintain", budgetTier: "low", allergies: [], restrictions: [], bulkStyle: "high-protein" },
  },
  {
    name: "Vegetarian Lean",
    description: "Vegetarian plan for lean loss.",
    defaults: { dietaryPreference: "vegetarian", caloriesTargetPerDay: 2000, mealsPerDay: 4, days: 7, dietGoal: "lose", budgetTier: "medium", allergies: [], restrictions: [] },
  },
  {
    name: "Vegan Budget",
    description: "Vegan, low-budget maintenance.",
    defaults: { dietaryPreference: "vegan", caloriesTargetPerDay: 2200, mealsPerDay: 4, days: 7, dietGoal: "maintain", budgetTier: "low", allergies: [], restrictions: [] },
  },
  {
    name: "Pescatarian Lean",
    description: "Pescatarian lean loss.",
    defaults: { dietaryPreference: "pescatarian", caloriesTargetPerDay: 2100, mealsPerDay: 4, days: 7, dietGoal: "lose", budgetTier: "medium", allergies: [], restrictions: [] },
  },
  {
    name: "Quick Prep (15-min focus)",
    description: "Meals geared to quick prep.",
    defaults: { dietaryPreference: "balanced", caloriesTargetPerDay: 2200, mealsPerDay: 4, days: 7, dietGoal: "maintain", budgetTier: "medium", allergies: [], restrictions: [], cookingTime: "quick" },
  },
  {
    name: "High Satiety (Volume)",
    description: "Higher volume, 3 meals for satiety.",
    defaults: { dietaryPreference: "balanced", caloriesTargetPerDay: 2000, mealsPerDay: 3, days: 7, dietGoal: "lose", budgetTier: "medium", allergies: [], restrictions: [], bulkStyle: "high-volume" },
  },
];

// Dev-time: ensure every built-in has required fields
if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
  builtInMealTemplates.forEach(assertValidMealBuiltIn);
}
