import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";

export type CancelMode = "period_end" | "now";

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mode?: CancelMode; feedbackId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode;
  // feedbackId is optional; can be used to link cancellation to feedback record (no DB update here, just accepted)
  if (mode !== "period_end" && mode !== "now") {
    return NextResponse.json(
      { error: "mode must be 'period_end' or 'now'" },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, subscription_status")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[POST /api/billing/cancel] profile fetch", profileError);
    return NextResponse.json(
      { error: "Failed to load subscription" },
      { status: 500 }
    );
  }

  const subscriptionId = profile?.stripe_subscription_id?.trim();
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "No active subscription found. You can only cancel an existing subscription." },
      { status: 400 }
    );
  }

  // Optional: don't allow canceling already canceled (Stripe will 400 anyway)
  if (profile?.subscription_status === "canceled") {
    return NextResponse.json(
      { error: "Subscription is already canceled." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();

    if (mode === "period_end") {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await stripe.subscriptions.cancel(subscriptionId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe request failed";
    console.error("[POST /api/billing/cancel]", message, err);
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
