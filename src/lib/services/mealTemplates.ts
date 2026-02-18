/**
 * Browser-only service for pt_meal_templates RLS test.
 * Uses Supabase browser client so RLS runs as the signed-in user.
 * Do not use for production templates (use meal-templates.ts server actions instead).
 */

import { supabaseBrowser } from "../supabase/client";

export type MealTemplateRow = {
  id: string;
  name: string;
  defaults: Record<string, unknown>;
  created_at: string;
};

/**
 * Insert a row into pt_meal_templates with pt_user_id = current user.
 * Returns the inserted row or throws with full Supabase error.
 */
export async function createMealTemplate(
  name: string,
  defaults: Record<string, unknown>
): Promise<MealTemplateRow> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("pt_meal_templates")
    .insert({
      pt_user_id: user.id,
      name: name.trim(),
      defaults: defaults ?? {},
    })
    .select("id, name, defaults, created_at")
    .single();

  if (error) throw error;
  return data as MealTemplateRow;
}

/**
 * Select current user's templates: id, name, defaults, created_at, order by created_at desc.
 */
export async function listMealTemplates(): Promise<MealTemplateRow[]> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("pt_meal_templates")
    .select("id, name, defaults, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MealTemplateRow[];
}
