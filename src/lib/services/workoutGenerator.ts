"use server";

import { createPlanJob, getPlanJobById } from "./plan-jobs";
import type { PlanJob } from "@/types/database";

/** Workout inputs in PT Hub camelCase (daysPerWeek, workoutType, sessionLengthMin, equipment, experience, workoutSplit, etc.) */
export type WorkoutInputs = Record<string, unknown>;

export type CreateWorkoutPlanJobOptions = {
  model?: string;
  clientName?: string;
};

/**
 * Create a plan_jobs row for AI workout generation (job-based, non-blocking).
 * Payload includes workoutInputs so the process route will call pt-workout-generator.
 * Returns jobId; call POST /api/jobs/[id]/process to start, then poll GET /api/jobs/[id] for status.
 */
export async function createWorkoutPlanJob(
  clientId: string,
  workoutInputs: WorkoutInputs,
  options?: CreateWorkoutPlanJobOptions
): Promise<{ jobId: string }> {
  const job = await createPlanJob({
    client_id: clientId,
    job_type: "workout",
    payload: {
      workoutInputs,
      ...(options?.model && { model: options.model }),
      ...(options?.clientName && { client_name: options.clientName }),
    },
  });
  return { jobId: job.id };
}

/**
 * Get job by id (for polling). Server action.
 */
export async function getWorkoutJobById(jobId: string): Promise<PlanJob | null> {
  return getPlanJobById(jobId);
}
