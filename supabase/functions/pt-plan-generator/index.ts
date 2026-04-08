// Supabase Edge Function: PT Plan Generator
// Generates workout plan drafts from templates for clients
// No database writes - returns draft plan JSON only

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// FIX #1: Allow all origins in development (or specify your actual origin)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // ✅ Changed from http://localhost:3000
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================================
// TYPES
// ============================================================================

type EquipmentType = "gym" | "home" | "minimal" | "mixed";
type MovementPattern =
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "core_bracing"
  | "core_rotation"
  | "calf"
  | "bicep"
  | "tricep"
  | "lateral_raise";

interface TemplateStructure {
  version: number;
  duration_weeks: number;
  phases: Array<{
    name: string;
    week_range: [number, number];
    volume_modifier: number;
  }>;
  weekly_split: Array<{
    day_index: number;
    focus: string;
    movement_slots: Array<{
      pattern: string;
      sets: number;
      reps: string;
    }>;
  }>;
}

interface Exercise {
  pattern: string;
  name: string;
  sets: number;
  reps: string;
  rest_sec: number;
  notes: string;
}

interface Day {
  day_index: number;
  focus: string;
  exercises: Exercise[];
}

interface Week {
  week: number;
  days: Day[];
}

interface PlanOutput {
  template_id: string;
  client_id: string;
  generated_at: string;
  duration_weeks: number;
  phases: Array<{
    name: string;
    week_range: [number, number];
    volume_modifier: number;
  }>;
  weeks: Week[];
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function validateInput(body: any): { template_id: string; client_id: string; user_id: string } {
  if (!body.template_id || typeof body.template_id !== "string") {
    throw new Error("template_id is required and must be a string");
  }
  if (!validateUUID(body.template_id)) {
    throw new Error("template_id must be a valid UUID");
  }

  if (!body.client_id || typeof body.client_id !== "string") {
    throw new Error("client_id is required and must be a string");
  }
  if (!validateUUID(body.client_id)) {
    throw new Error("client_id must be a valid UUID");
  }

  if (!body.user_id || typeof body.user_id !== "string") {
    throw new Error("user_id is required and must be a string");
  }
  if (!validateUUID(body.user_id)) {
    throw new Error("user_id must be a valid UUID");
  }

  return {
    template_id: body.template_id,
    client_id: body.client_id,
    user_id: body.user_id,
  };
}

// ============================================================================
// EXERCISE MAPPING (DETERMINISTIC)
// ============================================================================

const EXERCISE_MAP: Record<EquipmentType, Record<MovementPattern, string[]>> = {
  gym: {
    horizontal_push: ["Barbell Bench Press", "Dumbbell Bench Press", "Chest Press Machine"],
    vertical_push: ["Overhead Press", "Dumbbell Shoulder Press", "Machine Shoulder Press"],
    horizontal_pull: ["Barbell Row", "Cable Row", "Seated Row Machine"],
    vertical_pull: ["Pull-ups", "Lat Pulldown", "Cable Lat Pulldown"],
    squat: ["Barbell Back Squat", "Leg Press", "Hack Squat"],
    hinge: ["Deadlift", "Romanian Deadlift", "Hip Thrust"],
    lunge: ["Walking Lunges", "Bulgarian Split Squat", "Reverse Lunge"],
    core_bracing: ["Plank", "Dead Bug", "Pallof Press"],
    core_rotation: ["Russian Twist", "Cable Wood Chop", "Medicine Ball Rotation"],
    calf: ["Standing Calf Raise", "Seated Calf Raise", "Calf Press"],
    bicep: ["Barbell Curl", "Dumbbell Curl", "Cable Curl"],
    tricep: ["Tricep Dips", "Overhead Extension", "Cable Pushdown"],
    lateral_raise: ["Dumbbell Lateral Raise", "Cable Lateral Raise", "Machine Lateral Raise"],
  },
  home: {
    horizontal_push: ["Dumbbell Floor Press", "Push-ups", "Resistance Band Press"],
    vertical_push: ["Pike Push-ups", "Dumbbell Shoulder Press", "Handstand Push-ups"],
    horizontal_pull: ["Resistance Band Row", "Inverted Row", "Dumbbell Row"],
    vertical_pull: ["Pull-ups", "Resistance Band Pulldown", "Chin-ups"],
    squat: ["Goblet Squat", "Pistol Squat", "Jump Squat"],
    hinge: ["Dumbbell Romanian Deadlift", "Single Leg Deadlift", "Good Morning"],
    lunge: ["Walking Lunges", "Bulgarian Split Squat", "Reverse Lunge"],
    core_bracing: ["Plank", "Dead Bug", "Side Plank"],
    core_rotation: ["Russian Twist", "Bicycle Crunch", "Wood Chop"],
    calf: ["Calf Raise", "Single Leg Calf Raise", "Jump Rope"],
    bicep: ["Dumbbell Curl", "Resistance Band Curl", "Hammer Curl"],
    tricep: ["Diamond Push-ups", "Overhead Extension", "Tricep Dips"],
    lateral_raise: ["Dumbbell Lateral Raise", "Resistance Band Lateral Raise", "Pike Push-ups"],
  },
  minimal: {
    horizontal_push: ["Push-ups", "Pike Push-ups", "Diamond Push-ups"],
    vertical_push: ["Pike Push-ups", "Handstand Push-ups", "Wall Walk"],
    horizontal_pull: ["Inverted Row", "Resistance Band Row", "Bodyweight Row"],
    vertical_pull: ["Pull-ups", "Chin-ups", "Negative Pull-ups"],
    squat: ["Bodyweight Squat", "Jump Squat", "Pistol Squat"],
    hinge: ["Single Leg Deadlift", "Good Morning", "Hip Thrust"],
    lunge: ["Walking Lunges", "Reverse Lunge", "Bulgarian Split Squat"],
    core_bracing: ["Plank", "Dead Bug", "Side Plank"],
    core_rotation: ["Russian Twist", "Bicycle Crunch", "Wood Chop"],
    calf: ["Calf Raise", "Single Leg Calf Raise", "Jump Rope"],
    bicep: ["Resistance Band Curl", "Bodyweight Curl", "Chin-up Hold"],
    tricep: ["Diamond Push-ups", "Tricep Dips", "Pike Push-ups"],
    lateral_raise: ["Resistance Band Lateral Raise", "Bodyweight Lateral Raise", "Wall Lateral Raise"],
  },
  mixed: {
    // Treat mixed as gym for now
    horizontal_push: ["Barbell Bench Press", "Dumbbell Bench Press", "Chest Press Machine"],
    vertical_push: ["Overhead Press", "Dumbbell Shoulder Press", "Machine Shoulder Press"],
    horizontal_pull: ["Barbell Row", "Cable Row", "Seated Row Machine"],
    vertical_pull: ["Pull-ups", "Lat Pulldown", "Cable Lat Pulldown"],
    squat: ["Barbell Back Squat", "Leg Press", "Hack Squat"],
    hinge: ["Deadlift", "Romanian Deadlift", "Hip Thrust"],
    lunge: ["Walking Lunges", "Bulgarian Split Squat", "Reverse Lunge"],
    core_bracing: ["Plank", "Dead Bug", "Pallof Press"],
    core_rotation: ["Russian Twist", "Cable Wood Chop", "Medicine Ball Rotation"],
    calf: ["Standing Calf Raise", "Seated Calf Raise", "Calf Press"],
    bicep: ["Barbell Curl", "Dumbbell Curl", "Cable Curl"],
    tricep: ["Tricep Dips", "Overhead Extension", "Cable Pushdown"],
    lateral_raise: ["Dumbbell Lateral Raise", "Cable Lateral Raise", "Machine Lateral Raise"],
  },
};

function getExerciseForPattern(
  pattern: MovementPattern,
  equipmentType: EquipmentType,
  dayIndex: number
): string {
  const exercises = EXERCISE_MAP[equipmentType]?.[pattern];
  if (!exercises || exercises.length === 0) {
    return `${pattern} (${equipmentType})`;
  }
  // Deterministic: rotate by day index
  const index = (dayIndex - 1) % exercises.length;
  return exercises[index];
}

function getRestTime(pattern: MovementPattern): number {
  const compounds = ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "squat", "hinge", "lunge"];
  const isolation = ["bicep", "tricep", "lateral_raise", "calf"];
  const core = ["core_bracing", "core_rotation"];

  if (compounds.includes(pattern)) {
    return 120;
  }
  if (isolation.includes(pattern)) {
    return 75;
  }
  if (core.includes(pattern)) {
    return 60;
  }
  return 90; // Default
}

function getNotesForExercise(pattern: MovementPattern, name: string): string {
  const compounds = ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "squat", "hinge", "lunge"];
  
  if (compounds.includes(pattern)) {
    return "Controlled eccentric, full ROM.";
  }
  if (pattern === "core_bracing") {
    return "Maintain neutral spine.";
  }
  if (pattern === "core_rotation") {
    return "Control rotation, brace core.";
  }
  return "Focus on form.";
}

// ============================================================================
// PLAN GENERATION
// ============================================================================

function generatePlan(structure: TemplateStructure, equipmentType: EquipmentType): PlanOutput {
  const weeks: Week[] = [];

  for (let weekNum = 1; weekNum <= structure.duration_weeks; weekNum++) {
    const days: Day[] = [];

    for (const dayConfig of structure.weekly_split) {
      const exercises: Exercise[] = [];

      for (const slot of dayConfig.movement_slots) {
        const exerciseName = getExerciseForPattern(
          slot.pattern as MovementPattern,
          equipmentType,
          dayConfig.day_index
        );

        exercises.push({
          pattern: slot.pattern,
          name: exerciseName,
          sets: slot.sets,
          reps: slot.reps,
          rest_sec: getRestTime(slot.pattern as MovementPattern),
          notes: getNotesForExercise(slot.pattern as MovementPattern, exerciseName),
        });
      }

      days.push({
        day_index: dayConfig.day_index,
        focus: dayConfig.focus,
        exercises,
      });
    }

    weeks.push({ week: weekNum, days });
  }

  return {
    template_id: "",
    client_id: "",
    generated_at: new Date().toISOString(),
    duration_weeks: structure.duration_weeks,
    phases: structure.phases,
    weeks,
  };
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    console.log("[EDGE FUNCTION] Starting request handler");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    console.log("[EDGE FUNCTION] Request body:", {
      hasTemplateId: !!body.template_id,
      hasClientId: !!body.client_id,
      hasUserId: !!body.user_id,
      mode: body.mode,
    });

    const autogenSecret = Deno.env.get("AUTOGEN_SECRET");
    const isAutogenWeek = Boolean(
      autogenSecret &&
      body.autogen_secret === autogenSecret &&
      body.assignment_id &&
      typeof body.week_number === "number" &&
      body.week_number >= 1
    );

    if (isAutogenWeek) {
      const assignmentId = body.assignment_id as string;
      const weekNumber = body.week_number as number;
      if (!validateUUID(assignmentId)) {
        return new Response(
          JSON.stringify({ error: "assignment_id must be a valid UUID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceRoleKey) {
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: assignment, error: assignErr } = await supabase
        .from("program_assignments")
        .select("id, pt_user_id, client_id, program_id, program_type, workout_template_id")
        .eq("id", assignmentId)
        .single();
      if (assignErr || !assignment) {
        return new Response(
          JSON.stringify({ error: "Assignment not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const isWorkout = assignment.program_type === "workout";
      const isCombined = assignment.program_type === "combined";
      const template_id = isCombined
        ? (assignment.workout_template_id ?? assignment.program_id)
        : assignment.program_id;
      if (!template_id || (!isWorkout && !isCombined)) {
        return new Response(
          JSON.stringify({ error: "Assignment not found or not a workout program" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const ptUserId = assignment.pt_user_id;
      const client_id = assignment.client_id;
      const { data: profile } = await supabase.from("profiles").select("access_mode").eq("id", ptUserId).single();
      if (profile?.access_mode === "readonly") {
        return new Response(
          JSON.stringify({ code: "READ_ONLY_MODE", message: "Subscription invalid" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: template, error: templateError } = await supabase
        .from("pt_templates")
        .select("id, blueprint_json, equipment_type, experience_level")
        .eq("id", template_id)
        .eq("pt_user_id", ptUserId)
        .single();
      if (templateError || !template) {
        return new Response(
          JSON.stringify({ error: "Template not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, pt_id, inputs_json, presets_json")
        .eq("id", client_id)
        .eq("pt_id", ptUserId)
        .single();
      if (clientError || !client) {
        return new Response(
          JSON.stringify({ error: "Client not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const presetEquipment = (client.presets_json as { workout?: { equipmentType?: string } } | null)?.workout?.equipmentType;
      const legacyEquipment = (client.inputs_json as { workoutInputs?: { equipment?: string } } | null)?.workoutInputs?.equipment;
      const presetToTemplate: Record<string, EquipmentType> = { none: "minimal", basic: "home", gym: "gym" };
      let equipmentType: EquipmentType = template.equipment_type as EquipmentType;
      if (presetEquipment && presetToTemplate[presetEquipment]) {
        equipmentType = presetToTemplate[presetEquipment];
      } else if (legacyEquipment && ["gym", "home", "minimal", "mixed"].includes(legacyEquipment)) {
        equipmentType = legacyEquipment as EquipmentType;
      }
      const structure = template.blueprint_json as TemplateStructure;
      if (!structure?.weekly_split || !Array.isArray(structure.weekly_split)) {
        return new Response(
          JSON.stringify({ error: "Invalid template structure" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const plan = generatePlan(structure, equipmentType);
      const weekIndex = weekNumber - 1;
      if (!plan.weeks || weekIndex >= plan.weeks.length) {
        return new Response(
          JSON.stringify({ error: "week_number out of bounds for template duration" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const weekContent = plan.weeks[weekIndex];
      const sourceHash = JSON.stringify({
        template_id,
        blueprint_version: structure.version ?? 0,
        equipmentType,
        client_presets: (client.presets_json as Record<string, unknown>) ?? {},
      });
      return new Response(
        JSON.stringify({
          week: weekContent,
          source_hash: sourceHash.length > 512 ? sourceHash.slice(0, 512) : sourceHash,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let template_id: string;
    let client_id: string;
    let user_id: string;
    const isRegenerateWeek = body.mode === "regenerate_week";

    if (isRegenerateWeek) {
      if (!body.user_id || typeof body.user_id !== "string" || body.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "User ID mismatch or missing" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const weekIndex = body.weekIndex;
      const existingPlan = body.existingPlan;
      if (typeof weekIndex !== "number" || weekIndex < 0) {
        return new Response(
          JSON.stringify({ error: "weekIndex is required and must be a non-negative number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!existingPlan || typeof existingPlan !== "object") {
        return new Response(
          JSON.stringify({ error: "existingPlan is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      template_id = existingPlan.template_id ?? body.template_id;
      client_id = existingPlan.client_id ?? body.client_id;
      if (!template_id || !validateUUID(template_id) || !client_id || !validateUUID(client_id)) {
        return new Response(
          JSON.stringify({ error: "template_id and client_id must be valid UUIDs (from existingPlan or body)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      user_id = body.user_id;
    } else {
      const validated = validateInput(body);
      template_id = validated.template_id;
      client_id = validated.client_id;
      user_id = validated.user_id;
    }

    // Verify JWT user matches user_id in body (skip for autogen invocation)
    if (!isAutogenWeek && user.id !== user_id) {
      console.error("[EDGE FUNCTION] JWT user mismatch:", {
        jwtUserId: user.id,
        bodyUserId: user_id,
      });
      return new Response(
        JSON.stringify({ error: "User ID mismatch" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const ptUserId = user_id;
    console.log("[EDGE FUNCTION] PT user id:", ptUserId);

    // Check service role key for database operations
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("[EDGE FUNCTION] Environment check:", {
      hasServiceRoleKey: !!serviceRoleKey,
      keyLength: serviceRoleKey?.length || 0,
    });

    if (!serviceRoleKey) {
      console.error("[EDGE FUNCTION] Missing SUPABASE_SERVICE_ROLE_KEY!");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role key for privileged database operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log("[EDGE FUNCTION] Service role client created for DB operations");

    // Check access mode
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("access_mode")
      .eq("id", ptUserId)
      .single();

    if (profileError || !profile) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "Failed to load profile" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (profile.access_mode === "readonly") {
      console.log("Read-only mode blocked:", ptUserId);
      return new Response(
        JSON.stringify({
          code: "READ_ONLY_MODE",
          message: "Upgrade to regain full access.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("template_id:", template_id, "client_id:", client_id);

    // Verify template ownership (pt_templates uses blueprint_json only — no structure_json)
    const { data: template, error: templateError } = await supabase
      .from("pt_templates")
      .select("id, blueprint_json, equipment_type, experience_level")
      .eq("id", template_id)
      .eq("pt_user_id", ptUserId)
      .single();

    if (templateError || !template) {
      console.error("Template error:", templateError);
      return new Response(
        JSON.stringify({ error: "Template not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Dev safeguard: if template JSON column is missing, log for debugging
    if (template.blueprint_json == null) {
      console.error("[pt-plan-generator] Template blueprint_json is undefined", {
        template_id,
        template_row: template,
      });
    }

    // Verify client ownership
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, pt_id, inputs_json, presets_json")
      .eq("id", client_id)
      .eq("pt_id", ptUserId)
      .single();

    if (clientError || !client) {
      console.error("Client error:", clientError);
      return new Response(
        JSON.stringify({ error: "Client not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get equipment type (prefer client presets_json.workout, then legacy inputs_json, then template)
    const presetEquipment = (client.presets_json as { workout?: { equipmentType?: string } } | null)?.workout?.equipmentType;
    const legacyEquipment = (client.inputs_json as { workoutInputs?: { equipment?: string } } | null)?.workoutInputs?.equipment;
    const presetToTemplate: Record<string, EquipmentType> = { none: "minimal", basic: "home", gym: "gym" };
    let equipmentType: EquipmentType = template.equipment_type as EquipmentType;
    if (presetEquipment && presetToTemplate[presetEquipment]) {
      equipmentType = presetToTemplate[presetEquipment];
    } else if (legacyEquipment && ["gym", "home", "minimal", "mixed"].includes(legacyEquipment)) {
      equipmentType = legacyEquipment as EquipmentType;
    }

    console.log("equipment_type used:", equipmentType);

    // Parse template structure (pt_templates.blueprint_json only)
    const blueprint = template.blueprint_json ?? null;
    const structure = blueprint as TemplateStructure;
    if (!structure || !structure.weekly_split || !Array.isArray(structure.weekly_split)) {
      return new Response(
        JSON.stringify({ error: "Invalid template structure" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate plan
    const plan = generatePlan(structure, equipmentType);
    plan.template_id = template_id;
    plan.client_id = client_id;

    if (isRegenerateWeek) {
      const weekIndex = body.weekIndex as number;
      if (!Array.isArray(plan.weeks) || weekIndex >= plan.weeks.length) {
        return new Response(
          JSON.stringify({ error: "weekIndex out of bounds for generated plan" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const week = plan.weeks[weekIndex];
      console.log("Regenerate week completed for weekIndex:", weekIndex);
      return new Response(JSON.stringify({ week }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Plan generated successfully");

    return new Response(JSON.stringify(plan), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[EDGE FUNCTION] Error caught:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
      fullError: error,
    });
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: error instanceof Error && errorMessage.includes("required") ? 400 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});