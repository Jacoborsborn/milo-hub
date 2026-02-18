import { NextResponse } from "next/server";
import { createPlanJob } from "@/lib/services/plan-jobs";

type JobSpec = {
  client_id: string;
  job_type: "meal" | "workout" | "both";
  payload?: Record<string, unknown>;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobs } = body as { jobs: JobSpec[] };
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json(
        { error: "jobs array (non-empty) required" },
        { status: 400 }
      );
    }
    const jobIds: string[] = [];
    for (const spec of jobs) {
      if (!spec.client_id || !spec.job_type || !["meal", "workout", "both"].includes(spec.job_type)) {
        return NextResponse.json(
          { error: "Each job must have client_id and job_type (meal|workout|both)" },
          { status: 400 }
        );
      }
      const job = await createPlanJob({
        client_id: spec.client_id,
        job_type: spec.job_type,
        payload: spec.payload ?? {},
      });
      jobIds.push(job.id);
    }
    return NextResponse.json({ jobIds });
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[POST /api/jobs/batch]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create jobs" },
      { status: 500 }
    );
  }
}
