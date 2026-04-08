"use server";

import { supabaseServer } from "../supabase/server";

const DEFAULT_MODEL = "gpt-4.1-mini";

/**
 * Generate a meal plan using the Edge Function
 * @param mealInputs - The meal inputs object
 * @param model - Optional model override (defaults to gpt-4.1-mini)
 * @returns The full raw response body from the generator (data.data object)
 */
export async function generateMeal(
  mealInputs: Record<string, any>,
  model: string = DEFAULT_MODEL
): Promise<Record<string, any>> {
  const supabase = await supabaseServer();

  // Get session for Authorization header
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("No active session found");
  }

  const { data, error } = await supabase.functions.invoke("pt-meal-generator", {
    body: { mealInputs },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    console.error("[generateMeal] Error:", error);
    throw new Error(`Failed to generate meal plan: ${error.message}`);
  }

  // pt-meal-generator returns { mealPlan, grocerySections, groceryTotals, notes }
  if (data?.mealPlan) {
    return data as Record<string, any>;
  }
  if (data?.data?.mealPlan) {
    return data.data as Record<string, any>;
  }

  throw new Error("No response data from generator");
}

/**
 * Generate a workout plan using the Edge Function
 * @param workoutInputs - The workout inputs object. When built from client presets (presets_json.workout), include:
 *   - workoutTypes: string[] (e.g. ["strength","hypertrophy"])
 *   - cardioDaysPerWeek: 0 | 1 | 2
 *   - resistanceDaysPerWeek: number (resistance training days)
 *   For backward compat with edge functions that expect daysPerWeek + workoutType: send daysPerWeek as total
 *   sessions (resistanceDaysPerWeek + cardioDaysPerWeek) and workoutType as workoutTypes[0] if needed.
 * @param model - Optional model override (defaults to gpt-4.1-mini)
 * @returns The full raw response body from the generator (data.data object)
 */
export async function generateWorkout(
  workoutInputs: Record<string, any>,
  model: string = DEFAULT_MODEL
): Promise<Record<string, any>> {
  const supabase = await supabaseServer();

  // Get session for Authorization header
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("No active session found");
  }

  const { data, error } = await supabase.functions.invoke("pt-generator", {
    body: {
      workoutInputs,
      model,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    console.error("[generateWorkout] Error:", error);
    throw new Error(`Failed to generate workout plan: ${error.message}`);
  }

  // Check for error in response
  if (data && !data.success) {
    throw new Error(data.error || "Failed to generate workout plan");
  }

  // Return the full raw response body (data.data contains the full response)
  if (data?.data) {
    return data.data;
  }

  throw new Error("No response data from generator");
}

/** Audit: set NEXT_PUBLIC_DEBUG_GENERATION=true to log (server reads same env for consistency). */
const DEBUG_GEN = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEBUG_GENERATION === "true";

/**
 * Generate a workout draft using pt-workout-generator (AI). Uses server session so no 401 from browser.
 * Returns the normalised plan and optionally rawResponse for debug. correlationId is sent to edge and logged.
 */
export async function generateWorkoutDraft(
  workoutInputs: Record<string, unknown>,
  model: string = DEFAULT_MODEL,
  correlationId?: string,
  coachMessage?: string
): Promise<{ plan: Record<string, unknown>; rawResponse?: unknown }> {
  const supabase = await supabaseServer();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("No active session found");
  }

  const body = {
    workoutInputs,
    model,
    ...(correlationId && { correlationId }),
    ...(coachMessage && { coachMessage }),
  };
  const { data, error } = await supabase.functions.invoke("pt-workout-generator", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (DEBUG_GEN && correlationId) {
    console.log(`[generateWorkoutDraft] correlationId=${correlationId} rawResponseLength=${typeof data === "object" ? JSON.stringify(data).length : 0}`, data);
  }

  if (error) {
    console.error("[generateWorkoutDraft] Error:", error);
    throw new Error(`Failed to generate workout draft: ${error.message}`);
  }

  const result = data as { ok?: boolean; plan?: Record<string, unknown>; error?: { message?: string } };
  if (!result?.ok || !result.plan) {
    throw new Error(result?.error?.message ?? "Invalid response from workout generator");
  }
  return { plan: result.plan, rawResponse: data };
}
