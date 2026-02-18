import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

// IMPORTANT: Webhooks must use the raw body for signature verification.
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey);
}

/** Resolve profile id by stripe_customer_id (primary for invoice.paid). */
async function getProfileIdByStripeCustomerId(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Build billing intelligence fields from a Stripe subscription (for profiles). */
function subscriptionToIntelligenceFields(sub: Stripe.Subscription): {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  subscription_started_at: string | null;
} {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  const currentPeriodEnd = (sub as { current_period_end?: number }).current_period_end;
  const start = (sub as { start?: number }).start;
  return {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    current_period_end: currentPeriodEnd != null ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    subscription_started_at: start != null ? new Date(start * 1000).toISOString() : null,
  };
}

function mapStripeToStatus(sub: Stripe.Subscription): {
  subscription_status: string;
  trial_ends_at: string | null;
} {
  // Stripe statuses: trialing, active, past_due, canceled, unpaid, incomplete, incomplete_expired, paused
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

  if (sub.status === "canceled" || sub.cancel_at_period_end) {
    return { subscription_status: "canceled", trial_ends_at: null };
  }

  // Default fallback
  return { subscription_status: "free", trial_ends_at: null };
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    // 1) When checkout completes, grab subscription + user_id/tier from metadata
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.user_id;
      const tier = session.metadata?.tier || null;

      // session.subscription is the subscription ID in subscription mode
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      if (!userId || !subscriptionId) {
        return NextResponse.json({ ok: true });
      }

      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      const mapped = mapStripeToStatus(subscription);
      const intelligence = subscriptionToIntelligenceFields(subscription);

      console.log("[webhook] checkout.session.completed: profile", userId, "stripe_customer_id", intelligence.stripe_customer_id, "stripe_subscription_id", intelligence.stripe_subscription_id);

      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: mapped.subscription_status,
          subscription_tier: tier,
          trial_ends_at: mapped.trial_ends_at,
          stripe_customer_id: intelligence.stripe_customer_id,
          stripe_subscription_id: intelligence.stripe_subscription_id,
          current_period_end: intelligence.current_period_end,
          cancel_at_period_end: intelligence.cancel_at_period_end,
          subscription_started_at: intelligence.subscription_started_at,
        })
        .eq("id", userId);

      return NextResponse.json({ ok: true });
    }

    // 2) Subscription status changes (trial -> active, past_due, canceled, etc.) + created (stripe_customer_id etc.)
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;

      const userId = sub.metadata?.user_id;
      const tier = sub.metadata?.tier || null;

      if (!userId) {
        return NextResponse.json({ ok: true });
      }

      const mapped = mapStripeToStatus(sub);
      const intelligence = subscriptionToIntelligenceFields(sub);

      console.log("[webhook] subscription event:", event.type, "profile", userId, "stripe_subscription_id", intelligence.stripe_subscription_id, "current_period_end", intelligence.current_period_end);

      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: mapped.subscription_status,
          subscription_tier: tier,
          trial_ends_at: mapped.trial_ends_at,
          stripe_customer_id: intelligence.stripe_customer_id,
          stripe_subscription_id: intelligence.stripe_subscription_id,
          current_period_end: intelligence.current_period_end,
          cancel_at_period_end: intelligence.cancel_at_period_end,
          subscription_started_at: intelligence.subscription_started_at,
        })
        .eq("id", userId);

      return NextResponse.json({ ok: true });
    }

    // 3) Invoice paid: increment lifetime_value once per invoice (idempotent, atomic)
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceId = invoice.id;
      const amountPaidCents = invoice.amount_paid ?? 0;

      if (amountPaidCents <= 0) {
        console.log("[webhook] invoice.paid: skipped (0 or missing amount), invoice", invoiceId);
        return NextResponse.json({ ok: true });
      }

      const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;

      // Resolve profile_id: primary by stripe_customer_id, fallback to metadata
      let userId: string | null = stripeCustomerId
        ? await getProfileIdByStripeCustomerId(supabaseAdmin, stripeCustomerId)
        : null;
      if (!userId) {
        userId = invoice.metadata?.user_id ?? null;
      }
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
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
