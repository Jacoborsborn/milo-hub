"use server";

import { supabaseServer } from "../supabase/server";
import { redirect } from "next/navigation";
import { requireClientCapacityOrThrow, requireWritableAccessOrThrow } from "./subscription";
import type { Client, ClientInsert, ClientUpdate, ClientInputsJson } from "../../types/database";

/**
 * Get the current authenticated PT user ID
 * Throws and redirects if not authenticated
 */
async function getCurrentUserId(): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/pt/auth/login");
  }

  return data.user.id;
}

/**
 * List all clients for the current PT user
 */
export async function listClients(): Promise<Client[]> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("pt_id", ptUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listClients] Error:", error);
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }

  return (data || []) as Client[];
}

/**
 * Get a single client by ID (ensures it belongs to current PT)
 */
export async function getClientById(id: string): Promise<Client | null> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("pt_id", ptUserId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("[getClientById] Error:", error);
    throw new Error(`Failed to fetch client: ${error.message}`);
  }

  return data as Client;
}

/**
 * Create a new client for the current PT user
 */
export async function createClient(payload: ClientInsert): Promise<Client> {
  const ptUserId = await getCurrentUserId();
  await requireClientCapacityOrThrow(ptUserId);
  await requireWritableAccessOrThrow();

  // Validate required fields
  if (!payload.name || payload.name.trim() === "") {
    throw new Error("Full name is required");
  }

  const supabase = await supabaseServer();

  const insertPayload: Record<string, unknown> = {
    pt_id: ptUserId,
    name: payload.name.trim(),
    email: payload.email?.trim() || null,
    notes: payload.notes?.trim() || null,
    inputs_json: payload.inputs_json ?? { mealInputs: {}, workoutInputs: {} },
  };
  if (payload.presets_json !== undefined && payload.presets_json !== null) {
    insertPayload.presets_json = payload.presets_json;
  }
  if (payload.assigned_workout_program_id !== undefined) {
    insertPayload.assigned_workout_program_id = payload.assigned_workout_program_id || null;
  }
  if (payload.assigned_meal_program_id !== undefined) {
    insertPayload.assigned_meal_program_id = payload.assigned_meal_program_id || null;
  }

  const { data, error } = await supabase
    .from("clients")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("[createClient] Error:", error);
    throw new Error(`Failed to create client: ${error.message}`);
  }

  return data as Client;
}

/**
 * Update an existing client (ensures it belongs to current PT)
 */
export async function updateClient(id: string, payload: ClientUpdate): Promise<Client> {
  const ptUserId = await getCurrentUserId();

  // Validate name if provided
  if (payload.name !== undefined && payload.name.trim() === "") {
    throw new Error("Full name cannot be empty");
  }

  // Normalize inputs_json if provided to guarantee stable shape
  let normalizedInputs: ClientInputsJson | undefined;
  if (payload.inputs_json !== undefined) {
    normalizedInputs = {
      mealInputs: payload.inputs_json.mealInputs ?? {},
      workoutInputs: payload.inputs_json.workoutInputs ?? {},
    };
  }

  const supabase = await supabaseServer();

  const updateData: any = {};
  if (payload.name !== undefined) {
    updateData.name = payload.name.trim();
  }
  if (payload.email !== undefined) {
    updateData.email = payload.email?.trim() || null;
  }
  if (payload.notes !== undefined) {
    updateData.notes = payload.notes?.trim() || null;
  }
  if (normalizedInputs !== undefined) {
    updateData.inputs_json = normalizedInputs;
  }
  if (payload.meal_inputs_last_used !== undefined) {
    updateData.meal_inputs_last_used = payload.meal_inputs_last_used;
  }
  if (payload.presets_json !== undefined) {
    updateData.presets_json = payload.presets_json;
  }
  if (payload.assigned_workout_program_id !== undefined) {
    updateData.assigned_workout_program_id = payload.assigned_workout_program_id || null;
  }
  if (payload.assigned_meal_program_id !== undefined) {
    updateData.assigned_meal_program_id = payload.assigned_meal_program_id || null;
  }

  const { data, error } = await supabase
    .from("clients")
    .update(updateData)
    .eq("id", id)
    .eq("pt_id", ptUserId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Client not found or you don't have permission to update it");
    }
    console.error("[updateClient] Error:", error);
    throw new Error(`Failed to update client: ${error.message}`);
  }

  return data as Client;
}

/**
 * Delete a client (ensures it belongs to current PT)
 */
export async function deleteClient(id: string): Promise<void> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("pt_id", ptUserId);

  if (error) {
    console.error("[deleteClient] Error:", error);
    throw new Error(`Failed to delete client: ${error.message}`);
  }
}
