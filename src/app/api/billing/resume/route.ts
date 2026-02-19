import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, subscription_status")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[POST /api/billing/resume] profile fetch", profileError);
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
    await getStripe().subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe request failed";
    console.error("[POST /api/billing/resume]", message, err);
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
