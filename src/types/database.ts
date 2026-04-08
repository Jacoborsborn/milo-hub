/**
 * Database types for Milo PT Hub
 * These types match the Supabase database schema
 */

export type ClientInputsJson = {
  mealInputs: Record<string, any>;
  workoutInputs: Record<string, any>;
};

import type { MealPreset, WorkoutPreset, MealConstraintsOnly, WorkoutConstraintsOnly } from "./presets";

export type ClientPresetsJson = {
  meal?: MealPreset | MealConstraintsOnly;
  workout?: WorkoutPreset | WorkoutConstraintsOnly;
};

export type MealInputsLastUsed = Record<string, unknown>;

export interface Client {
  id: string;
  pt_id: string;
  name: string;
  email: string | null;
  notes: string | null;
  inputs_json: ClientInputsJson;
  presets_json?: ClientPresetsJson | null;
  meal_inputs_last_used?: MealInputsLastUsed | null;
  assigned_workout_program_id: string | null;
  assigned_meal_program_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInsert {
  name: string;
  email?: string | null;
  notes?: string | null;
  inputs_json?: ClientInputsJson;
  presets_json?: ClientPresetsJson | null;
  assigned_workout_program_id?: string | null;
  assigned_meal_program_id?: string | null;
}

export interface ClientUpdate {
  name?: string;
  email?: string | null;
  notes?: string | null;
  inputs_json?: ClientInputsJson;
  presets_json?: ClientPresetsJson | null;
  meal_inputs_last_used?: MealInputsLastUsed | null;
  assigned_workout_program_id?: string | null;
  assigned_meal_program_id?: string | null;
}

export interface MealTemplate {
  id: string;
  pt_user_id: string;
  name: string;
  defaults: Record<string, unknown>;
  created_at: string;
}

export interface MealTemplateInsert {
  name: string;
  defaults: Record<string, unknown>;
}

export interface MealTemplateUpdate {
  name?: string;
  defaults?: Record<string, unknown>;
}

export type PlanType = "meal" | "workout";

export type PlanReviewStatus = "draft" | "ready" | "sent";

export type ProgramAssignmentType = "workout" | "meal" | "combined";

export interface ProgramAssignment {
  id: string;
  pt_user_id: string;
  client_id: string;
  program_type: ProgramAssignmentType;
  program_id: string | null;
  start_date: string;
  auto_generate_enabled: boolean;
  autogen_lead_days: number;
  paused: boolean;
  workout_template_id?: string | null;
  meal_template_id?: string | null;
  generate_on_dow: number;
  active: boolean;
  auto_meals_enabled?: boolean;
  auto_workouts_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramAssignmentInsert {
  pt_user_id: string;
  client_id: string;
  program_type: ProgramAssignmentType;
  program_id?: string | null;
  start_date: string;
  auto_generate_enabled?: boolean;
  autogen_lead_days?: number;
  paused?: boolean;
  workout_template_id?: string | null;
  meal_template_id?: string | null;
  generate_on_dow?: number;
  active?: boolean;
  auto_meals_enabled?: boolean;
  auto_workouts_enabled?: boolean;
}

export interface ProgramAssignmentUpdate {
  auto_generate_enabled?: boolean;
  autogen_lead_days?: number;
  paused?: boolean;
  start_date?: string;
  workout_template_id?: string | null;
  meal_template_id?: string | null;
  generate_on_dow?: number;
  active?: boolean;
  auto_meals_enabled?: boolean;
  auto_workouts_enabled?: boolean;
}

export interface Plan {
  id: string;
  pt_user_id: string;
  client_id: string;
  plan_type: PlanType;
  content_json: Record<string, any>;
  created_at: string;
  review_status: PlanReviewStatus;
  review_ready_at: string | null;
  sent_at: string | null;
  last_sent_to: string | null;
  last_sent_subject: string | null;
  assignment_id?: string | null;
  week_number?: number | null;
  status?: "draft" | "sent";
  generated_by?: "manual" | "auto";
  edited_at?: string | null;
  source_hash?: string | null;
  needs_regen?: boolean;
}

export interface PlanInsert {
  client_id: string;
  plan_type: PlanType;
  content_json: Record<string, any>;
}

export interface PtTemplate {
  id: string;
  pt_user_id: string;
  name: string;
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_type: string;
  duration_weeks: number;
  blueprint_json: Record<string, unknown> | null;
  usage_count?: number;
  created_at: string;
}

export interface PtTemplateInsert {
  pt_user_id: string;
  name: string;
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_type: string;
  duration_weeks: number;
  blueprint_json: Record<string, unknown>;
}

export type PlanJobType = "meal" | "workout" | "both";
export type PlanJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface PlanJob {
  id: string;
  pt_user_id: string;
  client_id: string;
  job_type: PlanJobType;
  status: PlanJobStatus;
  payload: Record<string, unknown>;
  result_plan_ids: string[] | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanJobInsert {
  pt_user_id: string;
  client_id: string;
  job_type: PlanJobType;
  payload?: Record<string, unknown>;
}

export interface PlanJobUpdate {
  status?: PlanJobStatus;
  result_plan_ids?: string[] | null;
  error?: string | null;
}

/** Profile row (auth.users extended via profiles table) */
export interface Profile {
  id: string;
  email?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  business_name?: string | null;
  brand_logo_url?: string | null;
  subscription_status?: string | null;
  subscription_tier?: string | null;
  trial_ends_at?: string | null;
  trial_started_email_sent_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  cancel_at_period_end?: boolean | null;
  cancel_effective_at?: string | null;
  current_period_end?: string | null;
}

/** Per-client row in dashboard summary */
export type DashboardClientDueStatus = "no_plan" | "on_track" | "due_soon" | "overdue";

export interface DashboardClientSummary {
  clientId: string;
  name: string;
  latestPlanId: string | null;
  latestPlanCreatedAt: string | null;
  weekCommencing: string | null;
  dueDate: string | null;
  daysUntilDue: number | null;
  dueStatus: DashboardClientDueStatus;
}

export interface DashboardSummary {
  activeClients: number;
  plansThisWeek: number;
  plansThisMonth: number;
  timeSavedMinutes: number;
  clients: DashboardClientSummary[];
}
