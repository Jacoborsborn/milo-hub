/**
 * Client-side workout blueprint builder.
 * Produces the same shape as pt-template-generator edge function so we can
 * "Add to my library" and create programs without calling the edge.
 */

export type WorkoutBlueprintDefaults = {
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_type: string;
  duration_weeks: number;
};

type Goal = "fat_loss" | "hypertrophy" | "strength" | "recomposition";
type ExperienceLevel = "beginner" | "intermediate" | "advanced";
type SplitType =
  | "full_body"
  | "upper_lower"
  | "full_body_alt"
  | "push_pull_legs_upper_lower"
  | "push_pull_legs_push_pull_legs"
  | "push_pull_legs_upper_lower_core_cardio";

type MovementPattern =
  | "squat"
  | "horizontal_push"
  | "horizontal_pull"
  | "hinge"
  | "core_bracing"
  | "vertical_push"
  | "vertical_pull"
  | "lateral_raise"
  | "bicep"
  | "tricep"
  | "lunge"
  | "calf"
  | "core_rotation"
  | "light_cardio_slot";

const MOVEMENT_PATTERNS: Record<string, MovementPattern[]> = {
  FULL_BODY: ["squat", "horizontal_push", "horizontal_pull", "hinge", "core_bracing"],
  UPPER: ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "lateral_raise", "bicep", "tricep"],
  LOWER: ["squat", "hinge", "lunge", "calf", "core_bracing"],
  PUSH: ["horizontal_push", "vertical_push", "lateral_raise", "tricep"],
  PULL: ["horizontal_pull", "vertical_pull", "bicep"],
  LEGS: ["squat", "hinge", "lunge", "calf", "core_bracing"],
  CORE_DAY: ["core_bracing", "core_rotation", "light_cardio_slot"],
};

const COMPOUND_PATTERNS: MovementPattern[] = [
  "squat", "hinge", "lunge", "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull",
];
const ISOLATION_PATTERNS: MovementPattern[] = ["bicep", "tricep", "lateral_raise", "calf"];
const CORE_PATTERNS: MovementPattern[] = ["core_bracing", "core_rotation"];

function getSplitType(daysPerWeek: number): SplitType {
  switch (daysPerWeek) {
    case 1: return "full_body";
    case 2: return "upper_lower";
    case 3: return "full_body_alt";
    case 4: return "upper_lower";
    case 5: return "push_pull_legs_upper_lower";
    case 6: return "push_pull_legs_push_pull_legs";
    case 7: return "push_pull_legs_upper_lower_core_cardio";
    default: return "full_body";
  }
}

function getMovementSlotsForFocus(focus: string): MovementPattern[] {
  const key = focus.toUpperCase().replace(/ /g, "_");
  if (key === "CORE" || key === "CARDIO") return MOVEMENT_PATTERNS.CORE_DAY;
  return MOVEMENT_PATTERNS[key] ?? MOVEMENT_PATTERNS.FULL_BODY;
}

function getSetsForPattern(pattern: MovementPattern, experienceLevel: ExperienceLevel): number {
  if (CORE_PATTERNS.includes(pattern)) return 3;
  if (COMPOUND_PATTERNS.includes(pattern)) {
    return experienceLevel === "beginner" ? 3 : 4;
  }
  if (ISOLATION_PATTERNS.includes(pattern)) {
    return experienceLevel === "advanced" ? 4 : 3;
  }
  return 3;
}

function getRepsForPattern(pattern: MovementPattern, goal: Goal): string {
  if (CORE_PATTERNS.includes(pattern)) return "12-20";
  if (ISOLATION_PATTERNS.includes(pattern)) return "10-15";
  return goal === "strength" ? "6-10" : "8-12";
}

function normalizeGoal(goal: string): Goal {
  const g = goal?.toLowerCase();
  if (g === "fat_loss" || g === "hypertrophy" || g === "strength" || g === "recomposition") return g as Goal;
  return "hypertrophy";
}

function normalizeExperienceLevel(level: string): ExperienceLevel {
  const l = level?.toLowerCase();
  if (l === "beginner" || l === "intermediate" || l === "advanced") return l as ExperienceLevel;
  return "beginner";
}

export type BlueprintJson = {
  version: number;
  duration_weeks: number;
  phases: Array<{ name: string; week_range: [number, number]; volume_modifier: number }>;
  weekly_split: Array<{
    day_index: number;
    focus: string;
    movement_slots: Array<{ pattern: string; sets: number; reps: string }>;
  }>;
};

function generatePhases(durationWeeks: number): BlueprintJson["phases"] {
  const phase1End = Math.floor(durationWeeks / 2);
  const phase2Start = phase1End + 1;
  return [
    { name: "Phase 1", week_range: [1, phase1End], volume_modifier: 1.0 },
    { name: "Phase 2", week_range: [phase2Start, durationWeeks], volume_modifier: 1.1 },
  ];
}

function generateWeeklySplit(
  splitType: SplitType,
  daysPerWeek: number,
  experienceLevel: ExperienceLevel,
  goal: Goal
): BlueprintJson["weekly_split"] {
  const weeklySplit: BlueprintJson["weekly_split"] = [];
  let dayIndex = 1;

  const addDay = (focus: string) => {
    const patterns = getMovementSlotsForFocus(focus);
    const slots = patterns.map((pattern) => ({
      pattern,
      sets: getSetsForPattern(pattern, experienceLevel),
      reps: getRepsForPattern(pattern, goal),
    }));
    weeklySplit.push({ day_index: dayIndex++, focus, movement_slots: slots });
  };

  switch (splitType) {
    case "full_body":
      for (let i = 0; i < daysPerWeek; i++) addDay("full_body");
      break;
    case "upper_lower":
      for (let i = 0; i < daysPerWeek; i++) addDay(i % 2 === 0 ? "upper" : "lower");
      break;
    case "full_body_alt":
      for (let i = 0; i < daysPerWeek; i++) addDay("full_body");
      break;
    case "push_pull_legs_upper_lower": {
      const sequence = ["push", "pull", "legs", "upper", "lower"];
      for (let i = 0; i < daysPerWeek; i++) addDay(sequence[i % sequence.length]);
      break;
    }
    case "push_pull_legs_push_pull_legs": {
      const ppl = ["push", "pull", "legs"];
      for (let i = 0; i < daysPerWeek; i++) addDay(ppl[i % ppl.length]);
      break;
    }
    case "push_pull_legs_upper_lower_core_cardio": {
      const seq = ["push", "pull", "legs", "upper", "lower", "core", "cardio"];
      for (let i = 0; i < daysPerWeek; i++) addDay(seq[i % seq.length]);
      break;
    }
    default:
      for (let i = 0; i < daysPerWeek; i++) addDay("full_body");
  }

  return weeklySplit;
}

/**
 * Build a workout blueprint from defaults (same shape as pt-template-generator).
 * Use this for "Add to my library" and optional fallback for create so we don't depend on the edge.
 */
export function buildWorkoutBlueprint(defaults: WorkoutBlueprintDefaults): BlueprintJson {
  const goal = normalizeGoal(defaults.goal);
  const experienceLevel = normalizeExperienceLevel(defaults.experience_level);
  const daysPerWeek = Math.max(1, Math.min(7, Math.floor(defaults.days_per_week) || 3));
  const durationWeeks = Math.max(1, Math.min(52, Math.floor(defaults.duration_weeks) || 8));

  const splitType = getSplitType(daysPerWeek);
  const weekly_split = generateWeeklySplit(splitType, daysPerWeek, experienceLevel, goal);
  const phases = generatePhases(durationWeeks);

  return {
    version: 1,
    duration_weeks: durationWeeks,
    phases,
    weekly_split,
  };
}
