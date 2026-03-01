# Direct-to-Customer Email System — Audit

**Scope:** All non-auth emails: “your plan is ready” (to client), “draft ready” (to PT), “client needs plan”, trial/welcome/loyalty (to PT).  
**Excluded:** Classic auth (login OTP, forgot password, verify) — left as-is.

**Conclusion:** The system is **correctly wired** end-to-end. All direct-to-customer email types have a defined trigger, use Resend, and (where intended) use `pt_email_log` for deduplication. Delivery depends on env (see checklist below).

---

## 1. Email inventory (non-auth)

| # | Email | Recipient | Subject / purpose | Implemented in |
|---|--------|-----------|-------------------|-----------------|
| 1 | **Your plan is ready** | **Client** | “Your plan is ready” — share link to view plan | `src/lib/email-plan-send.ts` → `sendPlanReadyEmail` |
| 2 | **New plan ready to review** | **PT** | “New plan ready to review” — autogen draft created | `src/lib/email/resend.ts` → `sendAutogenPlanReadyEmail` |
| 3 | **Trial started** | PT | “Trial started — welcome in” | `src/lib/email/resend.ts` → `sendTrialStartedEmail` |
| 4 | **Trial ending soon** | PT | “Your trial ends tomorrow” | `src/lib/email/resend.ts` → `sendTrialEndingSoonEmail` |
| 5 | **Welcome to the team** | PT | “Welcome to the team” (first payment) | `src/lib/email/resend.ts` → `sendWelcomeToTeamEmail` |
| 6 | **Loyalty reward** | PT | “A thank you from us” (30% off next month) | `src/lib/email/resend.ts` → `sendLoyaltyRewardEmail` |
| 7 | **Client plan due soon** | PT | “Client plan due soon” — client needs a plan | `src/lib/email/resend.ts` → `sendClientPlanDueSoonEmail` |

---

## 2. Trigger and wiring (per email)

### 2.1 Your plan is ready (to **client**)

- **Trigger:** PT clicks “Send” / “Review & send” for a plan on the Review Plans page.
- **Flow:** `src/app/pt/app/review-plans/page.tsx` → `handleReviewAndSend(planId)` → `POST /api/plans/send` with `{ planId }` → `sendPlanReadyEmail(...)` (Resend).
- **Auth:** Session (supabase auth). Plan and client must belong to current user (`pt_user_id` / `pt_id`).
- **Dedup:** None (one send per PT action).
- **Requirements:**  
  - `RESEND_API_KEY` (Vercel)  
  - `PLAN_SHARE_SECRET` (for share link)  
  - `NEXT_PUBLIC_APP_URL` (for share URL)  
  - Client must have valid `email`; PT must have `email`.
- **Status:** Wired. Plan is updated to `review_status: 'sent'`, `sent_at`, `last_sent_to`, `last_sent_subject`.

---

### 2.2 New plan ready to review (to **PT** — autogen draft)

- **Trigger:** Edge function `pt-autogen-drafts` creates a draft plan (workout and/or meal); then calls Next.js internal API.
- **Flow:**  
  - Edge: `sendPlanReadyEmailToPt(...)` → `POST ${APP_URL}/api/internal/send-plan-ready` with `x-internal-secret: AUTOGEN_SECRET` and body `{ ptUserId, ptEmail, clientName, planType, planId }`.  
  - Next.js: `POST /api/internal/send-plan-ready` → `emailAlreadySent(ptUserId, "autogen_plan_ready_<planId>")` → `sendAutogenPlanReadyEmail({ to, clientName, planType, reviewUrl })` → `logEmailSent(...)`.
- **Auth:** Internal: `x-internal-secret` must equal `CRON_SECRET` or `AUTOGEN_SECRET`.
- **Dedup:** `pt_email_log` key `autogen_plan_ready_<planId>` (one email per plan).
- **Requirements:**  
  - **Supabase Edge:** `APP_URL` set to full Next.js app URL (e.g. `https://your-app.vercel.app`). If missing, edge **never calls** send-plan-ready (no error).  
  - **Vercel:** `CRON_SECRET` or `AUTOGEN_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Status:** Wired. If `APP_URL` is not set in Supabase, this email is silently skipped.

---

### 2.3 Trial started (to PT)

- **Trigger:** Stripe `checkout.session.completed` or `customer.subscription.created` with `subscription_status === "trial"`.
- **Flow:** `POST /api/billing/webhook` → `sendTrialStartedEmailIfNeeded(...)` → `sendTrialStartedEmail({ to, desktopUrl })`. After send, profile `trial_started_email_sent_at` is set (idempotent).
- **Auth:** Stripe signature; webhook secret.
- **Dedup:** Profile field `trial_started_email_sent_at`; fallback by Stripe customer email.
- **Requirements:** `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`. Optional: `NEXT_PUBLIC_APP_URL` for desktop link in email.
- **Status:** Wired.

---

### 2.4 Trial ending soon (to PT)

- **Trigger:** Daily cron (same run as autogen). Profiles where `trial_ends_at` is tomorrow and `subscription_status = 'trial'`.
- **Flow:** `GET/POST /api/cron/autogen-drafts` (with `CRON_SECRET` or `AUTOGEN_SECRET`) → after calling edge, cron runs “optional” block → `emailAlreadySent(profile.id, "trial_ending_soon")` → `sendTrialEndingSoonEmail({ to })` → `logEmailSent(profile.id, "trial_ending_soon")`.
- **Auth:** Cron: `Authorization: Bearer <CRON_SECRET>` or body `{ secret }`.
- **Dedup:** `pt_email_log` key `trial_ending_soon` per profile.
- **Requirements:** `SUPABASE_SERVICE_ROLE_KEY` on Vercel (cron uses it for this block). `RESEND_API_KEY`. Cron must be invoked (e.g. Vercel Cron 06:00 UTC).
- **Status:** Wired.

---

### 2.5 Welcome to the team (to PT)

- **Trigger:** Stripe `invoice.paid` or `invoice.payment_succeeded` with `billing_reason === "subscription_create"` (first payment).
- **Flow:** `POST /api/billing/webhook` → load profile → `emailAlreadySent(profile.id, "welcome_to_team")` → `sendWelcomeToTeamEmail({ to: profile.email })` → `logEmailSent(profile.id, "welcome_to_team")`.
- **Auth:** Stripe signature.
- **Dedup:** `pt_email_log` key `welcome_to_team` per profile.
- **Requirements:** `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Status:** Wired.

---

### 2.6 Loyalty reward (to PT)

- **Trigger:** Daily cron. Profiles where `subscription_started_at` is ~25 days ago (24–26 day window) and `subscription_status = 'active'`.
- **Flow:** Same cron route → optional block → `emailAlreadySent(profile.id, "loyalty_reward")` → optionally `POST ${baseUrl}/api/billing/apply-loyalty-reward` → `sendLoyaltyRewardEmail({ to })` → `logEmailSent(profile.id, "loyalty_reward")`.
- **Auth:** Cron secret.
- **Dedup:** `pt_email_log` key `loyalty_reward` per profile.
- **Requirements:** `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) for apply-loyalty-reward; cron secret for that internal call.
- **Status:** Wired.

---

### 2.7 Client plan due soon (to PT)

- **Trigger:** Daily cron. Clients whose last **sent** plan (`plans.review_status = 'sent'`, `sent_at` not null) was 6+ days ago; one email per PT per client (key `due_soon_<client_id>`).
- **Flow:** Cron → optional block → for each such client, PT email from profiles → `emailAlreadySent(client.pt_id, "due_soon_<client_id>")` → `sendClientPlanDueSoonEmail({ to, clientName, daysUntilDue: 1 })` → `logEmailSent(client.pt_id, emailKey, { client_id })`.
- **Auth:** Cron secret.
- **Dedup:** `pt_email_log` key `due_soon_<client_id>` per PT.
- **Requirements:** `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`. Clients table must have `pt_id`; profiles must have `email`.
- **Status:** Wired.

---

## 3. Shared infrastructure

| Component | Purpose |
|-----------|--------|
| **Resend** | All sending via `RESEND_API_KEY`. From: `Jacob at Milo Hub <hello@meetmilo.app>` (resend.ts) or `Milo Hub <no-reply@meetmilo.app>` (email-plan-send.ts). |
| **pt_email_log** | Dedupe for: autogen_plan_ready_&lt;planId&gt;, trial_ending_soon, welcome_to_team, loyalty_reward, due_soon_&lt;client_id&gt;. Used by `emailAlreadySent` / `logEmailSent` in `src/lib/email/check-and-log.ts` (requires `SUPABASE_SERVICE_ROLE_KEY`). |
| **check-and-log** | Uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; throws if missing. |

---

## 4. Where it can break (summary)

| Issue | Impact |
|-------|--------|
| **APP_URL not set in Supabase** (edge env) | “New plan ready to review” email **never sent** (edge never calls send-plan-ready). No error. |
| **RESEND_API_KEY unset (Vercel)** | All Resend-based emails fail (plan-ready to client, autogen to PT, trial, welcome, loyalty, due soon). |
| **SUPABASE_SERVICE_ROLE_KEY unset (Vercel)** | send-plan-ready fails (emailAlreadySent/logEmailSent); cron optional block fails (trial ending, loyalty, due soon). |
| **NEXT_PUBLIC_APP_URL unset (Vercel)** | Share link in “Your plan is ready” and review link in “New plan ready to review” may be relative or wrong. |
| **AUTOGEN_SECRET / CRON_SECRET mismatch** (edge vs Vercel) | Cron or send-plan-ready returns 401; autogen or draft email fails. |
| **pt_email_log table missing** | emailAlreadySent/logEmailSent throw; send-plan-ready and cron email block fail. |

---

## 5. Verification checklist

Use this to confirm direct-to-customer emails are correctly wired in your environment.

- [ ] **Vercel:** `RESEND_API_KEY` set.
- [ ] **Vercel:** `SUPABASE_SERVICE_ROLE_KEY` set (for send-plan-ready and cron emails).
- [ ] **Vercel:** `NEXT_PUBLIC_APP_URL` set (for share links and review links).
- [ ] **Vercel:** `PLAN_SHARE_SECRET` set (for “Your plan is ready” share link).
- [ ] **Vercel:** `CRON_SECRET` or `AUTOGEN_SECRET` set (cron + send-plan-ready auth).
- [ ] **Supabase Edge (pt-autogen-drafts):** `APP_URL` set to full Next.js app URL (so “New plan ready to review” is sent).
- [ ] **Supabase Edge:** `AUTOGEN_SECRET` same value as Vercel.
- [ ] **Stripe:** Webhook endpoint points to `https://<your-domain>/api/billing/webhook`; `STRIPE_WEBHOOK_SECRET` set in Vercel.
- [ ] **DB:** Table `pt_email_log` exists (used for dedupe; if missing, optional cron emails and send-plan-ready will fail).
- [ ] **Vercel Cron:** `vercel.json` schedules `/api/cron/autogen-drafts` (e.g. `0 6 * * *`).

---

## 6. File reference

| Purpose | File |
|--------|------|
| “Your plan is ready” (to client) | `src/lib/email-plan-send.ts`, `src/app/api/plans/send/route.ts` |
| Send plan UI | `src/app/pt/app/review-plans/page.tsx` (handleReviewAndSend → /api/plans/send) |
| “New plan ready to review” (to PT) | `src/lib/email/resend.ts` (sendAutogenPlanReadyEmail), `src/app/api/internal/send-plan-ready/route.ts` |
| Edge calling send-plan-ready | `supabase/functions/pt-autogen-drafts/index.ts` (sendPlanReadyEmailToPt) |
| Trial / welcome / loyalty / due soon | `src/lib/email/resend.ts` |
| Trial & welcome triggers | `src/app/api/billing/webhook/route.ts` |
| Trial ending / loyalty / due soon triggers | `src/app/api/cron/autogen-drafts/route.ts` |
| Dedupe and log | `src/lib/email/check-and-log.ts` |
| Cron schedule | `vercel.json` |

---

## 7. Summary

- **To client:** Only “Your plan is ready” (when PT sends plan from Review Plans). Wired via `/api/plans/send` and `sendPlanReadyEmail`.
- **To PT:** “New plan ready to review” (autogen), “Trial started”, “Trial ending soon”, “Welcome to the team”, “Loyalty reward”, “Client plan due soon”. All have a clear trigger and use Resend; autogen and cron-driven ones depend on `APP_URL`, cron env, and `pt_email_log`.
- **Auth emails** (login OTP, forgot password, etc.) are unchanged and out of scope.

After ensuring the checklist above (especially `APP_URL` in Supabase and `RESEND_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` on Vercel), the direct-to-customer email system is correctly wired end-to-end.

---

## 8. PT emails — verification (code trace)

Verified by tracing trigger → handler → Resend for each PT email:

| Email | Trigger | Handler | Resend call | Dedup |
|-------|--------|---------|-------------|--------|
| **New plan ready to review** | Edge inserts draft (workout or meal) | Edge calls `sendPlanReadyEmailToPt` only when `appUrl` is set → `POST /api/internal/send-plan-ready` with `x-internal-secret` | `sendAutogenPlanReadyEmail({ to: ptEmail, clientName, planType, reviewUrl })`; `reviewUrl = NEXT_PUBLIC_APP_URL + /pt/app/plans/{planId}` | `pt_email_log`: `autogen_plan_ready_{planId}` |
| **Trial started** | Stripe `checkout.session.completed` or `customer.subscription.created` with status trial | `sendTrialStartedEmailIfNeeded` in webhook (idempotent via `trial_started_email_sent_at`) | `sendTrialStartedEmail({ to, desktopUrl })` | Profile `trial_started_email_sent_at` |
| **Trial ending soon** | Cron after edge; profiles with `trial_ends_at` in [now, tomorrow], `subscription_status = trial` | Cron route optional block | `sendTrialEndingSoonEmail({ to: profile.email })` | `pt_email_log`: `trial_ending_soon` |
| **Welcome to the team** | Stripe `invoice.paid` / `invoice.payment_succeeded` with `billing_reason === "subscription_create"` | Webhook loads profile, checks dedup, sends, logs | `sendWelcomeToTeamEmail({ to: profile.email })` | `pt_email_log`: `welcome_to_team` |
| **Loyalty reward** | Cron; profiles with `subscription_started_at` 24–26 days ago, `subscription_status = active` | Cron optional block; optionally calls apply-loyalty-reward then sends | `sendLoyaltyRewardEmail({ to: profile.email })` | `pt_email_log`: `loyalty_reward` |
| **Client plan due soon** | Cron; clients whose last sent plan (`review_status = sent`, `sent_at` not null) is 6+ days ago | Cron optional block; one email per PT per client | `sendClientPlanDueSoonEmail({ to: ptEmail, clientName, daysUntilDue: 1 })` | `pt_email_log`: `due_soon_{client_id}` |

**Internal send-plan-ready:** Requires at least one of `CRON_SECRET` or `AUTOGEN_SECRET` to be set (returns 503 otherwise); accepts header `x-internal-secret` matching either value. Uses `emailAlreadySent` / `logEmailSent` with service-role Supabase; `check-and-log` uses `pt_user_id` and `email_type` in `pt_email_log`.
