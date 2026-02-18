/**
 * Canonical JSON shapes for "Programs = Structure, Clients = Constraints".
 * Use these when building generator inputs and when persisting client presets
 * so structure lives only on programs and constraints only on clients.
 */

/** Client meal constraints only (no structure). Stored in presets_json.meal. */
export type MealConstraints = {
  caloriesTargetPerDay: number;
  budgetTier: "low" | "medium" | "high";
  allergies: string[];
  restrictions: string[];
  cookingTime?: "quick" | "normal" | "flexible";
};

/** Client workout constraints only (no structure). Stored in presets_json.workout. */
export type WorkoutConstraints = {
  equipmentType: "none" | "basic" | "gym";
  injuries?: string[];
  notes?: string;
};

/** Full client constraints (meal + workout). Shape for clients.presets_json when using constraints-only model. */
export type ClientConstraints = {
  meal: MealConstraints;
  workout: WorkoutConstraints;
};

/** Meal program structure only (no client-specific values). Stored in pt_meal_templates.defaults. */
export type MealProgramStructure = {
  dietaryPreference: "balanced" | "vegetarian" | "vegan" | "pescatarian";
  mealsPerDay: number;
  days: number;
  dietGoal: "lose" | "maintain" | "gain";
};
