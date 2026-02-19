"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "../supabase/server";
import { redirect } from "next/navigation";
import { requireWritableAccessOrThrow } from "./subscription";
import type { Plan, PlanInsert } from "../../types/database";

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
 * Create a new plan for the current PT user's client
 */
export async function createPlan(payload: PlanInsert): Promise<Plan> {
  const ptUserId = await getCurrentUserId();
  await requireWritableAccessOrThrow();
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("plans")
    .insert({
      pt_user_id: ptUserId,
      client_id: payload.client_id,
      plan_type: payload.plan_type,
      content_json: payload.content_json,
      review_status: "ready",
      review_ready_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[createPlan] Error:", error);
    throw new Error(`Failed to create plan: ${error.message}`);
  }

  return data as Plan;
}

/**
 * List all plans for the current PT user (for dashboard/summary)
 */
export async function listPlansForPtUser(): Promise<Plan[]> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("pt_user_id", ptUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listPlansForPtUser] Error:", error);
    throw new Error(`Failed to fetch plans: ${error.message}`);
  }

  return (data || []) as Plan[];
}

/**
 * List all plans for a specific client (current PT user only)
 */
export async function listPlansForClient(clientId: string): Promise<Plan[]> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("client_id", clientId)
    .eq("pt_user_id", ptUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listPlansForClient] Error:", error);
    throw new Error(`Failed to fetch plans: ${error.message}`);
  }

  return (data || []) as Plan[];
}

/**
 * Get a single plan by ID (ensures it belongs to current PT)
 */
export async function getPlanById(planId: string): Promise<Plan | null> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .eq("pt_user_id", ptUserId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("[getPlanById] Error:", error);
    throw new Error(`Failed to fetch plan: ${error.message}`);
  }

  return data as Plan;
}

/**
 * Update only content_json for a plan (ensures it belongs to current PT)
 */
export async function updatePlanContent(
  planId: string,
  contentJson: Record<string, unknown>
): Promise<Plan> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("plans")
    .update({
      content_json: contentJson,
      edited_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("pt_user_id", ptUserId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new Error("Plan not found or you don't have permission to update it");
    }
    console.error("[updatePlanContent] Error:", error);
    throw new Error(`Failed to update plan: ${error.message}`);
  }

  return data as Plan;
}

/**
 * Delete a plan (ensures it belongs to current PT)
 */
export async function deletePlan(planId: string): Promise<void> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("plans")
    .delete()
    .eq("id", planId)
    .eq("pt_user_id", ptUserId);

  if (error) {
    console.error("[deletePlan] Error:", error);
    throw new Error(`Failed to delete plan: ${error.message}`);
  }
}

/**
 * List plans for Review Plans page: review_status IN ('ready','sent'), with client name.
 * Ordered by review_ready_at desc nulls last, then created_at desc.
 */
export async function listPlansForReview(): Promise<
  Array<{
    id: string;
    client_id: string;
    clientName: string;
    planName: string;
    plan_type: Plan["plan_type"];
    created_at: string;
    review_ready_at: string | null;
    review_status: Plan["review_status"];
    sent_at: string | null;
  }>
> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id, client_id, plan_type, created_at, review_ready_at, review_status, sent_at")
    .eq("pt_user_id", ptUserId)
    .in("review_status", ["ready", "sent"])
    .order("review_ready_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (plansError) {
    console.error("[listPlansForReview] Error:", plansError);
    throw new Error(`Failed to fetch review plans: ${plansError.message}`);
  }

  const planList = (plans ?? []) as Array<{
    id: string;
    client_id: string;
    plan_type: Plan["plan_type"];
    created_at: string;
    review_ready_at: string | null;
    review_status: Plan["review_status"];
    sent_at: string | null;
  }>;

  if (planList.length === 0) {
    return [];
  }

  const clientIds = [...new Set(planList.map((p) => p.client_id))];
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("pt_id", ptUserId)
    .in("id", clientIds);

  if (clientsError) {
    console.error("[listPlansForReview] Clients error:", clientsError);
  }

  const clientMap = new Map<string, string>();
  for (const c of clients ?? []) {
    clientMap.set((c as { id: string; name: string }).id, (c as { id: string; name: string }).name ?? "Client");
  }

  function formatPlanLabel(planType: string, createdAt: string): string {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return `${planType === "workout" ? "Workout" : "Meal"} Plan`;
    const dateStr = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return `${planType === "workout" ? "Workout" : "Meal"} Plan – ${dateStr}`;
  }

  return planList.map((p) => ({
    id: p.id,
    client_id: p.client_id,
    clientName: clientMap.get(p.client_id) ?? "Client",
    planName: formatPlanLabel(p.plan_type, p.created_at),
    plan_type: p.plan_type,
    created_at: p.created_at,
    review_ready_at: p.review_ready_at,
    review_status: p.review_status,
    sent_at: p.sent_at,
  }));
}

/**
 * Mark a plan as sent (Review & Send). Sets review_status='sent', sent_at=now().
 */
export async function markPlanSent(planId: string): Promise<void> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("plans")
    .update({
      review_status: "sent",
      sent_at: new Date().toISOString(),
      status: "sent",
    })
    .eq("id", planId)
    .eq("pt_user_id", ptUserId);

  if (error) {
    console.error("[markPlanSent] Error:", error);
    throw new Error(`Failed to mark plan as sent: ${error.message}`);
  }

  revalidatePath("/pt/app/review-plans");
}

/**
 * List auto-generated draft plans (for Dashboard "Drafts Ready" widget).
 * Plans where status = 'draft' and generated_by = 'auto'.
 */
export async function listAutoDraftPlansForDashboard(): Promise<
  Array<{ id: string; client_id: string; clientName: string; planName: string }>
> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();

  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, client_id, plan_type, created_at, week_number")
    .eq("pt_user_id", ptUserId)
    .eq("status", "draft")
    .eq("generated_by", "auto")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listAutoDraftPlansForDashboard] Error:", error);
    return [];
  }

  const planList = (plans ?? []) as Array<{
    id: string;
    client_id: string;
    plan_type: string;
    created_at: string;
    week_number?: number | null;
  }>;
  if (planList.length === 0) return [];

  const clientIds = [...new Set(planList.map((p) => p.client_id))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .eq("pt_id", ptUserId)
    .in("id", clientIds);
  const clientMap = new Map<string, string>();
  for (const c of clients ?? []) {
    clientMap.set((c as { id: string; name: string }).id, (c as { id: string; name: string }).name ?? "Client");
  }

  return planList.map((p) => {
    const weekLabel = p.week_number != null ? ` Week ${p.week_number}` : "";
    const typeLabel = p.plan_type === "workout" ? "Workout" : "Meal";
    return {
      id: p.id,
      client_id: p.client_id,
      clientName: clientMap.get(p.client_id) ?? "Client",
      planName: `${typeLabel}${weekLabel}`,
    };
  });
}

