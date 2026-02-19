import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const REASONS = ["too_expensive", "missing_features", "bugs", "not_using", "switching_tool", "other"] as const;

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { reason?: string; details?: string | null; stripe_subscription_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reason = body.reason;
  if (!reason || !REASONS.includes(reason as (typeof REASONS)[number])) {
    return NextResponse.json(
      { error: "reason must be one of: " + REASONS.join(", ") },
      { status: 400 }
    );
  }

  const details = body.details != null ? String(body.details).trim() || null : null;
  const stripeSubscriptionId = body.stripe_subscription_id?.trim() || null;

  const { data: row, error } = await supabase
    .from("cancellation_feedback")
    .insert({
      pt_user_id: userData.user.id,
      stripe_subscription_id: stripeSubscriptionId,
      reason,
      details,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[POST /api/billing/cancellation-feedback]", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ feedbackId: row.id });
}
