import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";

const LOYALTY_COUPON_ID = "LOYALTY_30_ONCE";

async function getOrCreateLoyaltyCoupon(stripe: Stripe): Promise<string> {
  try {
    const existing = await stripe.coupons.retrieve(LOYALTY_COUPON_ID);
    return existing.id;
  } catch {
    // Coupon doesn't exist; create it
  }
  const coupon = await stripe.coupons.create({
    id: LOYALTY_COUPON_ID,
    percent_off: 30,
    duration: "once",
    name: "30% off next month (loyalty reward)",
  });
  return coupon.id;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = authHeader?.replace("Bearer ", "").trim();
  const expectedCron = process.env.CRON_SECRET || process.env.AUTOGEN_SECRET;
  let userId: string | null = null;

  if (expectedCron && cronSecret === expectedCron) {
    let body: { profileId?: string };
    try {
      body = await req.json().catch(() => ({}));
    } catch {
      body = {};
    }
    const profileId = body?.profileId?.trim();
    if (profileId) userId = profileId;
  }

  if (!userId) {
    const supabase = await supabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    userId = userData?.user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const useServiceRole = !!(expectedCron && cronSecret === expectedCron && url && serviceKey);
  const supabase = useServiceRole ? createClient(url, serviceKey) : await supabaseServer();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, subscription_status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[POST /api/billing/apply-loyalty-reward] profile fetch", profileError);
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
    const couponId = await getOrCreateLoyaltyCoupon(stripe);

    await stripe.subscriptions.update(subscriptionId, {
      discounts: [{ coupon: couponId }],
      cancel_at_period_end: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe request failed";
    console.error("[POST /api/billing/apply-loyalty-reward]", message, err);
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
