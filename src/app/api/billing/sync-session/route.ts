import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER ?? ""]: "starter",
  [process.env.STRIPE_PRICE_PRO ?? ""]: "pro",
  [process.env.STRIPE_PRICE_ELITE ?? ""]: "elite",
};

function tierFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  return PRICE_TO_TIER[priceId] ?? null;
}

function tierFromSubscription(sub: Stripe.Subscription): string | null {
  const fromMeta = sub.metadata?.tier?.trim();
  if (fromMeta) return fromMeta;
  return tierFromPriceId(sub.items?.data?.[0]?.price?.id);
}

function mapStripeToStatus(sub: Stripe.Subscription): { subscription_status: string; trial_ends_at: string | null } {
  if (sub.status === "trialing") {
    return {
      subscription_status: "trial",
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    };
  }
  if (sub.status === "active") return { subscription_status: "active", trial_ends_at: null };
  if (sub.status === "past_due" || sub.status === "unpaid") return { subscription_status: "past_due", trial_ends_at: null };
  if (sub.status === "canceled") return { subscription_status: "canceled", trial_ends_at: null };
  return { subscription_status: "free", trial_ends_at: null };
}

/**
 * Post-checkout sync: fetch Stripe session by id, resolve user from client_reference_id,
 * retrieve subscription, update profile, return profile state. Call from success page to avoid webhook timing.
 */
export async function POST(req: Request) {
  const supabaseAuth = await import("@/lib/supabase/server").then((m) => m.supabaseServer());
  const { data: userData } = await supabaseAuth.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { session_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = body?.session_id?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[sync-session] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    const userId = session.client_reference_id?.trim() || null;
    if (!userId || userId !== userData.user.id) {
      console.warn("[sync-session] Session user mismatch", {
        client_reference_id: session.client_reference_id,
        current_user_id: userData.user.id,
      });
      return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
    }

    const subId = typeof session.subscription === "object" && session.subscription
      ? (session.subscription as Stripe.Subscription).id
      : typeof session.subscription === "string"
        ? session.subscription
        : null;

    if (!subId) {
      return NextResponse.json({ error: "No subscription on session" }, { status: 400 });
    }

    const sub = typeof session.subscription === "object" && session.subscription
      ? (session.subscription as Stripe.Subscription)
      : await getStripe().subscriptions.retrieve(subId);

    const mapped = mapStripeToStatus(sub);
    const tier = session.metadata?.tier?.trim() || tierFromSubscription(sub);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
    const subAny = sub as { current_period_end?: number; start?: number };
    const currentPeriodEnd = subAny.current_period_end ? new Date(subAny.current_period_end * 1000).toISOString() : null;
    const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
    const startedAt = subAny.start ? new Date(subAny.start * 1000).toISOString() : null;

    const supabaseAdmin = createClient(url, serviceKey);
    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_status: mapped.subscription_status,
        subscription_tier: tier,
        trial_ends_at: mapped.trial_ends_at,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        cancel_effective_at: cancelAtPeriodEnd ? currentPeriodEnd : null,
        subscription_started_at: startedAt,
      })
      .eq("id", userId)
      .select("subscription_status, subscription_tier, trial_ends_at, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, cancel_effective_at")
      .single();

    if (error) {
      console.error("[sync-session] profile update failed", error);
      return NextResponse.json({ error: "Failed to sync profile" }, { status: 500 });
    }

    console.log("[sync-session] profile updated", {
      user_id: userId,
      subscription_status: updated?.subscription_status,
      trial_ends_at: updated?.trial_ends_at,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe request failed";
    console.error("[sync-session]", message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
