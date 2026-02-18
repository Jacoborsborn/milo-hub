import { getPtDashboardSummary } from "@/lib/services/dashboard";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/summary
 * Returns dashboard summary for the currently logged-in PT.
 * Uses existing RLS / pt_id / pt_user_id filtering.
 */
export async function GET() {
  try {
    const summary = await getPtDashboardSummary();
    return NextResponse.json(summary);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    console.error("[GET /api/dashboard/summary]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load dashboard summary" },
      { status: 500 }
    );
  }
}
