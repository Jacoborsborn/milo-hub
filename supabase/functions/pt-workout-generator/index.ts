// Supabase Edge Function: PT Workout Generator
// Generates workout plans using AI (extracted from meal-workout-generator).
// Called by PT Hub process route with workoutInputs; returns normalised plan for content_json.
// Job-based from UI: job created first, process route invokes this and waits, then saves plan.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import OpenAI from "npm:openai@4.77.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================================
// WORKOUT SYSTEM PROMPT (from meal-workout-generator / docs/chatgptpromptworkout.md)
// ============================================================================
const WORKOUT_SYSTEM_PROMPT = `You are an elite personal trainer generating weekly workout plans as STRICT JSON for the Milo app.

INPUTS include:
daysPerWeek, workoutType (Strength | Cardio | Hypertrophy | Calisthenics | combos),
sessionLengthMin, equipment, experience, workoutSplit, presetStyle,
coachNotes, restrictions, goals, sex, age, weight, height.

========================
GLOBAL HARD RULES
========================
- Output VALID JSON ONLY. No text outside JSON.
- JSON MUST match the schema exactly.
- Respect equipment, injuries, restrictions, and experience level.
- Never invent unsupported equipment.
- Place compound movements before accessory/isolation work.
- Use realistic volume for ONE person.

========================
PRIORITY ORDER (NON-NEGOTIABLE)
========================
1. Valid JSON structure
2. Session duration rule
3. Safety (injuries, restrictions, experience)
4. Split & workoutType logic
5. Everything else

========================
SESSION DURATION RULE (TOP-LEVEL)
========================
Each day MUST contain EXACTLY round(sessionLengthMin / 12) exercises.

Examples:
- 30 min → 3
- 45 min → 4
- 60 min → 5
- 90 min → 8

estimatedSessionMin must be within ±10 minutes of sessionLengthMin.
If any day violates this rule, the plan is INVALID and must be internally corrected before output.

========================
EXPERIENCE BIAS
========================
- BEGINNER:
- Prioritise safety, confidence, and learning movement patterns
- Prefer machines, supported movements, or simple dumbbell exercises over complex barbell lifts
- Avoid advanced variations (paused reps, tempos beyond basic control, unstable setups)
- Exercise selection should be easy to understand and repeat week-to-week
- Notes MUST emphasise setup, control, and purpose in plain language

INTERMEDIATE:
- Balanced mix of compound and accessory movements
- Introduce moderate variation while maintaining core lift consistency
- Can include standard barbell lifts and free-weight compounds
- Notes should focus on technical execution and muscle intent
- Avoid unnecessary complexity or advanced methods

ADVANCED:
- Prioritise movement quality, load management, and intelligent variation
- Include unilateral movements, challenging free-weight patterns, and secondary planes of motion
- Reduce reliance on machines unless used intentionally
- Exercise selection should challenge control, strength, and coordination
- Notes should be technical and performance-oriented

ATHLETE:
- Programming must reflect performance, robustness, and control — not simplicity
- Prioritise unilateral, multi-planar, and stability-demanding movements
- Include at least ONE per session:
  • Unilateral upper or lower movement
  • Anti-rotation or core stability demand
  • Explosive or athletic intent (even with moderate loads)
- Avoid overly basic isolation-only exercises unless clearly intentional
- Exercise selection should never resemble beginner or generic bodybuilding routines

========================
COACH NOTES & RESTRICTIONS
========================
- Injuries and pain override all other preferences.
- Substitute safer movements where required.
- Personal preferences are secondary to safety.

========================
EXERCISE NOTES (MANDATORY)
========================
Every strength or accessory exercise MUST include notes as an array of short bullet strings.

BASE BULLETS (ALL USERS):
- Tempo — Eccentric-Pause-Concentric (e.g. "2-1-2")
- Primary coaching cue
- Focus — primary muscle group

BEGINNER ADJUSTMENT (CRITICAL):
If experience is Beginner:
- Point 2 MUST be a simple setup or safety cue (e.g. stance, range, control)
- Point 3 MAY briefly explain the purpose of the movement in plain language
- Avoid jargon and advanced biomechanics

INTERMEDIATE+:
- Point 2 should be a technical form cue
- Point 3 should be purely muscle-focused

OPTIONAL POINT 4:
Only include if coachNotes or restrictions directly apply.

========================
WORKOUT TYPE LOGIC
========================
Strength:
- Compounds: 3–5 sets, 3–6 reps, 90–180s rest
- Accessories: 2–4 sets, 6–10 reps

Hypertrophy:
- Compounds: 3–4 sets, 8–12 reps
- Accessories: 2–3 sets, 10–15 reps

Calisthenics:
- Bodyweight movements scaled to experience

Mixed plans mean separate strength/hypertrophy/calisthenics days PLUS cardio days — never combined.

========================
CARDIO RULES (NON-NEGOTIABLE)
========================
- Cardio days are session-level summaries.
- A cardio day MUST contain:
  • Exactly ONE block of type "cardio"
  • Exactly ONE item named "Cardio Day"
- Cardio is time-based only (durationMin + intensity).
- No sets or reps.

CARDIO FREQUENCY:
- Mixed plans:
  • 1–5 days/week → exactly 1 cardio day
  • 6–7 days/week → exactly 2 cardio days
- Cardio-primary plans:
  • Cardio most days with varied intensity and recovery

========================
SPLIT LOGIC
========================
push/pull/legs:
- Push day = chest, shoulders, triceps
- Pull day = back, biceps
- Leg day = quads, hamstrings, glutes
- DO NOT COMBINE THEY ARE FOR SEPERATE DAYS: push, pull, legs

Arnold Split:
- chest & back
- Shoulders & arms 
- Legs

upper/lower:
- Alternate upper and lower body

full-body:
- Full-body compounds every session

bro-split:
- Chest, Back, Shoulders, Arms, Legs

custom:
- Follow user labels while maintaining weekly balance

MOVEMENT CLASSIFICATION:
- Deadlifts are hip hinge movements.
- Place them on leg, lower-body, or full-body days only.

========================
WEEKLY BALANCE RULE (CRITICAL)
========================
If a split includes Push, Pull, and Legs:
- Each must appear at least once across the week
- No type may repeat until all others have appeared
- Cardio days do NOT replace missing Push, Pull, or Legs days

========================
FOCUS PRESET ADJUSTMENTS
========================
Feminine:
- Higher lower-body and glute volume
- Reduced chest isolation

Masculine:
- Higher upper push/pull volume
- Reduced glute isolation

Neutral:
- Balanced volume

========================
OUTPUT SHAPE (STRICT)
========================
Return EXACTLY one JSON object with this structure:

{
  "plan_name": string,
  "generated_at": string,
  "daysPerWeek": number,
  "workoutType": string,
  "sessionLengthMinTarget": number,
  "split": string,
  "days": [
    {
      "dayIndex": number,
      "label": string,
      "primaryFocus": string,
      "estimatedSessionMin": number,
      "blocks": [
        {
          "blockType": "strength" | "accessory" | "cardio",
          "items": [
            {
              "name": string,
              "muscleGroup": string,
              "equipment": string,
              "sets": number | null,
              "reps": string | number | null,
              "durationMin": number | null,
              "restSec": number | null,
              "intensity": string | null,
              "notes": string[]
            }
          ]
        }
      ]
    }
  ]
}

Constraints:
- reps must exist (null or "N/A" allowed for cardio).
- durationMin must exist for cardio items.
- Never add or remove fields.
- notes MUST be an array of short bullet strings (no numbering).`;

// ============================================================================
// TYPES & HELPERS
// ============================================================================

interface WorkoutInputs {
  daysPerWeek?: number;
  days_per_week?: number;
  workoutType?: string | string[];
  sessionLengthMin?: number;
  equipment?: string;
  experience?: string;
  workoutSplit?: string;
  preset?: string;
  presetStyle?: string;
  coachNotes?: string;
  goals?: string;
  restrictions?: string[];
}

/** Derive days-per-week from multiple possible keys. Returns 0 if none valid (1–7). */
function deriveDaysPerWeek(input: Record<string, unknown>): number {
  const keys = [
    "daysPerWeek",
    "days_per_week",
    "days",
    "frequencyPerWeek",
    "trainingDaysPerWeek",
    "sessionsPerWeek",
  ];
  for (const k of keys) {
    const v = input[k];
    if (typeof v === "number" && !Number.isNaN(v) && v >= 1 && v <= 7) return Math.round(v);
    if (typeof v === "string") {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 7) return n;
    }
  }
  return 0;
}

function buildWorkoutUserPrompt(inputs: WorkoutInputs, derivedDaysPerWeek: number): string {
  const daysPerWeek = derivedDaysPerWeek >= 1 ? derivedDaysPerWeek : 4;
  const {
    workoutType = "Strength",
    sessionLengthMin = 45,
    equipment = "Full Gym",
    experience = "Intermediate",
    workoutSplit = "full-body",
    preset = "neutral",
    coachNotes = "",
    goals = "hypertrophy",
    restrictions = [],
  } = inputs as Record<string, unknown>;

  const presetStyle = inputs.presetStyle ?? preset;
  let workoutFocus = (workoutSplit || "full-body").replace(/-/g, " ") || "Full Body";

  let workoutTypeStr: string;
  let workoutTypesArray: string[] = [];
  let includesCardio = false;

  if (Array.isArray(workoutType)) {
    workoutTypesArray = workoutType.map((w) => String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase());
    workoutTypeStr = workoutTypesArray.join(" + ");
    includesCardio = workoutTypesArray.some((w) => String(w).toLowerCase() === "cardio");
  } else {
    workoutTypeStr = typeof workoutType === "string" ? workoutType : "Strength";
    const workoutTypeLower = workoutTypeStr.toLowerCase();
    if (workoutTypeLower.includes("+") || workoutTypeLower.includes(",")) {
      workoutTypesArray = workoutTypeStr.split(/[+,]/).map((w) => w.trim()).filter(Boolean);
      includesCardio = workoutTypesArray.some((w) => w.toLowerCase() === "cardio");
    } else {
      workoutTypesArray = [workoutTypeStr];
      includesCardio = workoutTypeLower === "cardio" || workoutTypeLower.includes("cardio");
    }
  }

  let presetInstructions = "";
  if (presetStyle === "feminine") {
    presetInstructions = "CRITICAL: FEMININE FOCUS - Prioritize glutes, legs, toning. ";
  } else if (presetStyle === "masculine") {
    presetInstructions = "CRITICAL: MASCULINE FOCUS - Prioritize upper body strength and size. ";
  }

  let userRequests = "";
  if (coachNotes) {
    userRequests += `\nCRITICAL USER REQUESTS: ${coachNotes}. You MUST incorporate these specific exercises/requests.`;
  }
  if (restrictions && restrictions.length > 0) {
    userRequests += `\nRESTRICTIONS: ${restrictions.join("; ")}.`;
  }

  let cardioInstructions = "";
  if (includesCardio) {
    if (workoutTypesArray.length > 1) {
      let distributionRule = "";
      if (daysPerWeek === 2) distributionRule = "Day 1 = other type, Day 2 = cardio";
      else if (daysPerWeek === 3) distributionRule = "Days 1-2 = other type, Day 3 = cardio";
      else if (daysPerWeek === 4) distributionRule = "Days 1-3 = other type, Day 4 = cardio";
      else if (daysPerWeek === 5) distributionRule = "Days 1-3,5 = other type, Day 4 = cardio";
      else if (daysPerWeek === 6) distributionRule = "Days 1-2,4-5 = other type, Days 3,6 = cardio";
      else if (daysPerWeek === 7) distributionRule = "Days 1-2,4-5,7 = other type, Days 3,6 = cardio";
      cardioInstructions = `\n\n🚨 CRITICAL: CARDIO DISTRIBUTION RULES\n- ${distributionRule}\n- Cardio days MUST use the "Cardio Day" format.`;
    } else {
      cardioInstructions = `\n\n🚨 CRITICAL: CARDIO-ONLY WORKOUT\n- ALL days must be cardio days using the "Cardio Day" format.`;
    }
  }

  const exerciseCount = Math.max(1, Math.round(sessionLengthMin / 12));
  return `${daysPerWeek}-day ${workoutTypeStr} plan for a ${experience} user training with ${equipment}, ${sessionLengthMin}min/day. Primary focus: ${workoutFocus}. Goal: ${goals}.
${presetInstructions}${userRequests}${cardioInstructions}

🚨 DURATION–EXERCISE RATIO (MANDATORY)
- Session length: ${sessionLengthMin} minutes → EXACTLY ${exerciseCount} exercises per day
- Formula: round(sessionLengthMin / 12) = exercise count. 12 minutes per exercise.
- Each day MUST have exactly ${exerciseCount} exercises – no more, no less.

EXERCISE STRUCTURE (REQUIRED):
- Every strength and accessory exercise MUST include: name, muscleGroup, equipment, sets, reps, restSec, notes (array of bullet strings with Tempo, Cue, Focus).
- Output ONLY JSON, no extra text.
- The 'days' array MUST contain EXACTLY ${daysPerWeek} objects.
- Each day label: "Training Day N - ${workoutFocus.charAt(0).toUpperCase() + workoutFocus.slice(1)}" where N = 1..${daysPerWeek}.
- Use only exercises that match the focus, equipment and restrictions.`;
}

function parseJSONResponse(content: string): Record<string, unknown> {
  let cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/g, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found in response");
  let jsonString = jsonMatch[0].replace(/,(\s*[}\]])/g, "$1").replace(/\s+/g, " ").trim();
  return JSON.parse(jsonString) as Record<string, unknown>;
}

function splitNotesToBullets(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0);
  }
  if (typeof input !== "string") return [];
  let s = input.trim();
  if (!s) return [];
  s = s.replace(
    /(\s*)(Tempo:|Focus:|Cue:|Setup:|Brace:|Rest:)/gi,
    (_m, _ws, label) => `\n${label}`
  );
  const rawParts = s
    .split(/\r?\n|•/g)
    .map((p) => p.trim())
    .filter(Boolean);
  return rawParts
    .map((p) => p.replace(/^[-–—]\s+/, "").replace(/^\d+[\).]\s+/, "").trim())
    .filter((p) => p.length > 0);
}

/** Normalise AI workout output to PT Hub plan shape (PlanRenderer: phases, weeks[].days[].exercises). Uses derivedDaysPerWeek so we always output that many days (pads if AI returned fewer). */
function normaliseWorkoutPlanToPTHub(
  aiPlan: Record<string, unknown>,
  derivedDaysPerWeek: number
): Record<string, unknown> {
  const rawDays = (aiPlan.days as Array<Record<string, unknown>>) ?? [];
  const planName = (aiPlan.plan_name as string) ?? "Workout Plan";
  const generatedAt = (aiPlan.generated_at as string) ?? new Date().toISOString();
  const daysPerWeek = derivedDaysPerWeek >= 1 ? derivedDaysPerWeek : Math.max(1, rawDays.length);
  const workoutType = (aiPlan.workoutType as string) ?? "Strength";
  const sessionLengthMinTarget = (aiPlan.sessionLengthMinTarget as number) ?? 45;
  const split = (aiPlan.split as string) ?? "full-body";

  const ptDays: Array<{ day_index: number; focus: string; exercises: Array<{ name: string; sets?: number; reps?: string; rest_sec?: number; notes?: string[]; pattern?: string }> }> = [];

  for (const d of rawDays) {
    const dayIndex = (d.dayIndex as number) ?? ptDays.length + 1;
    const label = (d.label as string) ?? `Day ${dayIndex}`;
    const primaryFocus = (d.primaryFocus as string) ?? label;
    const blocks = (d.blocks as Array<{ blockType?: string; items?: Array<Record<string, unknown>> }>) ?? [];
    const exercises: Array<{ name: string; sets?: number; reps?: string; rest_sec?: number; notes?: string[]; pattern?: string }> = [];

    for (const block of blocks) {
      const items = block.items ?? [];
      for (const it of items) {
        const name = (it.name as string) ?? "Exercise";
        const sets = it.sets as number | null | undefined;
        const reps = it.reps != null ? String(it.reps) : undefined;
        const restSec = it.restSec as number | null | undefined;
        const notesSource =
          (it.notes as unknown) ??
          (it.note as unknown) ??
          (it.notesText as unknown) ??
          (it.coachNotes as unknown) ??
          (it.instructions as unknown) ??
          "";
        const notes = splitNotesToBullets(notesSource);
        const muscleGroup = (it.muscleGroup as string) ?? "";
        exercises.push({
          name,
          ...(typeof sets === "number" && { sets }),
          ...(reps !== undefined && reps !== "null" && { reps }),
          ...(typeof restSec === "number" && { rest_sec: restSec }),
          ...(notes.length > 0 && { notes }),
          ...(muscleGroup && { pattern: muscleGroup }),
        });
      }
    }

    ptDays.push({
      day_index: dayIndex,
      focus: primaryFocus,
      exercises,
    });
  }

  while (ptDays.length < daysPerWeek) {
    ptDays.push({
      day_index: ptDays.length + 1,
      focus: `Training Day ${ptDays.length + 1}`,
      exercises: [],
    });
  }

  return {
    plan_name: planName,
    generated_at: generatedAt,
    daysPerWeek,
    workoutType,
    sessionLengthMinTarget,
    split,
    phases: [],
    weeks: [
      {
        week: 1,
        days: ptDays,
      },
    ],
  };
}

// ============================================================================
// HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !anonKey) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "CONFIG", message: "Server configuration error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!openaiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "CONFIG", message: "OPENAI_API_KEY not set" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: "Missing authorization header" } }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !user) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED", message: userError?.message ?? "Invalid token" } }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const workoutInputs = body.workoutInputs as Record<string, unknown> | undefined;
  if (!workoutInputs || typeof workoutInputs !== "object") {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "VALIDATION", message: "workoutInputs (object) is required" } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const derivedDaysPerWeek = deriveDaysPerWeek(workoutInputs);
  if (derivedDaysPerWeek < 1) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "INVALID_DAYS_PER_WEEK",
          message: "daysPerWeek must be >= 1",
          details: {
            receivedKeys: Object.keys(workoutInputs),
            received: workoutInputs,
          },
        },
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const model = (body.model as string) ?? "gpt-4.1-mini";
  const correlationId = body.correlationId as string | undefined;
  const coachMessageRaw = body.coachMessage;
  const coachMessage =
    typeof coachMessageRaw === "string" && coachMessageRaw.trim().length > 0
      ? coachMessageRaw.trim()
      : undefined;

  if (correlationId) {
    console.log("[pt-workout-generator] correlationId=" + correlationId + " received payload keys=" + JSON.stringify(Object.keys(body)));
    console.log(
      "[pt-workout-generator] correlationId=" +
        correlationId +
        " derivedDaysPerWeek=" +
        derivedDaysPerWeek +
        " coachMessageLength=" +
        (coachMessage?.length ?? 0) +
        " validated workoutInputs=" +
        JSON.stringify(workoutInputs)
    );
  }

  try {
    const userPrompt = buildWorkoutUserPrompt(workoutInputs as WorkoutInputs, derivedDaysPerWeek);
    if (correlationId) {
      console.log("[pt-workout-generator] correlationId=" + correlationId + " prompt length=" + userPrompt.length + " first500=" + userPrompt.slice(0, 500));
    }
    const openai = new OpenAI({ apiKey: openaiKey });
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 16000,
      temperature: 0.3,
      messages: [
        { role: "system", content: WORKOUT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      if (correlationId) console.log("[pt-workout-generator] correlationId=" + correlationId + " ERROR no content in model response");
      return new Response(
        JSON.stringify({ ok: false, error: { code: "GENERATION", message: "No content in model response" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (correlationId) {
      console.log("[pt-workout-generator] correlationId=" + correlationId + " raw model output length=" + content.length + " first1000=" + content.slice(0, 1000));
    }

    const rawPlan = parseJSONResponse(content);
    if (correlationId) {
      console.log("[pt-workout-generator] correlationId=" + correlationId + " parsed rawPlan keys=" + JSON.stringify(Object.keys(rawPlan)) + " full=" + JSON.stringify(rawPlan));
    }

    const plan = normaliseWorkoutPlanToPTHub(rawPlan, derivedDaysPerWeek);
    if (coachMessage) {
      (plan as Record<string, unknown>).coachMessage = coachMessage;
    }
    if (correlationId) {
      const weeks = (plan.weeks as unknown[]) ?? [];
      console.log("[pt-workout-generator] correlationId=" + correlationId + " normalised plan weeks.length=" + weeks.length + " full=" + JSON.stringify(plan));
    }

    return new Response(
      JSON.stringify({ ok: true, plan }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof Error && err.name ? err.name : "GENERATION";
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code,
          message,
          ...(err instanceof Error && err.stack && { details: err.stack }),
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
