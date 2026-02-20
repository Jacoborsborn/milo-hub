# Stripe → Supabase Webhook Audit & Fix

## 1) Webhook chain (identified)

| Step | Location | Evidence |
|------|----------|----------|
| **Stripe dashboard URL** | Configure in Stripe → Developers → Webhooks | Must be `https://<vercel-domain>/api/billing/webhook` (not `/api/stripe/webhook` – no such route). |
| **Next.js handler** | `src/app/api/billing/webhook/route.ts` | Only webhook in repo; uses `getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret)`. |
| **Signature verification** | Same file, POST handler | Reads `stripe-signature`, uses `STRIPE_WEBHOOK_SECRET`, `req.text()` for raw body (correct for App Router). |
| **Event routing** | Same file | `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_succeeded`. |
| **Supabase update** | Same file | `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` → `from("profiles").update(...).eq("id", userId)`. Service role bypasses RLS. |
| **Errors** | Same file | No longer swallowed: missing user id → 500; Supabase error → logged and 500. |

**Checkout session creation (two entrypoints):**

- Signup: `src/components/signup/SignupWizard.tsx` → `POST /api/stripe/checkout` → `src/app/api/stripe/checkout/route.ts`
- Billing page: `src/app/pt/app/billing/page.tsx` → `POST /api/billing/create-checkout` → `src/app/api/billing/create-checkout/route.ts`

Both now set `metadata.supabase_user_id`, `metadata.user_id`, `client_reference_id`, and `subscription_data.metadata` with the same ids.

**Stripe client:** `src/lib/stripe.ts` – `getStripe()` uses `STRIPE_SECRET_KEY`, API version `2026-01-28.clover`.

---

## 2) Files inspected

- **Webhook:** `src/app/api/billing/webhook/route.ts` – single handler; raw body via `req.text()`; service role Supabase.
- **Stripe lib:** `src/lib/stripe.ts` – lazy init, `STRIPE_SECRET_KEY`.
- **Checkout:** `src/app/api/stripe/checkout/route.ts` and `src/app/api/billing/create-checkout/route.ts` – both create session with metadata + client_reference_id.
- **Env usage:** `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` in webhook; doc `docs/SUPABASE_ENV_AUDIT.md` references billing webhook.
- **Mapping:** User id from session/subscription metadata (`supabase_user_id` or `user_id`) or, for subscription events, lookup by `profiles.stripe_customer_id` via `getProfileIdByStripeCustomerId`.

---

## 3) Checklist of failure points

| # | Point | Status | Evidence |
|---|--------|--------|----------|
| A | Wrong webhook URL in Stripe | **Verify in dashboard** | Code expects path `/api/billing/webhook`. No `/api/stripe/webhook` route. |
| B | `STRIPE_WEBHOOK_SECRET` mismatch | **Set per environment** | Used in `constructEvent`. Wrong secret → 400 + log "Invalid signature". Ensure Production (and Preview if used) have the secret for that endpoint. |
| C | Raw body | **OK** | App Router; `req.text()` used; no body parser. |
| D | Event types | **OK + improved** | checkout.session.completed, customer.subscription.* handled. `invoice.payment_succeeded` added (Stripe’s main event); already had `invoice.paid`. |
| E | Customer mapping | **Fixed** | Checkout now sends `metadata.supabase_user_id` and `metadata.user_id`; subscription_data.metadata same. Webhook resolves userId from `metadata.supabase_user_id` \|\| `metadata.user_id` \|\| `client_reference_id` (checkout) or subscription metadata / `stripe_customer_id` lookup. |
| F | Supabase update | **OK** | Service role; table `public.profiles`; `.eq("id", userId)` with Supabase user uuid. `current_period_end` and `cancel_effective_at` columns exist (migrations). |
| G | 2xx despite failure | **Fixed** | Missing user id or Supabase error now returns 500 and logs; 200 only after successful update. |
| H | Vercel not receiving | **Verify** | Check Vercel function logs for `[webhook] event <id> <type>`. If nothing, URL or network/firewall issue. |

---

## 4) Logging added

- Incoming: `[webhook] event <event.id> <event.type>`.
- After resolving user: `[webhook] resolved` with `event_id`, `stripe_customer_id`, `supabase_user_id`, `update_payload`.
- On Supabase error: `[webhook] ... Supabase update error (do not swallow)` and full error object.
- Invoice: same pattern; errors logged and 500 returned where appropriate.

All visible in Vercel function logs for the webhook route.

---

## 5) Root cause (inferred)

1. **User id not reliably available** – Webhook used only `client_reference_id` for checkout and only `sub.metadata.user_id` for subscription events. If `client_reference_id` was ever missing or subscription metadata not set, the handler returned **200** and skipped the update, so Stripe did not retry and Supabase was never updated.
2. **Silent skips** – Returning 200 when "no user id" or on some invoice failures made it look like "webhook works but DB doesn’t update"; the real issue was skipped updates.
3. **Invoice event name** – Only `invoice.paid` was handled; Stripe typically sends `invoice.payment_succeeded`. Both are now handled.

---

## 6) Code changes (patch-style)

### 6.1 `src/app/api/billing/webhook/route.ts`

- Log at start: `event.id`, `event.type`.
- **checkout.session.completed:** Resolve userId from `session.metadata.supabase_user_id` \|\| `session.metadata.user_id` \|\| `session.client_reference_id`. If no userId → **500** and log. Log `resolved` (stripe_customer_id, supabase_user_id, update_payload). On Supabase error → log and **500**.
- **customer.subscription.\***: Resolve userId from `sub.metadata.supabase_user_id` \|\| `sub.metadata.user_id` \|\| `getProfileIdByStripeCustomerId`. If no userId → **500**. Same logging and error handling.
- **invoice:** Handle both `invoice.paid` and `invoice.payment_succeeded`; use `metadata.supabase_user_id` / `user_id` where needed; on insert or RPC failure return **500** and log (no silent 200).
- Doc comment at top: endpoint URL, env vars, handled events, 200-only-after-success.

### 6.2 `src/app/api/stripe/checkout/route.ts`

- In `checkout.sessions.create`: `metadata: { supabase_user_id: userData.user.id, user_id: userData.user.id, tier }`, `subscription_data.metadata: { supabase_user_id: ..., user_id: ..., tier }`.

### 6.3 `src/app/api/billing/create-checkout/route.ts`

- Same metadata and `subscription_data.metadata` as above.

---

## 7) How to verify

1. **Stripe dashboard**
   - Webhook endpoint: `https://<production-domain>/api/billing/webhook`.
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_succeeded`.
   - Signing secret copied into Vercel as `STRIPE_WEBHOOK_SECRET` (Production).

2. **Stripe CLI (local or prod)**
   - Forward: `stripe listen --forward-to https://<host>/api/billing/webhook` (use CLI’s secret in env for local).
   - Trigger: `stripe trigger checkout.session.completed` (or subscription events).
   - In Vercel logs: `[webhook] event evt_xxx checkout.session.completed`, then `[webhook] resolved` with `supabase_user_id` and `update_payload`.

3. **Supabase**
   - After a successful webhook, row in `public.profiles` for that user id: `subscription_status`, `subscription_tier`, `trial_ends_at`, `stripe_customer_id`, `current_period_end` updated as expected.

4. **Failure path**
   - Temporarily break `STRIPE_WEBHOOK_SECRET` or pass a session with no metadata/user id: expect 400 or 500 and no DB update; Stripe retries on 500.

---

## Env vars (Vercel)

- **Production (and Preview if you receive webhooks there):**  
  `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`, `NEXT_PUBLIC_APP_URL`.
