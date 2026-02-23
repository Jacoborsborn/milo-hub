import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyShareToken } from "@/lib/plan-share-token";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[supabase api/share/plan-completions getServiceClient] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !key) return null;
  return createClient(url, key);
}

function verifyToken(token: string | null): { planId: string } | NextResponse {
  const secret = process.env.PLAN_SHARE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Share not configured. Set PLAN_SHARE_SECRET in your environment (e.g. Vercel)." },
      { status: 500 }
    );
  }
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const payload = verifyShareToken(token, secret);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }
  return { planId: payload.planId };
}

export type PlanCompletionRow = {
  week_number: number;
  day_index: number;
  completed_at: string;
};

/** GET ?token=... — returns completions for the plan */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const verified = verifyToken(token);
  if (verified instanceof NextResponse) return verified;
  const { planId } = verified;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("plan_completions")
    .select("week_number, day_index, completed_at")
    .eq("plan_id", planId)
    .order("week_number")
    .order("day_index");

  if (error) {
    console.error("[plan-completions GET]", error);
    return NextResponse.json({ error: "Failed to load completions" }, { status: 500 });
  }

  const list = (data ?? []).map((r) => ({
    week_number: r.week_number,
    day_index: r.day_index,
    completed_at: r.completed_at,
  }));
  return NextResponse.json(list);
}

/** POST { token, week_number, day_index, completed } — toggle completion */
export async function POST(request: Request) {
  const secret = process.env.PLAN_SHARE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Share not configured. Set PLAN_SHARE_SECRET in your environment (e.g. Vercel)." },
      { status: 500 }
    );
  }

  let body: { token?: string; week_number?: number; day_index?: number; completed?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, week_number, day_index, completed } = body;
  if (!token || typeof week_number !== "number" || typeof day_index !== "number" || typeof completed !== "boolean") {
    return NextResponse.json({ error: "Missing token, week_number, day_index, or completed" }, { status: 400 });
  }

  const payload = verifyShareToken(token, secret);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }
  const planId = payload.planId;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  if (completed) {
    const { error: upsertError } = await supabase.from("plan_completions").upsert(
      { plan_id: planId, week_number, day_index },
      { onConflict: "plan_id,week_number,day_index" }
    );
    if (upsertError) {
      console.error("[plan-completions POST upsert]", upsertError);
      return NextResponse.json({ error: "Failed to save completion" }, { status: 500 });
    }
  } else {
    const { error: deleteError } = await supabase
      .from("plan_completions")
      .delete()
      .eq("plan_id", planId)
      .eq("week_number", week_number)
      .eq("day_index", day_index);
    if (deleteError) {
      console.error("[plan-completions POST delete]", deleteError);
      return NextResponse.json({ error: "Failed to remove completion" }, { status: 500 });
    }
  }

  const { data } = await supabase
    .from("plan_completions")
    .select("week_number, day_index, completed_at")
    .eq("plan_id", planId)
    .order("week_number")
    .order("day_index");

  const list = (data ?? []).map((r) => ({
    week_number: r.week_number,
    day_index: r.day_index,
    completed_at: r.completed_at,
  }));
  return NextResponse.json(list);
}
