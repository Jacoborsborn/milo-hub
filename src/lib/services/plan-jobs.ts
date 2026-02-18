"use server";

import { supabaseServer } from "../supabase/server";
import { redirect } from "next/navigation";
import type { PlanJob, PlanJobInsert, PlanJobUpdate, PlanJobStatus } from "../../types/database";

async function getCurrentUserId(): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/pt/auth/login");
  return data.user.id;
}

export async function createPlanJob(payload: Omit<PlanJobInsert, "pt_user_id">): Promise<PlanJob> {
  const pt_user_id = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("plan_jobs")
    .insert({
      pt_user_id,
      client_id: payload.client_id,
      job_type: payload.job_type,
      status: "queued",
      payload: payload.payload ?? {},
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create job: ${error.message}`);
  return data as PlanJob;
}

export async function listPlanJobs(limit = 50): Promise<PlanJob[]> {
  const pt_user_id = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("plan_jobs")
    .select("*")
    .eq("pt_user_id", pt_user_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list jobs: ${error.message}`);
  return (data ?? []) as PlanJob[];
}

export async function getPlanJobById(id: string): Promise<PlanJob | null> {
  const pt_user_id = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("plan_jobs")
    .select("*")
    .eq("id", id)
    .eq("pt_user_id", pt_user_id)
    .single();
  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(`Failed to get job: ${error.message}`);
  return data as PlanJob;
}

export async function updatePlanJob(id: string, updates: PlanJobUpdate): Promise<PlanJob> {
  const pt_user_id = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("plan_jobs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("pt_user_id", pt_user_id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update job: ${error.message}`);
  return data as PlanJob;
}

export async function setJobStatus(id: string, status: PlanJobStatus, extra?: { result_plan_ids?: string[]; error?: string }): Promise<void> {
  await updatePlanJob(id, { status, ...extra });
}
