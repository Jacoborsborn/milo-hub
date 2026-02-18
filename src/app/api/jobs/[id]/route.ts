import { NextResponse } from "next/server";
import { getPlanJobById } from "@/lib/services/plan-jobs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const job = await getPlanJobById(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[GET /api/jobs/[id]]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to get job" },
      { status: 500 }
    );
  }
}
