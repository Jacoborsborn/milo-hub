import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

const PRICE_MAP: Record<string, string> = {
  monthly: process.env.KIRA_STRIPE_PRICE_MONTHLY!,
  bundle: process.env.KIRA_STRIPE_PRICE_BUNDLE!,
};

export async function POST(req: Request) {
  const body = await req.json();
  const { plan, lead_id } = body as { plan?: string; lead_id?: string };

  if (!plan || !PRICE_MAP[plan]) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

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

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: PRICE_MAP[plan], quantity: 1 }],
    metadata: {
      kira_lead_id: lead_id ?? "",
      plan,
    },
    success_url: `${appOrigin}/kira?applied=true`,
    cancel_url: `${appOrigin}/kira#apply`,
  });

  return NextResponse.json({ url: session.url });
}
