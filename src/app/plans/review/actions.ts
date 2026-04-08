"use server";

import { createPlan } from "../../../lib/services/plans";
import { updateClient } from "../../../lib/services/clients";
import { logSavedPlanContentIfDebug } from "../../../lib/services/plansDebug";
import { splitNotesToBullets } from "../../../lib/utils/notes";

const DEBUG_GEN = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEBUG_GENERATION === "true";

/**
 * Save a draft plan from the review page
 * This is a server action that can be called from client components
 * Returns the created plan ID for client-side redirect
 */
export async function saveDraftPlanAction(draftData: {
  template_id: string;
  client_id: string;
  [key: string]: any; // The full plan JSON
}): Promise<{ planId: string }> {
  try {
    console.log("[saveDraftPlanAction] Saving draft plan:", {
      template_id: draftData.template_id,
      client_id: draftData.client_id,
      hasPlanData: !!draftData,
    });

    // Normalise exercise notes before persisting to content_json (back-compat with legacy string notes).
    const normalizedDraft = normalizeWorkoutDraftNotes(draftData);

    if (DEBUG_GEN) {
      const weeks = (normalizedDraft.weeks as unknown[]) ?? [];
      const w0 = weeks[0] as Record<string, unknown> | undefined;
      console.log("[saveDraftPlanAction] content_json to save:", {
        topKeys: Object.keys(normalizedDraft),
        weeksLength: weeks.length,
        week0Keys: w0 ? Object.keys(w0) : [],
        week0DaysLength: (w0?.days as unknown[])?.length ?? 0,
      });
    }

    // Save the plan - this is a workout plan from the template generator
    const plan = await createPlan({
      client_id: draftData.client_id,
      plan_type: "workout",
      content_json: normalizedDraft, // Store the full draft JSON
    });

    console.log("[saveDraftPlanAction] Plan saved successfully:", {
      plan_id: plan.id,
      pt_user_id: plan.pt_user_id,
      client_id: plan.client_id,
    });

    await logSavedPlanContentIfDebug(plan.id);

    // Return plan ID for client-side redirect
    return { planId: plan.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to save plan";
    console.error("[saveDraftPlanAction] Error:", err);
    throw new Error(errorMsg);
  }
}

function normalizeWorkoutDraftNotes<T extends Record<string, any>>(draft: T): T {
  const next = { ...draft } as any;
  const weeks = Array.isArray(next.weeks) ? next.weeks : [];
  next.weeks = weeks.map((w: any) => {
    const days = Array.isArray(w?.days) ? w.days : [];
    return {
      ...w,
      days: days.map((d: any) => {
        const exercises = Array.isArray(d?.exercises) ? d.exercises : [];
        return {
          ...d,
          exercises: exercises.map((ex: any) => {
            const source =
              ex?.notes ?? ex?.note ?? ex?.notesText ?? ex?.coachNotes ?? ex?.instructions ?? "";
            const notes = splitNotesToBullets(source);
            return {
              ...ex,
              ...(notes.length > 0 ? { notes } : { notes: [] }),
            };
          }),
        };
      }),
    };
  });
  return next as T;
}

/**
 * Save the draft's program as the client's default assigned workout program.
 */
export async function setAssignedWorkoutAsDefaultAction(clientId: string, templateId: string): Promise<void> {
  await updateClient(clientId, { assigned_workout_program_id: templateId });
}
