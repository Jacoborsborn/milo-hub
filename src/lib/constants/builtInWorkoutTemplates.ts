/**
 * Built-in workout templates (client-side constants).
 * Not stored in DB until the PT clicks "Add to my library".
 * Defaults use the same schema as pt_templates / pt-template-generator:
 * goal, experience_level, days_per_week, equipment_type, duration_weeks (snake_case).
 */

/** Canonical shape for built-in workout defaults (API/DB snake_case). */
export type WorkoutBuiltInDefaults = {
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_type: string;
  duration_weeks: number;
};

export type BuiltInWorkoutTemplate = {
  name: string;
  defaults: WorkoutBuiltInDefaults;
  description?: string;
};

/** Legacy shape that normalization may receive (old keys). */
type LegacyWorkoutDefaults = Record<string, unknown> & {
  goal?: string;
  experience_level?: string;
  days_per_week?: number;
  equipment_type?: string;
  duration_weeks?: number;
  weeks?: number;
  days?: number;
  level?: string;
  equipment?: string;
};

const WORKOUT_DEFAULT_GOALS = ["fat_loss", "hypertrophy", "strength", "recomposition", "conditioning"] as const;
const WORKOUT_DEFAULT_LEVELS = ["beginner", "intermediate", "advanced", "athlete"] as const;
const WORKOUT_EQUIPMENT = ["gym", "home", "minimal", "mixed"] as const;

/**
 * Normalize legacy built-in preset defaults to canonical WorkoutBuiltInDefaults.
 * Tags/chips must be rendered from the returned fields only (no title parsing).
 */
export function normalizeWorkoutBuiltInDefaults(raw: LegacyWorkoutDefaults): WorkoutBuiltInDefaults {
  return {
    goal: typeof raw.goal === "string" && raw.goal ? raw.goal : "hypertrophy",
    experience_level:
      typeof raw.experience_level === "string" && raw.experience_level
        ? raw.experience_level
        : typeof raw.level === "string" && raw.level
          ? raw.level
          : "beginner",
    days_per_week:
      typeof raw.days_per_week === "number" && raw.days_per_week > 0
        ? raw.days_per_week
        : typeof raw.days === "number" && raw.days > 0
          ? raw.days
          : 3,
    equipment_type:
      typeof raw.equipment_type === "string" && raw.equipment_type
        ? raw.equipment_type
        : typeof raw.equipment === "string" && raw.equipment
          ? raw.equipment
          : "gym",
    duration_weeks:
      typeof raw.duration_weeks === "number" && raw.duration_weeks > 0
        ? raw.duration_weeks
        : typeof raw.weeks === "number" && raw.weeks > 0
          ? raw.weeks
          : 8,
  };
}

/** Return defaults suitable for createWorkoutTemplate (always canonical snake_case). */
export function getWorkoutDefaultsForApi(template: BuiltInWorkoutTemplate): WorkoutBuiltInDefaults {
  return normalizeWorkoutBuiltInDefaults(template.defaults as LegacyWorkoutDefaults);
}

function assertValidWorkoutBuiltIn(t: BuiltInWorkoutTemplate): void {
  if (!t.name || typeof t.name !== "string") throw new Error("Built-in workout preset missing name");
  const d = normalizeWorkoutBuiltInDefaults(t.defaults as LegacyWorkoutDefaults);
  if (!WORKOUT_DEFAULT_GOALS.includes(d.goal as (typeof WORKOUT_DEFAULT_GOALS)[number]))
    throw new Error(`Built-in workout "${t.name}" has invalid goal: ${d.goal}`);
  if (!WORKOUT_DEFAULT_LEVELS.includes(d.experience_level as (typeof WORKOUT_DEFAULT_LEVELS)[number]))
    throw new Error(`Built-in workout "${t.name}" has invalid experience_level: ${d.experience_level}`);
  if (!WORKOUT_EQUIPMENT.includes(d.equipment_type as (typeof WORKOUT_EQUIPMENT)[number]))
    throw new Error(`Built-in workout "${t.name}" has invalid equipment_type: ${d.equipment_type}`);
  if (d.days_per_week < 1 || d.days_per_week > 7)
    throw new Error(`Built-in workout "${t.name}" days_per_week out of range: ${d.days_per_week}`);
  if (d.duration_weeks < 1 || d.duration_weeks > 52)
    throw new Error(`Built-in workout "${t.name}" duration_weeks out of range: ${d.duration_weeks}`);
}

export const builtInWorkoutTemplates: BuiltInWorkoutTemplate[] = [
  {
    name: "8 Week Fat Loss – 3 Day Full Body (Gym)",
    description: "Full body 3x/week for fat loss.",
    defaults: { goal: "fat_loss", experience_level: "beginner", days_per_week: 3, equipment_type: "gym", duration_weeks: 8 },
  },
  {
    name: "8 Week Hypertrophy – 4 Day Upper/Lower (Gym)",
    description: "Upper/lower split for muscle gain.",
    defaults: { goal: "hypertrophy", experience_level: "beginner", days_per_week: 4, equipment_type: "gym", duration_weeks: 8 },
  },
  {
    name: "8 Week Strength – 3 Day (Gym)",
    description: "Full body strength focus.",
    defaults: { goal: "strength", experience_level: "intermediate", days_per_week: 3, equipment_type: "gym", duration_weeks: 8 },
  },
  {
    name: "8 Week PPL – 6 Day (Gym)",
    description: "Push / pull / legs 6-day split.",
    defaults: { goal: "hypertrophy", experience_level: "intermediate", days_per_week: 6, equipment_type: "gym", duration_weeks: 8 },
  },
  {
    name: "6 Week Beginner Starter – 3 Day (Home/Basic)",
    description: "Beginner full body at home.",
    defaults: { goal: "hypertrophy", experience_level: "beginner", days_per_week: 3, equipment_type: "home", duration_weeks: 6 },
  },
  {
    name: "8 Week Glute Focus – 4 Day (Gym)",
    description: "4-day upper/lower with lower emphasis.",
    defaults: { goal: "hypertrophy", experience_level: "beginner", days_per_week: 4, equipment_type: "gym", duration_weeks: 8 },
  },
  {
    name: "8 Week Athletic Conditioning – 4 Day (Gym)",
    description: "Strength and conditioning blend.",
    defaults: { goal: "fat_loss", experience_level: "advanced", days_per_week: 4, equipment_type: "gym", duration_weeks: 8 },
  },
  {
    name: "8 Week Calisthenics – 4 Day (None/Basic)",
    description: "Bodyweight-focused 4-day plan.",
    defaults: { goal: "hypertrophy", experience_level: "beginner", days_per_week: 4, equipment_type: "minimal", duration_weeks: 8 },
  },
  {
    name: "8 Week Powerbuilding – 4 Day (Gym)",
    description: "Strength and size 4-day.",
    defaults: { goal: "recomposition", experience_level: "advanced", days_per_week: 4, equipment_type: "gym", duration_weeks: 8 },
  },
  {
    name: "4 Week Minimalist – 2 Day (Gym)",
    description: "Short 2-day full body block.",
    defaults: { goal: "hypertrophy", experience_level: "beginner", days_per_week: 2, equipment_type: "gym", duration_weeks: 4 },
  },
  {
    name: "8 Week Cut + Cardio – 5 Day (Gym)",
    description: "5-day split for fat loss.",
    defaults: { goal: "fat_loss", experience_level: "intermediate", days_per_week: 5, equipment_type: "gym", duration_weeks: 8 },
  },
  {
    name: "8 Week Muscle Gain – 5 Day Bro Split (Gym)",
    description: "5-day hypertrophy split.",
    defaults: { goal: "hypertrophy", experience_level: "intermediate", days_per_week: 5, equipment_type: "gym", duration_weeks: 8 },
  },
];

// Dev-time: ensure every built-in has required fields and valid enums
if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
  builtInWorkoutTemplates.forEach(assertValidWorkoutBuiltIn);
}
