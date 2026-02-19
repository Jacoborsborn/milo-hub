import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * Sync Stripe subscription IDs to profile from Stripe by customer id.
 * Use when profile has no stripe_subscription_id (e.g. "No active subscription on file").
 * Only updates stripe IDs and cancel/period fields; webhook remains source of truth for status/tier/trial.
 */
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabaseAuth = await import("@/lib/supabase/server").then((m) => m.supabaseServer());
  const { data: userData } = await supabaseAuth.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabaseAuth
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id?.trim();
  if (!customerId) {
    return NextResponse.json(
      { error: "No Stripe customer linked. Complete checkout to link your account." },
      { status: 400 }
    );
  }

  try {
    const subscriptions = await getStripe().subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });

    const activeOrTrialing = subscriptions.data.find(
      (s) => s.status === "active" || s.status === "trialing"
    );
    if (!activeOrTrialing) {
      return NextResponse.json({ ok: true, synced: false });
    }

    const subAny = activeOrTrialing as { current_period_end?: number };
    const currentPeriodEnd = subAny.current_period_end
      ? new Date(subAny.current_period_end * 1000).toISOString()
      : null;
    const cancelAtPeriodEnd = activeOrTrialing.cancel_at_period_end ?? false;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        stripe_subscription_id: activeOrTrialing.id,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        cancel_effective_at: cancelAtPeriodEnd ? currentPeriodEnd : null,
      })
      .eq("id", userData.user.id);

    if (error) {
      console.error("[POST /api/billing/sync] update", error);
      return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, synced: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe request failed";
    console.error("[POST /api/billing/sync]", message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
