import { stripe } from "@/lib/stripe";
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: PRICE_MAP[tier],
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 3,
      metadata: {
        user_id: userData.user.id,
        tier,
      },
    },
    metadata: {
      user_id: userData.user.id,
      tier,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pt/app/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pt/app/billing?canceled=true`,
    customer_email: userData.user.email!,
  });

  return NextResponse.json({ url: session.url });
}
