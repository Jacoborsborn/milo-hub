import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";

const EXIT_OFFER_COUPON_ID = "50_OFF_ONCE";

async function getOrCreateExitOfferCoupon(stripe: Stripe): Promise<string> {
  try {
    const existing = await stripe.coupons.retrieve(EXIT_OFFER_COUPON_ID);
    return existing.id;
  } catch {
    // Coupon doesn't exist; create it
  }
  const coupon = await stripe.coupons.create({
    id: EXIT_OFFER_COUPON_ID,
    percent_off: 50,
    duration: "once",
    name: "50% off next month (exit offer)",
  });
  return coupon.id;
}

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { feedbackId?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    // no body is ok
  }
  // feedbackId is optional; can be used to link to cancellation_feedback (no DB update here)

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, subscription_status")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[POST /api/billing/exit-offer-50] profile fetch", profileError);
    return NextResponse.json(
      { error: "Failed to load subscription" },
      { status: 500 }
    );
  }

  const subscriptionId = profile?.stripe_subscription_id?.trim();
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "No active subscription found." },
      { status: 400 }
    );
  }

  if (profile?.subscription_status === "canceled") {
    return NextResponse.json(
      { error: "Subscription is already canceled." },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const couponId = await getOrCreateExitOfferCoupon(stripe);

    await stripe.subscriptions.update(subscriptionId, {
      discounts: [{ coupon: couponId }],
      cancel_at_period_end: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe request failed";
    console.error("[POST /api/billing/exit-offer-50]", message, err);
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
