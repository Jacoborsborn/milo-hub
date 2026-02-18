"use server";

import { getPlanById } from "./plans";

const DEBUG_GEN = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_DEBUG_GENERATION === "true";

/**
 * Dev-only: after saving a plan, read it back and log content_json structure (weeks/days).
 * Call this immediately after createPlan when NEXT_PUBLIC_DEBUG_GENERATION=true.
 */
export async function logSavedPlanContentIfDebug(planId: string): Promise<void> {
  if (!DEBUG_GEN) return;
  try {
    const plan = await getPlanById(planId);
    if (!plan) {
      console.log("[plansDebug] plan not found id=" + planId);
      return;
    }
    const c = plan.content_json as Record<string, unknown> | undefined;
    const keys = c ? Object.keys(c) : [];
    const weeks = (c?.weeks as unknown[]) ?? [];
    const week0 = weeks[0] as Record<string, unknown> | undefined;
    const week0Keys = week0 ? Object.keys(week0) : [];
    const week0Days = (week0?.days as unknown[]) ?? [];
    console.log("[plansDebug] planId=" + planId, {
      content_jsonKeys: keys,
      weeksCount: weeks.length,
      week0Keys,
      week0DaysLength: week0Days.length,
    });
  } catch (e) {
    console.warn("[plansDebug] logSavedPlanContent failed", e);
  }
}
