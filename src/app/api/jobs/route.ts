import { NextResponse } from "next/server";
import { createPlanJob, listPlanJobs } from "@/lib/services/plan-jobs";

export async function GET() {
  try {
    const jobs = await listPlanJobs(50);
    return NextResponse.json(jobs);
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[GET /api/jobs]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list jobs" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { client_id, job_type, payload } = body as {
      client_id: string;
      job_type: "meal" | "workout" | "both";
      payload?: Record<string, unknown>;
    };
    if (!client_id || !job_type || !["meal", "workout", "both"].includes(job_type)) {
      return NextResponse.json(
        { error: "client_id and job_type (meal|workout|both) required" },
        { status: 400 }
      );
    }
    const job = await createPlanJob({ client_id, job_type, payload: payload ?? {} });
    return NextResponse.json({ jobId: job.id });
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[POST /api/jobs]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create job" },
      { status: 500 }
    );
  }
}
