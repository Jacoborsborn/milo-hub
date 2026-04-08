import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabase/server";

const MILO_PRICE_ID = "price_1T7a5aDbHWgvBRLbzCl4SHa8";
const APP_STORE_URL =
  "https://apps.apple.com/us/app/milo-ai-meal-workout-plans/id6756512890";

export async function POST(req: Request) {
  try {
    const stripe = getStripe();

    let heardFrom: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.heardFrom === "string") {
        heardFrom = body.heardFrom.trim() || null;
      }
    } catch {
      // Non‑JSON or empty body is fine – treat as no extra metadata.
    }

    // Optional: prefill Stripe checkout with logged-in user's email (from /milo/signup flow).
    let customerEmail: string | undefined;
    try {
      const supabase = await supabaseServer();
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) {
        customerEmail = data.user.email;
      }
    } catch {
      // Ignore; checkout remains guest.
    }

    // Use app origin for cancel_url so users can get back to the Milo landing page.
    const appUrlRaw =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const appOrigin = (() => {
      try {
        return new URL(appUrlRaw).origin;
      } catch {
        return appUrlRaw.replace(/\/.*$/, "") || "http://localhost:3000";
      }
    })();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: MILO_PRICE_ID, quantity: 1 }],
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          product: "milo-plus",
          ...(heardFrom ? { heard_from: heardFrom } : {}),
        },
      },
      metadata: {
        product: "milo-plus",
        ...(heardFrom ? { heard_from: heardFrom } : {}),
      },
      // After successful checkout, send users straight to the App Store.
      success_url: APP_STORE_URL,
      // On cancel, send them back to the Milo web landing page.
      cancel_url: `${appOrigin}/milo?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("[checkout-milo] error", e);
    return NextResponse.json(
      { error: e?.message ?? "Checkout failed" },
      { status: 400 },
    );
  }
}

