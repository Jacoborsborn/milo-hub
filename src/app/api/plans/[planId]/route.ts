import { createClient } from "@supabase/supabase-js";
import { getPlanById } from "../../../../lib/services/plans";
import { getClientById } from "../../../../lib/services/clients";
import { getCoachDisplayName } from "../../../../lib/coach-display-name";
import { supabaseServer } from "../../../../lib/supabase/server";
import { NextResponse } from "next/server";

async function getCompletionsForPlan(planId: string): Promise<{ week_number: number; day_index: number; completed_at: string }[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[supabase api/plans/[planId] getCompletionsForPlan] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !key) return [];
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("plan_completions")
    .select("week_number, day_index, completed_at")
    .eq("plan_id", planId)
    .order("week_number")
    .order("day_index");
  if (error) {
    console.error("[GET /api/plans/[planId]] plan_completions:", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    week_number: r.week_number,
    day_index: r.day_index,
    completed_at: r.completed_at,
  }));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const plan = await getPlanById(planId);

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    let clientName: string | null = null;
    try {
      const client = await getClientById(plan.client_id);
      clientName = client?.name ?? null;
    } catch {
      // ignore; client_name stays null
    }

    let coachDisplayName = "Your coach";
    try {
      const supabase = await supabaseServer();
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, full_name, name")
        .eq("id", plan.pt_user_id)
        .maybeSingle();
      coachDisplayName = getCoachDisplayName(profile as { display_name?: string; full_name?: string; name?: string } | null);
    } catch {
      // keep "Your coach"
    }

    const completions = await getCompletionsForPlan(plan.id);

    return NextResponse.json({
      ...plan,
      client_name: clientName,
      coach_display_name: coachDisplayName as string,
      completions,
    });
  } catch (error) {
    if ((error as any)?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("[GET /api/plans/[planId]] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch plan" },
      { status: 500 }
    );
  }
}
