// Supabase Edge Function: PT Template Generator
// Generates structured workout template JSON for PT Hub
// No database interaction - pure template generation

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================================
// INPUT VALIDATION
// ============================================================================

type Goal = "fat_loss" | "hypertrophy" | "strength" | "recomposition";
type ExperienceLevel = "beginner" | "intermediate" | "advanced";
type EquipmentType = "gym" | "home" | "minimal" | "mixed";
type SplitType = "full_body" | "upper_lower" | "full_body_alt" | "push_pull_legs_upper_lower" | "push_pull_legs_push_pull_legs" | "push_pull_legs_upper_lower_core_cardio";

interface TemplateInput {
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_type: string;
  duration_weeks?: number;
}

function validateInput(body: any): TemplateInput {
  const validGoals: Goal[] = ["fat_loss", "hypertrophy", "strength", "recomposition"];
  const validExperience: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];
  const validEquipment: EquipmentType[] = ["gym", "home", "minimal", "mixed"];

  if (!body.goal || !validGoals.includes(body.goal as Goal)) {
    throw new Error("Invalid goal. Must be: fat_loss, hypertrophy, strength, or recomposition");
  }

  if (!body.experience_level || !validExperience.includes(body.experience_level as ExperienceLevel)) {
    throw new Error("Invalid experience_level. Must be: beginner, intermediate, or advanced");
  }

  if (!body.days_per_week || typeof body.days_per_week !== "number" || body.days_per_week < 1 || body.days_per_week > 7) {
    throw new Error("Invalid days_per_week. Must be a number between 1 and 7");
  }

  if (!body.equipment_type || !validEquipment.includes(body.equipment_type as EquipmentType)) {
    throw new Error("Invalid equipment_type. Must be: gym, home, minimal, or mixed");
  }

  const duration_weeks = body.duration_weeks || 8;
  if (typeof duration_weeks !== "number" || duration_weeks < 1) {
    throw new Error("Invalid duration_weeks. Must be a positive number");
  }

  return {
    goal: body.goal as Goal,
    experience_level: body.experience_level as ExperienceLevel,
    days_per_week: body.days_per_week,
    equipment_type: body.equipment_type as EquipmentType,
    duration_weeks,
  };
}

// ============================================================================
// SPLIT LOGIC (HARDCODED)
// ============================================================================

function getSplitType(daysPerWeek: number): SplitType {
  switch (daysPerWeek) {
    case 1:
      return "full_body";
    case 2:
      return "upper_lower";
    case 3:
      return "full_body_alt";
    case 4:
      return "upper_lower";
    case 5:
      return "push_pull_legs_upper_lower";
    case 6:
      return "push_pull_legs_push_pull_legs";
    case 7:
      return "push_pull_legs_upper_lower_core_cardio";
    default:
      return "full_body";
  }
}

// ============================================================================
// MOVEMENT PATTERN MAPPING
// ============================================================================

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

function getMovementSlotsForFocus(focus: string): MovementPattern[] {
  const focusUpper = focus.toUpperCase();
  return MOVEMENT_PATTERNS[focusUpper] || [];
}

// ============================================================================
// VOLUME RULES
// ============================================================================

const COMPOUND_PATTERNS: MovementPattern[] = [
  "squat",
  "hinge",
  "lunge",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
];

const ISOLATION_PATTERNS: MovementPattern[] = [
  "bicep",
  "tricep",
  "lateral_raise",
  "calf",
];

const CORE_PATTERNS: MovementPattern[] = [
  "core_bracing",
  "core_rotation",
];

function getSetsForPattern(
  pattern: MovementPattern,
  experienceLevel: ExperienceLevel
): number {
  if (CORE_PATTERNS.includes(pattern)) {
    // Core: always 2-3 sets, use 3 for consistency
    return 3;
  }

  if (COMPOUND_PATTERNS.includes(pattern)) {
    switch (experienceLevel) {
      case "beginner":
        return 3;
      case "intermediate":
        return 4; // 3-4 sets, use 4
      case "advanced":
        return 4;
    }
  }

  if (ISOLATION_PATTERNS.includes(pattern)) {
    switch (experienceLevel) {
      case "beginner":
        return 3; // 2-3 sets, use 3
      case "intermediate":
        return 3;
      case "advanced":
        return 4; // 3-4 sets, use 4
    }
  }

  // Default for other patterns (light_cardio_slot)
  return 3;
}

function getRepsForPattern(pattern: MovementPattern, goal: Goal): string {
  if (CORE_PATTERNS.includes(pattern)) {
    return "12-20";
  }

  if (ISOLATION_PATTERNS.includes(pattern)) {
    return "10-15";
  }

  // Compounds
  if (goal === "strength") {
    return "6-10";
  } else if (goal === "fat_loss") {
    return "8-12";
  } else {
    // hypertrophy or recomposition
    return "8-12";
  }
}

// ============================================================================
// SPLIT GENERATION
// ============================================================================

function generateWeeklySplit(
  splitType: SplitType,
  daysPerWeek: number,
  experienceLevel: ExperienceLevel,
  goal: Goal
): Array<{
  day_index: number;
  focus: string;
  movement_slots: Array<{
    pattern: string;
    sets: number;
    reps: string;
  }>;
}> {
  const weeklySplit: Array<{
    day_index: number;
    focus: string;
    movement_slots: Array<{
      pattern: string;
      sets: number;
      reps: string;
    }>;
  }> = [];

  let dayIndex = 1;

  switch (splitType) {
    case "full_body":
      for (let i = 0; i < daysPerWeek; i++) {
        const slots = getMovementSlotsForFocus("FULL_BODY").map((pattern) => ({
          pattern,
          sets: getSetsForPattern(pattern, experienceLevel),
          reps: getRepsForPattern(pattern, goal),
        }));
        weeklySplit.push({
          day_index: dayIndex++,
          focus: "full_body",
          movement_slots: slots,
        });
      }
      break;

    case "upper_lower":
      for (let i = 0; i < daysPerWeek; i++) {
        const isUpper = i % 2 === 0;
        const slots = (isUpper ? getMovementSlotsForFocus("UPPER") : getMovementSlotsForFocus("LOWER")).map((pattern) => ({
          pattern,
          sets: getSetsForPattern(pattern, experienceLevel),
          reps: getRepsForPattern(pattern, goal),
        }));
        weeklySplit.push({
          day_index: dayIndex++,
          focus: isUpper ? "upper" : "lower",
          movement_slots: slots,
        });
      }
      break;

    case "full_body_alt":
      for (let i = 0; i < daysPerWeek; i++) {
        const slots = getMovementSlotsForFocus("FULL_BODY").map((pattern) => ({
          pattern,
          sets: getSetsForPattern(pattern, experienceLevel),
          reps: getRepsForPattern(pattern, goal),
        }));
        weeklySplit.push({
          day_index: dayIndex++,
          focus: "full_body",
          movement_slots: slots,
        });
      }
      break;

    case "push_pull_legs_upper_lower":
      const sequence = ["push", "pull", "legs", "upper", "lower"];
      for (let i = 0; i < daysPerWeek; i++) {
        const focus = sequence[i % sequence.length];
        let patterns: MovementPattern[];
        if (focus === "push") {
          patterns = getMovementSlotsForFocus("PUSH");
        } else if (focus === "pull") {
          patterns = getMovementSlotsForFocus("PULL");
        } else if (focus === "legs") {
          patterns = getMovementSlotsForFocus("LEGS");
        } else if (focus === "upper") {
          patterns = getMovementSlotsForFocus("UPPER");
        } else {
          patterns = getMovementSlotsForFocus("LOWER");
        }
        const slots = patterns.map((pattern) => ({
          pattern,
          sets: getSetsForPattern(pattern, experienceLevel),
          reps: getRepsForPattern(pattern, goal),
        }));
        weeklySplit.push({
          day_index: dayIndex++,
          focus,
          movement_slots: slots,
        });
      }
      break;

    case "push_pull_legs_push_pull_legs":
      const pplSequence = ["push", "pull", "legs"];
      for (let i = 0; i < daysPerWeek; i++) {
        const focus = pplSequence[i % pplSequence.length];
        let patterns: MovementPattern[];
        if (focus === "push") {
          patterns = getMovementSlotsForFocus("PUSH");
        } else if (focus === "pull") {
          patterns = getMovementSlotsForFocus("PULL");
        } else {
          patterns = getMovementSlotsForFocus("LEGS");
        }
        const slots = patterns.map((pattern) => ({
          pattern,
          sets: getSetsForPattern(pattern, experienceLevel),
          reps: getRepsForPattern(pattern, goal),
        }));
        weeklySplit.push({
          day_index: dayIndex++,
          focus,
          movement_slots: slots,
        });
      }
      break;

    case "push_pull_legs_upper_lower_core_cardio":
      const ppluSequence = ["push", "pull", "legs", "upper", "lower", "core", "cardio"];
      for (let i = 0; i < daysPerWeek; i++) {
        const focus = ppluSequence[i % ppluSequence.length];
        let patterns: MovementPattern[];
        if (focus === "push") {
          patterns = getMovementSlotsForFocus("PUSH");
        } else if (focus === "pull") {
          patterns = getMovementSlotsForFocus("PULL");
        } else if (focus === "legs") {
          patterns = getMovementSlotsForFocus("LEGS");
        } else if (focus === "upper") {
          patterns = getMovementSlotsForFocus("UPPER");
        } else if (focus === "lower") {
          patterns = getMovementSlotsForFocus("LOWER");
        } else {
          // core or cardio
          patterns = getMovementSlotsForFocus("CORE_DAY");
        }
        const slots = patterns.map((pattern) => ({
          pattern,
          sets: getSetsForPattern(pattern, experienceLevel),
          reps: getRepsForPattern(pattern, goal),
        }));
        weeklySplit.push({
          day_index: dayIndex++,
          focus,
          movement_slots: slots,
        });
      }
      break;
  }

  return weeklySplit;
}

// ============================================================================
// PHASE GENERATION
// ============================================================================

function generatePhases(durationWeeks: number): Array<{
  name: string;
  week_range: [number, number];
  volume_modifier: number;
}> {
  const phase1End = Math.floor(durationWeeks / 2);
  const phase2Start = phase1End + 1;

  return [
    {
      name: "Phase 1",
      week_range: [1, phase1End],
      volume_modifier: 1.0,
    },
    {
      name: "Phase 2",
      week_range: [phase2Start, durationWeeks],
      volume_modifier: 1.1,
    },
  ];
}

// ============================================================================
// SUGGESTED NAME GENERATION
// ============================================================================

function generateSuggestedName(
  durationWeeks: number,
  goal: Goal,
  daysPerWeek: number,
  splitType: SplitType
): string {
  const goalLabel = goal
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  let splitLabel = "";
  switch (splitType) {
    case "full_body":
      splitLabel = `${daysPerWeek} Day Full Body`;
      break;
    case "upper_lower":
      splitLabel = `${daysPerWeek} Day Upper/Lower`;
      break;
    case "full_body_alt":
      splitLabel = `${daysPerWeek} Day Full Body`;
      break;
    case "push_pull_legs_upper_lower":
      splitLabel = `${daysPerWeek} Day Push/Pull/Legs Upper/Lower`;
      break;
    case "push_pull_legs_push_pull_legs":
      splitLabel = `${daysPerWeek} Day Push/Pull/Legs`;
      break;
    case "push_pull_legs_upper_lower_core_cardio":
      splitLabel = `${daysPerWeek} Day Push/Pull/Legs Upper/Lower Core/Cardio`;
      break;
  }

  return `${durationWeeks} Week ${goalLabel} ${splitLabel} System`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await req.json();
    const input = validateInput(body);

    const splitType = getSplitType(input.days_per_week);
    const weeklySplit = generateWeeklySplit(
      splitType,
      input.days_per_week,
      input.experience_level,
      input.goal
    );
    const phases = generatePhases(input.duration_weeks);

    const blueprint_json = {
      version: 1,
      duration_weeks: input.duration_weeks,
      phases,
      weekly_split: weeklySplit,
    };

    const suggested_name = generateSuggestedName(
      input.duration_weeks,
      input.goal,
      input.days_per_week,
      splitType
    );

    return new Response(
      JSON.stringify({
        suggested_name,
        blueprint_json,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Invalid request",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
