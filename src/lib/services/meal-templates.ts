"use server";

import { supabaseServer } from "../supabase/server";
import { redirect } from "next/navigation";
import type { MealTemplate, MealTemplateInsert, MealTemplateUpdate } from "@/types/database";

async function getCurrentUserId(): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/pt/auth/login");
  return data.user.id;
}

export async function listMealTemplates(): Promise<MealTemplate[]> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("pt_meal_templates")
    .select("*")
    .eq("pt_user_id", ptUserId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list meal templates: ${error.message}`);
  return (data ?? []) as MealTemplate[];
}

export async function getMealTemplateById(id: string): Promise<MealTemplate | null> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("pt_meal_templates")
    .select("*")
    .eq("id", id)
    .eq("pt_user_id", ptUserId)
    .single();
  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(`Failed to get meal template: ${error.message}`);
  return data as MealTemplate;
}

export async function createMealTemplate(payload: MealTemplateInsert): Promise<MealTemplate> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("pt_meal_templates")
    .insert({
      pt_user_id: ptUserId,
      name: payload.name.trim(),
      defaults: payload.defaults ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create meal template: ${error.message}`);
  return data as MealTemplate;
}

export async function updateMealTemplate(
  id: string,
  payload: MealTemplateUpdate
): Promise<MealTemplate> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const updateData: Record<string, unknown> = {};
  if (payload.name !== undefined) updateData.name = payload.name.trim();
  if (payload.defaults !== undefined) updateData.defaults = payload.defaults;
  const { data, error } = await supabase
    .from("pt_meal_templates")
    .update(updateData)
    .eq("id", id)
    .eq("pt_user_id", ptUserId)
    .select()
    .single();
  if (error?.code === "PGRST116") throw new Error("Meal template not found");
  if (error) throw new Error(`Failed to update meal template: ${error.message}`);
  return data as MealTemplate;
}

export async function deleteMealTemplate(id: string): Promise<void> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("pt_meal_templates")
    .delete()
    .eq("id", id)
    .eq("pt_user_id", ptUserId);
  if (error) throw new Error(`Failed to delete meal template: ${error.message}`);
}
