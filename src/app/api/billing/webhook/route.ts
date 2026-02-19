import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// IMPORTANT: Webhooks must use the raw body for signature verification.
export const runtime = "nodejs";

const PRICE_TO_TIER: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER ?? ""]: "starter",
  [process.env.STRIPE_PRICE_PRO ?? ""]: "pro",
  [process.env.STRIPE_PRICE_ELITE ?? ""]: "elite",
};

function tierFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  return PRICE_TO_TIER[priceId] ?? null;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    console.error("[webhook] FATAL: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Webhook cannot write to Supabase.");
  }
  // Log Supabase URL only (redact key) so we confirm which project is used
  const redacted = url ? `${url.replace(/\/$/, "")} (key=***)` : "MISSING";
  console.log("[webhook] Supabase target:", redacted);
  return createClient(url, serviceKey);
}

/** Resolve profile id by stripe_customer_id (for subscription events when metadata is missing). */
async function getProfileIdByStripeCustomerId(
  supabaseAdmin: SupabaseClient,
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

/** Build billing intelligence fields from a Stripe subscription (for profiles). */
function subscriptionToIntelligenceFields(sub: Stripe.Subscription): {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_effective_at: string | null;
  subscription_started_at: string | null;
} {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  const currentPeriodEnd = (sub as { current_period_end?: number }).current_period_end;
  const start = (sub as { start?: number }).start;
  const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
  const currentPeriodEndIso = currentPeriodEnd != null ? new Date(currentPeriodEnd * 1000).toISOString() : null;
  return {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    current_period_end: currentPeriodEndIso,
    cancel_at_period_end: cancelAtPeriodEnd,
    cancel_effective_at: cancelAtPeriodEnd ? currentPeriodEndIso : null,
    subscription_started_at: start != null ? new Date(start * 1000).toISOString() : null,
  };
}

function mapStripeToStatus(sub: Stripe.Subscription): {
  subscription_status: string;
  trial_ends_at: string | null;
} {
  if (sub.status === "trialing") {
    return {
      subscription_status: "trial",
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    };
  }
  if (sub.status === "active") {
    return { subscription_status: "active", trial_ends_at: null };
  }
  if (sub.status === "past_due" || sub.status === "unpaid") {
    return { subscription_status: "past_due", trial_ends_at: null };
  }
  if (sub.status === "canceled") {
    return { subscription_status: "canceled", trial_ends_at: null };
  }
  return { subscription_status: "free", trial_ends_at: null };
}

/** Get subscription tier from subscription (metadata.tier or price id mapping). */
function tierFromSubscription(sub: Stripe.Subscription): string | null {
  const fromMeta = sub.metadata?.tier?.trim();
  if (fromMeta) return fromMeta;
  const priceId = sub.items?.data?.[0]?.price?.id;
  return tierFromPriceId(priceId);
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] FATAL: STRIPE_WEBHOOK_SECRET is not set. Set it in Vercel (Production) to the webhook signing secret.");
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook] Invalid signature or secret mismatch. Check STRIPE_WEBHOOK_SECRET matches the endpoint signing secret.", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[webhook] FATAL: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Webhook cannot write to Supabase.");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const eventType = event.type;

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

      // Resolve Supabase user id ONLY from client_reference_id (not email, not metadata)
      const userId = session.client_reference_id?.trim() || null;
      if (!userId) {
        console.warn("[webhook] checkout.session.completed: no client_reference_id, skipping profile update. session_id=", session.id);
        return NextResponse.json({ ok: true });
      }
      if (!subscriptionId) {
        console.warn("[webhook] checkout.session.completed: no subscription id, session_id=", session.id);
        return NextResponse.json({ ok: true });
      }

      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      const mapped = mapStripeToStatus(subscription);
      const intelligence = subscriptionToIntelligenceFields(subscription);
      const tier = session.metadata?.tier?.trim() || tierFromSubscription(subscription);

      console.log("[webhook]", JSON.stringify({
        event: eventType,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: mapped.subscription_status,
        trial_end: subscription.trial_end ?? null,
        supabase_user_id: userId,
      }));

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: mapped.subscription_status,
          subscription_tier: tier,
          trial_ends_at: mapped.trial_ends_at,
          stripe_customer_id: intelligence.stripe_customer_id,
          stripe_subscription_id: intelligence.stripe_subscription_id,
          current_period_end: intelligence.current_period_end,
          cancel_at_period_end: intelligence.cancel_at_period_end,
          cancel_effective_at: intelligence.cancel_effective_at,
          subscription_started_at: intelligence.subscription_started_at,
        })
        .eq("id", userId);

      if (error) {
        console.error("[webhook] checkout.session.completed profile update failed", error);
        return NextResponse.json({ error: "Profile update failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

      let userId: string | null = sub.metadata?.user_id?.trim() ?? null;
      if (!userId && customerId) {
        userId = await getProfileIdByStripeCustomerId(supabaseAdmin, customerId);
      }
      if (!userId) {
        console.warn("[webhook] subscription event: no user_id (metadata or stripe_customer_id lookup), subscription_id=", sub.id);
        return NextResponse.json({ ok: true });
      }

      const mapped = mapStripeToStatus(sub);
      const intelligence = subscriptionToIntelligenceFields(sub);
      const tier = tierFromSubscription(sub);

      console.log("[webhook]", JSON.stringify({
        event: eventType,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: mapped.subscription_status,
        trial_end: sub.trial_end ?? null,
        supabase_user_id: userId,
      }));

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: mapped.subscription_status,
          subscription_tier: tier,
          trial_ends_at: mapped.trial_ends_at,
          stripe_customer_id: intelligence.stripe_customer_id,
          stripe_subscription_id: intelligence.stripe_subscription_id,
          current_period_end: intelligence.current_period_end,
          cancel_at_period_end: intelligence.cancel_at_period_end,
          cancel_effective_at: intelligence.cancel_effective_at,
          subscription_started_at: intelligence.subscription_started_at,
        })
        .eq("id", userId);

      if (error) {
        console.error("[webhook] subscription event profile update failed", error);
        return NextResponse.json({ error: "Profile update failed" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceId = invoice.id;
      const amountPaidCents = invoice.amount_paid ?? 0;

      if (amountPaidCents <= 0) {
        console.log("[webhook] invoice.paid: skipped (0 or missing amount), invoice", invoiceId);
        return NextResponse.json({ ok: true });
      }

      const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
      let userId: string | null = stripeCustomerId
        ? await getProfileIdByStripeCustomerId(supabaseAdmin, stripeCustomerId)
        : null;
      if (!userId) userId = invoice.metadata?.user_id ?? null;
      const invoiceSub = (invoice as { subscription?: string | { id?: string } }).subscription;
      if (!userId && invoiceSub) {
        const subId = typeof invoiceSub === "string" ? invoiceSub : invoiceSub?.id;
        if (subId) {
          try {
            const sub = await getStripe().subscriptions.retrieve(subId);
            userId = sub.metadata?.user_id ?? null;
          } catch {
            // ignore
          }
        }
      }
      if (!userId) {
        return NextResponse.json({ ok: true });
      }

      if (stripeCustomerId) {
        await supabaseAdmin.from("profiles").update({ stripe_customer_id: stripeCustomerId }).eq("id", userId);
      }

      const amountPounds = amountPaidCents / 100;
      const { error: insertError } = await supabaseAdmin
        .from("billing_processed_invoices")
        .insert({
          profile_id: userId,
          stripe_invoice_id: invoiceId,
          amount_pence: amountPaidCents,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          console.log("[webhook] invoice.paid: already processed", invoiceId, "profile", userId);
          return NextResponse.json({ ok: true });
        }
        console.error("[webhook] invoice.paid: insert failed", insertError);
        return NextResponse.json({ ok: true });
      }

      const { error: rpcError } = await supabaseAdmin.rpc("increment_profile_lifetime_value", {
        p_profile_id: userId,
        p_amount_pounds: amountPounds,
      });

      if (rpcError) {
        console.error("[webhook] invoice.paid: lifetime_value increment failed", rpcError);
      } else {
        console.log("[webhook] invoice.paid: lifetime_value incremented by", amountPounds, "pounds, profile", userId, "invoice", invoiceId);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] handler failed", eventType, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
