"use server";

import { supabaseServer } from "../supabase/server";
import { redirect } from "next/navigation";
import type { ProgramAssignment, ProgramAssignmentInsert, ProgramAssignmentUpdate } from "@/types/database";
import { listClients } from "./clients";
import { listPtTemplates } from "./ptTemplatesServer";
import { listMealTemplates } from "./meal-templates";

async function getCurrentUserId(): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/pt/auth/login");
  return data.user.id;
}

export async function listProgramAssignmentsByClient(
  clientId: string
): Promise<ProgramAssignment[]> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("program_assignments")
    .select("*")
    .eq("pt_user_id", ptUserId)
    .eq("client_id", clientId)
    .order("program_type");
  if (error) throw new Error(`Failed to list program assignments: ${error.message}`);
  return (data ?? []) as ProgramAssignment[];
}

export async function upsertProgramAssignment(
  clientId: string,
  programType: "workout" | "meal",
  programId: string,
  startDate: string,
  options?: { auto_generate_enabled?: boolean; autogen_lead_days?: number }
): Promise<ProgramAssignment> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data: existing } = await supabase
    .from("program_assignments")
    .select("id")
    .eq("pt_user_id", ptUserId)
    .eq("client_id", clientId)
    .eq("program_type", programType)
    .maybeSingle();

  const row: ProgramAssignmentInsert = {
    pt_user_id: ptUserId,
    client_id: clientId,
    program_type: programType,
    program_id: programId,
    start_date: startDate,
    auto_generate_enabled: options?.auto_generate_enabled ?? false,
    autogen_lead_days: options?.autogen_lead_days ?? 2,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("program_assignments")
      .update({
        program_id: programId,
        start_date: startDate,
        updated_at: new Date().toISOString(),
        ...(options && {
          auto_generate_enabled: options.auto_generate_enabled,
          autogen_lead_days: options.autogen_lead_days,
        }),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update program assignment: ${error.message}`);
    return data as ProgramAssignment;
  }

  const { data, error } = await supabase
    .from("program_assignments")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`Failed to create program assignment: ${error.message}`);
  return data as ProgramAssignment;
}

export async function updateProgramAssignment(
  assignmentId: string,
  payload: ProgramAssignmentUpdate
): Promise<ProgramAssignment> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.auto_generate_enabled !== undefined) updateData.auto_generate_enabled = payload.auto_generate_enabled;
  if (payload.autogen_lead_days !== undefined) updateData.autogen_lead_days = payload.autogen_lead_days;
  if (payload.paused !== undefined) updateData.paused = payload.paused;
  if (payload.start_date !== undefined) updateData.start_date = payload.start_date;
  if (payload.workout_template_id !== undefined) updateData.workout_template_id = payload.workout_template_id;
  if (payload.meal_template_id !== undefined) updateData.meal_template_id = payload.meal_template_id;
  if (payload.generate_on_dow !== undefined) updateData.generate_on_dow = payload.generate_on_dow;
  if (payload.active !== undefined) updateData.active = payload.active;
  if (payload.auto_meals_enabled !== undefined) updateData.auto_meals_enabled = payload.auto_meals_enabled;
  if (payload.auto_workouts_enabled !== undefined) updateData.auto_workouts_enabled = payload.auto_workouts_enabled;

  const { data, error } = await supabase
    .from("program_assignments")
    .update(updateData)
    .eq("id", assignmentId)
    .eq("pt_user_id", ptUserId)
    .select()
    .single();
  if (error) throw new Error(`Failed to update program assignment: ${error.message}`);
  return data as ProgramAssignment;
}

export async function deleteProgramAssignmentByProgram(
  clientId: string,
  programType: "workout" | "meal"
): Promise<void> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("program_assignments")
    .delete()
    .eq("pt_user_id", ptUserId)
    .eq("client_id", clientId)
    .eq("program_type", programType);
  if (error) throw new Error(`Failed to delete program assignment: ${error.message}`);
}

export async function deleteProgramAssignment(assignmentId: string): Promise<void> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("program_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("pt_user_id", ptUserId);
  if (error) throw new Error(`Failed to delete automation: ${error.message}`);
}

/** Create a single combined automation (one row: program_type='combined', program_id=null). */
export async function createAutomationAssignment(payload: {
  client_id: string;
  workout_template_id: string | null;
  meal_template_id: string | null;
  generate_on_dow: number;
  auto_meals_enabled: boolean;
  auto_workouts_enabled: boolean;
}): Promise<ProgramAssignment> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  if (payload.auto_meals_enabled && !payload.meal_template_id) throw new Error("Select a meal template when Auto-generate Meals is on.");
  if (payload.auto_workouts_enabled && !payload.workout_template_id) throw new Error("Select a workout template when Auto-generate Workouts is on.");
  if (!payload.auto_meals_enabled && !payload.auto_workouts_enabled) throw new Error("Turn on at least one of Meals or Workouts.");
  const startDate = new Date().toISOString().slice(0, 10);

  const row: ProgramAssignmentInsert = {
    pt_user_id: ptUserId,
    client_id: payload.client_id,
    program_type: "combined",
    program_id: null,
    start_date: startDate,
    auto_generate_enabled: true,
    paused: false,
    active: true,
    workout_template_id: payload.workout_template_id ?? null,
    meal_template_id: payload.meal_template_id ?? null,
    generate_on_dow: Math.min(6, Math.max(0, payload.generate_on_dow)),
    auto_meals_enabled: payload.auto_meals_enabled,
    auto_workouts_enabled: payload.auto_workouts_enabled,
  };

  const { data, error } = await supabase
    .from("program_assignments")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`Failed to create automation: ${error.message}`);
  return data as ProgramAssignment;
}

export type AutomationContext = {
  clients: { id: string; name: string }[];
  workoutTemplates: { id: string; name: string }[];
  mealTemplates: { id: string; name: string }[];
};

export async function getAutomationContext(): Promise<AutomationContext> {
  const [clients, workoutTemplates, mealTemplates] = await Promise.all([
    listClients().then((c) => c.map((x) => ({ id: x.id, name: x.name }))),
    listPtTemplates(),
    listMealTemplates().then((m) => m.map((x) => ({ id: x.id, name: x.name }))),
  ]);
  return { clients, workoutTemplates, mealTemplates };
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const add = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

export async function saveClientAssignmentsAndAutogen(
  clientId: string,
  payload: {
    assignedWorkoutProgramId: string | null;
    assignedMealProgramId: string | null;
    workoutStartDate?: string;
    workoutAutoGen?: boolean;
    workoutLeadDays?: number;
    mealStartDate?: string;
    mealAutoGen?: boolean;
    mealLeadDays?: number;
  }
): Promise<void> {
  const { updateClient } = await import("./clients");
  await updateClient(clientId, {
    assigned_workout_program_id: payload.assignedWorkoutProgramId,
    assigned_meal_program_id: payload.assignedMealProgramId,
  });

  if (payload.assignedWorkoutProgramId) {
    await upsertProgramAssignment(
      clientId,
      "workout",
      payload.assignedWorkoutProgramId,
      payload.workoutStartDate ?? nextMonday(),
      {
        auto_generate_enabled: payload.workoutAutoGen ?? false,
        autogen_lead_days: Math.min(6, Math.max(0, payload.workoutLeadDays ?? 2)),
      }
    );
  } else {
    await deleteProgramAssignmentByProgram(clientId, "workout");
  }

  if (payload.assignedMealProgramId) {
    await upsertProgramAssignment(
      clientId,
      "meal",
      payload.assignedMealProgramId,
      payload.mealStartDate ?? nextMonday(),
      {
        auto_generate_enabled: payload.mealAutoGen ?? false,
        autogen_lead_days: Math.min(6, Math.max(0, payload.mealLeadDays ?? 2)),
      }
    );
  } else {
    await deleteProgramAssignmentByProgram(clientId, "meal");
  }
}
