import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
  elite: process.env.STRIPE_PRICE_ELITE!,
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const tier = body?.tier;

  if (!tier || !PRICE_MAP[tier]) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  const existingCustomerId = profile?.stripe_customer_id?.trim() || null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PRICE_MAP[tier], quantity: 1 }],
    subscription_data: {
      trial_period_days: 3,
      metadata: { user_id: userData.user.id, tier },
    },
    metadata: { user_id: userData.user.id, tier },
    client_reference_id: userData.user.id,
    success_url: `${baseUrl}/pt/app/tutorial?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pt/app/billing?canceled=true`,
    ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: userData.user.email ?? undefined }),
  });

  return NextResponse.json({ url: session.url });
}
