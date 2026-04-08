import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendTrialStartedEmail, sendWelcomeToTeamEmail } from "@/lib/email/resend";
import { emailAlreadySent, logEmailSent } from "@/lib/email/check-and-log";

/**
 * Stripe webhook handler. Updates Supabase profiles from subscription/trial events.
 *
 * Stripe dashboard: set endpoint to https://<your-domain>/api/billing/webhook
 * Env: STRIPE_WEBHOOK_SECRET (signing secret for this endpoint), SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 *
 * Handled events: checkout.session.completed, customer.subscription.created/updated/deleted,
 * invoice.paid, invoice.payment_succeeded. Returns 200 only after successful Supabase update; 500 on failure (Stripe retries).
 */
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
  console.log("[supabase billing/webhook getSupabaseAdmin] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
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

/** Build billing intelligence fields from a Stripe subscription (for profiles). Omits cancel_at_period_end (not in schema). */
function subscriptionToIntelligenceFields(sub: Stripe.Subscription): {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
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

/**
 * Send trial-started email once per user. Idempotent via trial_started_email_sent_at.
 * Returns error message if send failed (caller can return 500); otherwise void.
 */
async function sendTrialStartedEmailIfNeeded(
  supabaseAdmin: SupabaseClient,
  userId: string,
  options: { sessionCustomerEmail?: string | null; stripeCustomerId?: string | null }
): Promise<string | null> {
  const { data: profileRow } = await supabaseAdmin
    .from("profiles")
    .select("trial_started_email_sent_at, email")
    .eq("id", userId)
    .single();

  if (profileRow?.trial_started_email_sent_at) {
    console.log("[webhook] trial email skip: already sent", { userId });
    return null;
  }

  let to =
    options.sessionCustomerEmail?.trim() ||
    (profileRow as { email?: string } | null)?.email?.trim() ||
    null;
  if (!to && options.stripeCustomerId) {
    try {
      const customer = await getStripe().customers.retrieve(options.stripeCustomerId);
      to = (customer as Stripe.Customer).email?.trim() || null;
      if (to) console.log("[webhook] trial email: using Stripe customer email", { userId });
    } catch (e) {
      console.warn("[webhook] trial email: Stripe customer retrieve failed", options.stripeCustomerId, e);
    }
  }

  if (!to) {
    console.warn("[webhook] trial email skip: no address", {
      userId,
      hadSessionEmail: !!options.sessionCustomerEmail?.trim(),
      hadProfileEmail: !!(profileRow as { email?: string } | null)?.email?.trim(),
      hadStripeCustomerId: !!options.stripeCustomerId,
    });
    return null;
  }

  let desktopUrl: string | undefined;
  try {
    if (process.env.NEXT_PUBLIC_APP_URL)
      desktopUrl = `${new URL(process.env.NEXT_PUBLIC_APP_URL).origin}/pt/login`;
  } catch {
    // use default from resend.ts
  }

  console.log("[webhook] trial email sending", { userId, to, hasDesktopUrl: !!desktopUrl });
  const sendResult = await sendTrialStartedEmail({ to, ...(desktopUrl && { desktopUrl }) });
  if (sendResult.error) {
    console.error("[webhook] trial email failed", { userId, to, error: sendResult.error });
    return sendResult.error;
  }
  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({ trial_started_email_sent_at: new Date().toISOString() })
    .eq("id", userId);
  if (updateErr) {
    console.error("[webhook] trial_started_email_sent_at update failed", updateErr);
  }
  console.log("[webhook] trial email sent", { userId, to });
  return null;
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

  // Decisive logging: event id + type (visible in Vercel function logs)
  console.log("[webhook] event", event.id, event.type);

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

      // Resolve Supabase user id: metadata.supabase_user_id (preferred) | metadata.user_id | client_reference_id
      const userId =
        session.metadata?.supabase_user_id?.trim() ||
        session.metadata?.user_id?.trim() ||
        session.client_reference_id?.trim() ||
        null;
      if (!userId) {
        console.error("[webhook] checkout.session.completed: no user id (metadata.supabase_user_id, metadata.user_id, or client_reference_id). session_id=", session.id);
        return NextResponse.json({ error: "Cannot resolve user" }, { status: 500 });
      }
      if (!subscriptionId) {
        console.warn("[webhook] checkout.session.completed: no subscription id, session_id=", session.id);
        return NextResponse.json({ ok: true });
      }

      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      const mapped = mapStripeToStatus(subscription);
      const intelligence = subscriptionToIntelligenceFields(subscription);
      const tier = session.metadata?.tier?.trim() || tierFromSubscription(subscription);

      const updatePayload = {
        subscription_status: mapped.subscription_status,
        subscription_tier: tier,
        trial_ends_at: mapped.trial_ends_at,
        stripe_customer_id: intelligence.stripe_customer_id,
        stripe_subscription_id: intelligence.stripe_subscription_id,
        current_period_end: intelligence.current_period_end,
        cancel_effective_at: intelligence.cancel_effective_at,
        subscription_started_at: intelligence.subscription_started_at,
      };
      console.log("[webhook] resolved", { event_id: event.id, stripe_customer_id: customerId, supabase_user_id: userId, update_payload: updatePayload });

      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, ...updatePayload }, { onConflict: "id" })
        .select()
        .single();

      if (error) {
        console.error("[webhook] profiles upsert error", { eventId: event.id, userId, error });
        return NextResponse.json({ error: "Profile update failed", details: error.message }, { status: 500 });
      }
      console.log("[webhook] profiles upsert ok", { eventId: event.id, userId });

      // Trial started email: send once per user (idempotent via trial_started_email_sent_at).
      if (mapped.subscription_status === "trial") {
        const sessionEmail = (session.customer_email as string | undefined)?.trim() || null;
        const err = await sendTrialStartedEmailIfNeeded(supabaseAdmin, userId, {
          sessionCustomerEmail: sessionEmail,
          stripeCustomerId: customerId,
        });
        if (err) {
          return NextResponse.json({ error: "Trial email send failed" }, { status: 500 });
        }
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

      let userId: string | null =
        sub.metadata?.supabase_user_id?.trim() ||
        sub.metadata?.user_id?.trim() ||
        null;
      if (!userId && customerId) {
        userId = await getProfileIdByStripeCustomerId(supabaseAdmin, customerId);
      }
      if (!userId) {
        console.error("[webhook] subscription event: no user id (metadata.supabase_user_id, metadata.user_id, or stripe_customer_id lookup). subscription_id=", sub.id);
        return NextResponse.json({ error: "Cannot resolve user" }, { status: 500 });
      }

      const mapped = mapStripeToStatus(sub);
      const intelligence = subscriptionToIntelligenceFields(sub);
      const tier = tierFromSubscription(sub);

      const updatePayload = {
        subscription_status: mapped.subscription_status,
        subscription_tier: tier,
        trial_ends_at: mapped.trial_ends_at,
        stripe_customer_id: intelligence.stripe_customer_id,
        stripe_subscription_id: intelligence.stripe_subscription_id,
        current_period_end: intelligence.current_period_end,
        cancel_effective_at: intelligence.cancel_effective_at,
        subscription_started_at: intelligence.subscription_started_at,
      };
      console.log("[webhook] resolved", { event_id: event.id, stripe_customer_id: customerId, supabase_user_id: userId, update_payload: updatePayload });

      const { error } = await supabaseAdmin
        .from("profiles")
        .update(updatePayload)
        .eq("id", userId);

      if (error) {
        console.error("[webhook] subscription event Supabase update error (do not swallow)", error);
        return NextResponse.json({ error: "Profile update failed" }, { status: 500 });
      }

      // Fallback: send trial-started email on subscription.created (in case checkout.session.completed had no email yet).
      if (
        event.type === "customer.subscription.created" &&
        mapped.subscription_status === "trial"
      ) {
        const err = await sendTrialStartedEmailIfNeeded(supabaseAdmin, userId, {
          stripeCustomerId: customerId,
        });
        if (err) {
          console.error("[webhook] trial email failed on subscription.created", { userId, error: err });
          // Don't return 500: profile is already updated; Stripe would retry the whole event.
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Handle both invoice.paid (out-of-band) and invoice.payment_succeeded (Stripe's primary event)
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceId = invoice.id;
      const amountPaidCents = invoice.amount_paid ?? 0;

      if (amountPaidCents <= 0) {
        console.log("[webhook]", event.type, "skipped (0 or missing amount), invoice", invoiceId);
        return NextResponse.json({ ok: true });
      }

      const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
      let userId: string | null = stripeCustomerId
        ? await getProfileIdByStripeCustomerId(supabaseAdmin, stripeCustomerId)
        : null;
      if (!userId) userId = invoice.metadata?.supabase_user_id?.trim() || invoice.metadata?.user_id?.trim() || null;
      const invoiceSub = (invoice as { subscription?: string | { id?: string } }).subscription;
      if (!userId && invoiceSub) {
        const subId = typeof invoiceSub === "string" ? invoiceSub : invoiceSub?.id;
        if (subId) {
          try {
            const sub = await getStripe().subscriptions.retrieve(subId);
            userId = sub.metadata?.supabase_user_id?.trim() || sub.metadata?.user_id?.trim() || null;
          } catch {
            // ignore
          }
        }
      }
      if (!userId) {
        console.log("[webhook]", event.type, "no user id for invoice", invoiceId, "- skipping lifetime_value");
        return NextResponse.json({ ok: true });
      }

      // First payment (subscription just created): send welcome-to-team email once
      const billingReason = (invoice as { billing_reason?: string }).billing_reason;
      if (billingReason === "subscription_create") {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, email")
          .eq("id", userId)
          .maybeSingle();

        if (profile?.email) {
          const alreadySent = await emailAlreadySent(profile.id, "welcome_to_team");
          if (!alreadySent) {
            const sendResult = await sendWelcomeToTeamEmail({ to: profile.email });
            if (!sendResult.error) {
              await logEmailSent(profile.id, "welcome_to_team");
            }
          }
        }
      }

      if (stripeCustomerId) {
        const { error: custErr } = await supabaseAdmin.from("profiles").update({ stripe_customer_id: stripeCustomerId }).eq("id", userId);
        if (custErr) console.error("[webhook]", event.type, "stripe_customer_id update failed", custErr);
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
          console.log("[webhook]", event.type, "already processed", invoiceId, "profile", userId);
          return NextResponse.json({ ok: true });
        }
        console.error("[webhook]", event.type, "insert failed", insertError);
        return NextResponse.json({ error: "Invoice insert failed" }, { status: 500 });
      }

      const { error: rpcError } = await supabaseAdmin.rpc("increment_profile_lifetime_value", {
        p_profile_id: userId,
        p_amount_pounds: amountPounds,
      });

      if (rpcError) {
        console.error("[webhook]", event.type, "lifetime_value increment failed", rpcError);
        return NextResponse.json({ error: "Lifetime value update failed" }, { status: 500 });
      }
      console.log("[webhook]", event.type, "lifetime_value incremented by", amountPounds, "profile", userId, "invoice", invoiceId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] handler failed", eventType, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
