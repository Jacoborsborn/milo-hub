import { NextResponse } from "next/server";
import { getPlanJobById, setJobStatus } from "@/lib/services/plan-jobs";

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
    if (job.status !== "queued" && job.status !== "running") {
      return NextResponse.json(
        { error: `Job cannot be cancelled (status: ${job.status})` },
        { status: 400 }
      );
    }
    await setJobStatus(jobId, "failed", { error: "Cancelled by user" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[POST /api/jobs/[id]/cancel]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to cancel job" },
      { status: 500 }
    );
  }
}
