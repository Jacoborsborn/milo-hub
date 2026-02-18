/**
 * Client presets shape stored in clients.presets_json
 */

export type MealPreset = {
  dietaryPreference: "balanced" | "vegetarian" | "vegan" | "pescatarian";
  caloriesTargetPerDay: number;
  mealsPerDay: number;
  days: number;
  dietGoal: "lose" | "maintain" | "gain";
  budgetTier: "low" | "medium" | "high";
  allergies: string[];
  restrictions: string[];
  cookingTime?: "quick" | "normal" | "flexible";
};

export const WORKOUT_TYPE_OPTIONS = ["strength", "hypertrophy", "cardio", "calisthenics"] as const;
export type WorkoutTypeOption = (typeof WORKOUT_TYPE_OPTIONS)[number];

export type WorkoutPreset = {
  /** Resistance training days per week (strength/hypertrophy/calisthenics). */
  daysPerWeek: number;
  /** Up to 2 types. Stored as workoutTypes in presets_json.workout. */
  workoutTypes: WorkoutTypeOption[];
  /** 0 = no cardio, 1 or 2 = cardio add-on days. */
  cardioDaysPerWeek: 0 | 1 | 2;
  equipmentType: "none" | "basic" | "gym";
  experienceLevel: "beginner" | "intermediate" | "advanced" | "athlete";
  workoutSplit: "push-pull-legs" | "upper-lower" | "full-body" | "arnold-split" | "bro-split";
  sessionLengthMin: 45 | 60 | 90;
};

export type ClientPresets = {
  meal: MealPreset;
  workout: WorkoutPreset;
};

export const DEFAULT_MEAL_PRESET: MealPreset = {
  dietaryPreference: "balanced",
  caloriesTargetPerDay: 2200,
  mealsPerDay: 4,
  days: 7,
  dietGoal: "maintain",
  budgetTier: "medium",
  allergies: [],
  restrictions: [],
};

export const DEFAULT_WORKOUT_PRESET: WorkoutPreset = {
  daysPerWeek: 4,
  workoutTypes: ["hypertrophy"],
  cardioDaysPerWeek: 0,
  equipmentType: "gym",
  experienceLevel: "beginner",
  workoutSplit: "upper-lower",
  sessionLengthMin: 60,
};

export const DEFAULT_PRESETS: ClientPresets = {
  meal: DEFAULT_MEAL_PRESET,
  workout: DEFAULT_WORKOUT_PRESET,
};

/** Parse raw JSON into meal preset, merging with defaults */
export function parseMealPreset(raw: unknown): MealPreset {
  if (!raw || typeof raw !== "object") return DEFAULT_MEAL_PRESET;
  const o = raw as Record<string, unknown>;
  return {
    dietaryPreference: ["balanced", "vegetarian", "vegan", "pescatarian"].includes(String(o.dietaryPreference ?? ""))
      ? (o.dietaryPreference as MealPreset["dietaryPreference"])
      : DEFAULT_MEAL_PRESET.dietaryPreference,
    caloriesTargetPerDay: Number(o.caloriesTargetPerDay) || DEFAULT_MEAL_PRESET.caloriesTargetPerDay,
    mealsPerDay: Number(o.mealsPerDay) || DEFAULT_MEAL_PRESET.mealsPerDay,
    days: Number(o.days) || DEFAULT_MEAL_PRESET.days,
    dietGoal: ["lose", "maintain", "gain"].includes(String(o.dietGoal ?? ""))
      ? (o.dietGoal as MealPreset["dietGoal"])
      : DEFAULT_MEAL_PRESET.dietGoal,
    budgetTier: ["low", "medium", "high"].includes(String(o.budgetTier ?? ""))
      ? (o.budgetTier as MealPreset["budgetTier"])
      : DEFAULT_MEAL_PRESET.budgetTier,
    allergies: Array.isArray(o.allergies) ? o.allergies.map(String) : [],
    restrictions: Array.isArray(o.restrictions) ? o.restrictions.map(String) : [],
    cookingTime: ["quick", "normal", "flexible"].includes(String(o.cookingTime ?? ""))
      ? (o.cookingTime as MealPreset["cookingTime"])
      : undefined,
  };
}

/** Parse raw JSON into workout preset, merging with defaults. Backward compat: single workoutType → workoutTypes. */
export function parseWorkoutPreset(raw: unknown): WorkoutPreset {
  if (!raw || typeof raw !== "object") return DEFAULT_WORKOUT_PRESET;
  const o = raw as Record<string, unknown>;
  const daysPerWeek = Number(o.daysPerWeek) ?? DEFAULT_WORKOUT_PRESET.daysPerWeek;
  let workoutTypes: WorkoutTypeOption[] = [];
  if (Array.isArray(o.workoutTypes)) {
    workoutTypes = o.workoutTypes
      .map((x) => String(x).toLowerCase())
      .filter((x): x is WorkoutTypeOption => WORKOUT_TYPE_OPTIONS.includes(x as WorkoutTypeOption))
      .slice(0, 2);
  }
  if (workoutTypes.length === 0 && o.workoutType != null && String(o.workoutType).trim() !== "") {
    const single = String(o.workoutType).toLowerCase();
    if (WORKOUT_TYPE_OPTIONS.includes(single as WorkoutTypeOption)) {
      workoutTypes = [single as WorkoutTypeOption];
    }
  }
  if (workoutTypes.length === 0) workoutTypes = ["hypertrophy"];

  const cardioRaw = Number(o.cardioDaysPerWeek);
  const cardioDaysPerWeek: 0 | 1 | 2 = [0, 1, 2].includes(cardioRaw) ? (cardioRaw as 0 | 1 | 2) : 0;

  return {
    daysPerWeek: Math.min(7, Math.max(1, daysPerWeek)),
    workoutTypes,
    cardioDaysPerWeek,
    equipmentType: ["none", "basic", "gym"].includes(String(o.equipmentType ?? ""))
      ? (o.equipmentType as WorkoutPreset["equipmentType"])
      : DEFAULT_WORKOUT_PRESET.equipmentType,
    experienceLevel: ["beginner", "intermediate", "advanced", "athlete"].includes(String(o.experienceLevel ?? ""))
      ? (o.experienceLevel as WorkoutPreset["experienceLevel"])
      : DEFAULT_WORKOUT_PRESET.experienceLevel,
    workoutSplit: ["push-pull-legs", "upper-lower", "full-body", "arnold-split", "bro-split"].includes(String(o.workoutSplit ?? ""))
      ? (o.workoutSplit as WorkoutPreset["workoutSplit"])
      : DEFAULT_WORKOUT_PRESET.workoutSplit,
    sessionLengthMin: [45, 60, 90].includes(Number(o.sessionLengthMin))
      ? (Number(o.sessionLengthMin) as 45 | 60 | 90)
      : DEFAULT_WORKOUT_PRESET.sessionLengthMin,
  };
}

/**
 * Build workoutInputs from template row (goal, experience_level, days_per_week, equipment_type).
 * Used when client has no workout presets (e.g. assign page).
 */
export function templateToWorkoutInputs(template: {
  goal?: string;
  experience_level?: string;
  days_per_week?: number;
  equipment_type?: string;
}): Record<string, unknown> {
  const equipmentMap: Record<string, string> = {
    minimal: "Minimal",
    home: "Home",
    gym: "Full Gym",
    none: "Minimal",
    basic: "Home",
  };
  const equipment =
    equipmentMap[String(template.equipment_type ?? "").toLowerCase()] ?? "Full Gym";
  const experience =
    String(template.experience_level ?? "intermediate").charAt(0).toUpperCase() +
    String(template.experience_level ?? "intermediate").slice(1).toLowerCase();
  return {
    daysPerWeek: Math.min(7, Math.max(1, template.days_per_week ?? 4)),
    workoutType: "Strength",
    sessionLengthMin: 60,
    equipment,
    experience,
    workoutSplit: "full-body",
    goals: template.goal ?? "hypertrophy",
    restrictions: [],
  };
}

/**
 * Map WorkoutPreset to pt-workout-generator workoutInputs (camelCase).
 * Used when creating AI workout jobs from client presets.
 */
export function workoutPresetToGeneratorInputs(preset: WorkoutPreset): Record<string, unknown> {
  const equipmentMap = { none: "Minimal", basic: "Home", gym: "Full Gym" } as const;
  const equipment = equipmentMap[preset.equipmentType] ?? "Full Gym";
  const experience =
    preset.experienceLevel.charAt(0).toUpperCase() + preset.experienceLevel.slice(1);
  const types = preset.workoutTypes.map(
    (t) => t.charAt(0).toUpperCase() + t.slice(1)
  );
  const workoutType = types.length > 1 ? types.join(" + ") : types[0] ?? "Strength";
  const totalDays =
    preset.daysPerWeek + (preset.cardioDaysPerWeek ?? 0);
  return {
    daysPerWeek: Math.min(7, totalDays),
    workoutType,
    sessionLengthMin: preset.sessionLengthMin,
    equipment,
    experience,
    workoutSplit: preset.workoutSplit,
    goals: preset.workoutTypes[0] ?? "hypertrophy",
    restrictions: [],
  };
}

/** Parse full presets_json from DB/client */
export function parsePresets(raw: unknown): ClientPresets {
  if (!raw || typeof raw !== "object") return DEFAULT_PRESETS;
  const o = raw as Record<string, unknown>;
  return {
    meal: parseMealPreset(o.meal),
    workout: parseWorkoutPreset(o.workout),
  };
}

/** Constraint-only shape for clients.presets_json. Structure comes from assigned programs. */
export type MealConstraintsOnly = Pick<MealPreset, "caloriesTargetPerDay" | "budgetTier" | "allergies" | "restrictions">;
export type WorkoutConstraintsOnly = Pick<WorkoutPreset, "equipmentType">;

/** Strip structure; persist only constraint fields to clients.presets_json. */
export function presetsToConstraintsOnly(presets: ClientPresets): {
  meal: MealConstraintsOnly;
  workout: WorkoutConstraintsOnly;
} {
  return {
    meal: {
      caloriesTargetPerDay: presets.meal.caloriesTargetPerDay,
      budgetTier: presets.meal.budgetTier,
      allergies: presets.meal.allergies ?? [],
      restrictions: presets.meal.restrictions ?? [],
    },
    workout: {
      equipmentType: presets.workout.equipmentType,
    },
  };
}
