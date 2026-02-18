"use server";

import { getClientById } from "@/lib/services/clients";
import { createPlan } from "@/lib/services/plans";
import { createPlanJob, setJobStatus } from "@/lib/services/plan-jobs";
import { generateWorkoutDraft } from "@/lib/services/generator";
import { parseWorkoutPreset, workoutPresetToGeneratorInputs, templateToWorkoutInputs } from "@/types/presets";
import { deriveDaysPerWeek } from "@/lib/utils/deriveDaysPerWeek";

const DEBUG_GEN = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEBUG_GENERATION === "true";

type TemplateForInputs = {
  goal?: string;
  experience_level?: string;
  days_per_week?: number;
  equipment_type?: string;
};

/**
 * Build workoutInputs and call pt-workout-generator from the server (avoids browser 401).
 * Uses client presets if available, else template metadata.
 * Template days_per_week wins when client-derived value is 0 or missing so we never send daysPerWeek < 1.
 * When correlationId is provided, returns debug payload for the audit panel.
 */
export async function generateWorkoutDraftAction(
  clientId: string,
  template: TemplateForInputs,
  correlationId?: string,
  coachMessage?: string
): Promise<{
  plan: Record<string, unknown>;
  correlationId?: string;
  requestPayload?: Record<string, unknown>;
  rawResponse?: unknown;
}> {
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found");

  const presets = (client as { presets_json?: { workout?: unknown } }).presets_json;
  let workoutInputs: Record<string, unknown> =
    presets?.workout != null
      ? workoutPresetToGeneratorInputs(parseWorkoutPreset(presets.workout))
      : templateToWorkoutInputs(template);

  const templateDaysPerWeek = deriveDaysPerWeek(template);
  const clientDaysPerWeek = deriveDaysPerWeek(workoutInputs);
  const derivedDaysPerWeek =
    clientDaysPerWeek >= 1 ? clientDaysPerWeek : templateDaysPerWeek >= 1 ? templateDaysPerWeek : 4;
  if (derivedDaysPerWeek !== (workoutInputs.daysPerWeek as number)) {
    workoutInputs = { ...workoutInputs, daysPerWeek: derivedDaysPerWeek };
  }

  if (DEBUG_GEN && correlationId) {
    console.log(
      `[generateWorkoutDraftAction] correlationId=${correlationId} derivedDaysPerWeek=${derivedDaysPerWeek} templateDaysPerWeek=${templateDaysPerWeek} clientDaysPerWeek=${clientDaysPerWeek} coachMessageLength=${coachMessage?.length ?? 0} requestPayload=`,
      JSON.stringify(workoutInputs)
    );
  }

  const { plan, rawResponse } = await generateWorkoutDraft(
    workoutInputs as Record<string, unknown>,
    undefined,
    correlationId,
    coachMessage
  );

  return {
    plan,
    ...(correlationId && {
      correlationId,
      requestPayload: {
        workoutInputs,
        ...(coachMessage ? { coachMessage } : {}),
      } as Record<string, unknown>,
      rawResponse,
    }),
  };
}

/**
 * Create a plan_jobs row, run workout generation, save plan, and update job.
 * Used by Assign program so Generation Center shows the job and result.
 * Returns { planId } on success; on failure updates job to failed and throws.
 */
export async function createJobAndRunWorkoutGeneration(
  clientId: string,
  templateId: string,
  template: TemplateForInputs,
  coachMessage?: string
): Promise<{ planId: string }> {
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found");

  const clientName = (client as { name?: string }).name ?? "Client";

  const job = await createPlanJob({
    client_id: clientId,
    job_type: "workout",
    payload: { template_id: templateId, client_name: clientName },
  });

  try {
    await setJobStatus(job.id, "running", { error: undefined });

    const presets = (client as { presets_json?: { workout?: unknown } }).presets_json;
    let workoutInputs: Record<string, unknown> =
      presets?.workout != null
        ? workoutPresetToGeneratorInputs(parseWorkoutPreset(presets.workout))
        : templateToWorkoutInputs(template);

    const templateDaysPerWeek = deriveDaysPerWeek(template);
    const clientDaysPerWeek = deriveDaysPerWeek(workoutInputs);
    const derivedDaysPerWeek =
      clientDaysPerWeek >= 1 ? clientDaysPerWeek : templateDaysPerWeek >= 1 ? templateDaysPerWeek : 4;
    if (derivedDaysPerWeek !== (workoutInputs.daysPerWeek as number)) {
      workoutInputs = { ...workoutInputs, daysPerWeek: derivedDaysPerWeek };
    }

    const { plan } = await generateWorkoutDraft(
      workoutInputs as Record<string, unknown>,
      undefined,
      undefined,
      coachMessage
    );

    const created = await createPlan({
      client_id: clientId,
      plan_type: "workout",
      content_json: plan,
    });

    await setJobStatus(job.id, "succeeded", { result_plan_ids: [created.id] });
    return { planId: created.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setJobStatus(job.id, "failed", { error: msg });
    throw err;
  }
}
