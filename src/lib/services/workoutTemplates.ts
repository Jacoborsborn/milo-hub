/**
 * Browser-only service for workout templates (pt_templates).
 * Uses Supabase browser client so inserts run as the signed-in user (RLS).
 * Builds blueprint client-side so "Add to my library" works without calling the edge.
 */

import { supabaseBrowser } from "../supabase/client";
import { buildWorkoutBlueprint } from "../buildWorkoutBlueprint";

export type WorkoutTemplateDefaults = {
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_type: string;
  duration_weeks: number;
};

/**
 * Build a workout blueprint from defaults and insert into pt_templates
 * with pt_user_id = current user. No edge function call — works offline and avoids "no blueprint" errors.
 */
export async function createWorkoutTemplate(
  name: string,
  defaults: WorkoutTemplateDefaults
): Promise<void> {
  const supabase = supabaseBrowser();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();
  if (authError) throw authError;
  if (!session?.user) throw new Error("Not signed in");

  const blueprint_json = buildWorkoutBlueprint(defaults);

  const { error } = await supabase.from("pt_templates").insert({
    pt_user_id: session.user.id,
    name: name.trim(),
    goal: defaults.goal,
    experience_level: defaults.experience_level,
    days_per_week: defaults.days_per_week,
    equipment_type: defaults.equipment_type,
    duration_weeks: defaults.duration_weeks,
    blueprint_json,
  });
  if (error) throw error;
}
