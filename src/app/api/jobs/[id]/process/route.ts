import { NextResponse } from "next/server";
import { getPlanJobById, setJobStatus } from "@/lib/services/plan-jobs";
import { getClientById } from "@/lib/services/clients";
import { createPlan } from "@/lib/services/plans";
import { getSubscriptionStatus } from "@/lib/services/subscription";
import { assignMealTemplateToClient } from "@/app/templates/meals/actions";
import { supabaseServer } from "@/lib/supabase/server";

/** Template-based workout: pt-plan-generator returns plan JSON. */
async function runWorkoutGenerationFromTemplate(
  templateId: string,
  clientId: string,
  userId: string,
  accessToken: string
): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.functions.invoke("pt-plan-generator", {
    body: { template_id: templateId, client_id: clientId, user_id: userId },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw new Error(error.message || "Workout generation failed");
  const planJson = data as Record<string, unknown>;
  if (!planJson || typeof planJson !== "object") throw new Error("Invalid plan response");
  const plan = await createPlan({
    client_id: clientId,
    plan_type: "workout",
    content_json: planJson,
  });
  return plan.id;
}

/** AI workout: pt-workout-generator returns { ok, plan } with normalised content_json. */
async function runWorkoutGenerationFromInputs(
  workoutInputs: Record<string, unknown>,
  clientId: string,
  accessToken: string,
  model?: string
): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.functions.invoke("pt-workout-generator", {
    body: { workoutInputs, model: model ?? "gpt-4.1-mini" },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw new Error(error.message || "Workout generation failed");
  const result = data as { ok?: boolean; plan?: Record<string, unknown>; error?: { code?: string; message?: string } };
  if (!result || result.ok !== true || !result.plan) {
    const msg = result?.error?.message ?? "Invalid response from workout generator";
    throw new Error(msg);
  }
  const plan = await createPlan({
    client_id: clientId,
    plan_type: "workout",
    content_json: result.plan,
  });
  return plan.id;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const job = await getPlanJobById(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.status !== "queued" && job.status !== "failed") {
      return NextResponse.json(
        { error: `Job cannot be processed (status: ${job.status})` },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user?.id || !session.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const accessToken = session.access_token;

    const client = await getClientById(job.client_id);
    if (!client) {
      await setJobStatus(jobId, "failed", { error: "Client not found" });
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const payload = (job.payload || {}) as {
      workout_template_id?: string;
      meal_template_id?: string;
      workoutInputs?: Record<string, unknown>;
      model?: string;
    };
    const workoutTemplateId =
      payload.workout_template_id ??
      (client as { assigned_workout_program_id?: string | null }).assigned_workout_program_id;
    const mealTemplateId =
      payload.meal_template_id ??
      (client as { assigned_meal_program_id?: string | null }).assigned_meal_program_id;

    await setJobStatus(jobId, "running", { error: undefined });

    const planIds: string[] = [];

    try {
      if (job.job_type === "workout" || job.job_type === "both") {
        if (payload.workoutInputs && typeof payload.workoutInputs === "object") {
          const planId = await runWorkoutGenerationFromInputs(
            payload.workoutInputs,
            job.client_id,
            accessToken,
            payload.model
          );
          planIds.push(planId);
        } else if (workoutTemplateId) {
          const planId = await runWorkoutGenerationFromTemplate(
            workoutTemplateId,
            job.client_id,
            userId,
            accessToken
          );
          planIds.push(planId);
        } else {
          throw new Error("No workout program assigned and no workoutInputs provided");
        }
      }

      if (job.job_type === "meal" || job.job_type === "both") {
        if (!mealTemplateId) {
          throw new Error("No meal program assigned and none provided");
        }
        const subscription = await getSubscriptionStatus();
        if (!subscription.allowed) {
          await setJobStatus(jobId, "failed", {
            error: `Subscription required. ${subscription.reason ?? "Upgrade to generate meal plans."}`,
          });
          return NextResponse.json(
            { error: "Subscription required" },
            { status: 402 }
          );
        }
        const { planId } = await assignMealTemplateToClient(mealTemplateId, job.client_id);
        planIds.push(planId);
      }

      await setJobStatus(jobId, "succeeded", { result_plan_ids: planIds });
      return NextResponse.json({ ok: true, result_plan_ids: planIds });
    } catch (err) {
      if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) {
        await setJobStatus(jobId, "failed", { error: "Subscription required or session expired." });
        return NextResponse.json({ error: "Subscription required or session expired." }, { status: 402 });
      }
      const msg = err instanceof Error ? err.message : String(err);
      await setJobStatus(jobId, "failed", { error: msg });
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[POST /api/jobs/[id]/process]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to process job" },
      { status: 500 }
    );
  }
}
