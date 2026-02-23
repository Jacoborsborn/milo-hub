# Milo PT Hub — System Map + Risk Audit + Fix Plan

**Audit date:** 2025-02-22  
**Scope:** Next.js + Supabase + Stripe repo audit. No implementation; references only.

---

## 1) Executive Summary

### What’s stable
- **App router only** (`src/app/**`), single entry layout at `src/app/layout.tsx`. Next 16, React 19, Supabase SSR with cookie-based sessions.
- **Auth:** OTP signup → verify-otp (set password + profile) → login (email/password). Middleware protects `/pt/app/*` only; login page intentionally excluded for iOS Safari.
- **Stripe:** Checkout creation (two entry points), webhook with signature verification, profile sync; trial 3 days; tiers starter/pro/elite.
- **Subscription gating:** Server-side in `src/lib/services/subscription.ts` and `clients.ts` (client limit + writable access). Billing page reads `/api/billing/profile`.
- **PT flows:** Templates (workout `pt_templates`, meal `pt_meal_templates`), clients, jobs → process route → edge functions → plans with `content_json`. Share links use HMAC-signed tokens; public share pages use service role to read plans by token.
- **Email:** Resend trial-started only (webhook); no zod in repo.

### What’s unstable or missing
- **Login post-checkout:** API checks `subscription_status === "trialing"` but webhook writes `"trial"` → trial users can be sent to billing instead of app.
- **Tutorial images:** Code requests `/tutorial/step-1.png` … `step-6.png`; repo has only `step-1.svg` … `step-6.svg` → 404s.
- **Base schema not in repo:** No `CREATE TABLE` for `plans`, `clients`, `pt_templates`, `pt_meal_templates`, `plan_completions`, `billing_processed_invoices` in migrations; only ALTERs and references.
- **sync-session vs webhook:** `sync-session` writes `cancel_at_period_end`; webhook comment says it’s omitted “(not in schema)” but migration 20260217000000 adds it — comment is stale; risk of drift.
- **Cron/auth:** `/api/cron/autogen-drafts` logs secrets to stdout (“Expected secret: [SET]”); pt-template-generator called with anon key from client (no user JWT).
- **pt-generator vs pt-workout-generator:** `generator.ts` `generateWorkout()` calls `pt-generator`; job process route uses `pt-workout-generator` for AI workouts — two code paths for “workout generation”.

---

## 2) Architecture Map

### Framework and packages (exact versions from repo)

**Source:** `package.json`, `package-lock.json` (resolved).

| Package            | Version (lock) |
|--------------------|----------------|
| next               | 16.1.6         |
| react              | 19.2.3         |
| react-dom          | 19.2.3         |
| @supabase/ssr      | ^0.8.0         |
| @supabase/supabase-js | ^2.95.3      |
| stripe             | ^20.3.1         |
| resend             | ^6.9.2          |
| zustand            | ^5.0.11         |

**Not present:** zod (searched: `from ["']zod["']`, `require(["']zod["']`) — NOT FOUND).

**Scripts:** `dev` = `next dev`, `build` = `next build`, `start` = `next start`, `lint` = `eslint`, `prepare` = `husky`.

**Router:** App Router only. Entry layout: `src/app/layout.tsx` (Meta Pixel in body). Route groups: `(marketing)` with its own layout. No `src/pages` usage.

---

### Route map

**Pages (key only; all under `src/app/`)**

| Route | Purpose | Auth | Key components |
|-------|---------|------|-----------------|
| `/` | Marketing landing | No | `(marketing)/page.tsx` |
| `/(marketing)/demo` | Demo | No | demo page |
| `/signup`, `/auth/signup` | Signup wizard | No | SignupPageContent |
| `/pt`, `/pt/login` | PT login entry | No | redirect / pt login |
| `/pt/auth/login` | Login form | No (no middleware) | PtLoginForm |
| `/pt/auth/reset`, `/pt/auth/reset/verify` | Password reset | No / token | reset flows |
| `/pt/app/*` | Dashboard, clients, plans, generate, billing, profile, settings, tutorial | Yes (middleware) | pt/app/layout |
| `/pt-hub`, `/pt-hub/success` | PT Hub landing + post-checkout | No | PtHubSuccessClient (fbq CompleteRegistration) |
| `/templates`, `/templates/create`, `/templates/[id]/edit|review|assign`, `/templates/meals` | Workout/meal templates | Implicit (client fetch) | CreateProgramModal, etc. |
| `/plans/review` | Legacy review? | Via getCurrentUserId in actions | plans/review |
| `/share/plan/[token]`, `/share/meal/[token]` (+, full, shopping) | Public plan/meal share | Token only | ClientShareView, PublicMealShareView, etc. |
| `/profile`, `/privacy`, `/terms` | Static/marketing | No | — |

**API routes (`src/app/api/`)**

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/pt/login` | POST | Email/password login, set cookies, return redirect | No (login) |
| `/api/auth/send-otp` | POST | Send OTP for signup | No |
| `/api/auth/verify-otp` | POST | Verify OTP, set password, update profile | No (has OTP) |
| `/api/auth/reset/send` | POST | Send reset (OTP) | No |
| `/api/auth/reset/verify` | POST | Verify reset | No |
| `/api/billing/create-checkout` | POST | Create Stripe checkout (one success URL) | getUser |
| `/api/stripe/checkout` | POST | Create Stripe checkout (pt-hub vs tutorial success) | getUser |
| `/api/billing/webhook` | POST | Stripe webhook, update profiles, trial email | Stripe sig |
| `/api/billing/sync-session` | POST | Post-checkout sync profile from session | getUser |
| `/api/billing/sync` | POST | Sync stripe IDs from Stripe by customer | getUser |
| `/api/billing/profile` | GET/PATCH/OPTIONS | Read/update billing profile | getUser |
| `/api/billing/cancel` | POST | Cancel subscription | getUser |
| `/api/billing/resume` | POST | Resume | getUser |
| `/api/billing/cancellation-feedback` | POST | Cancel reason | getUser |
| `/api/billing/exit-offer-50`, `apply-exit-offer` | POST | Exit offer | getUser |
| `/api/plans/[planId]` | GET | Plan + completions + client name | getPlanById (session) |
| `/api/plans/[planId]/share` | GET | Signed share URL | getUser |
| `/api/plans/send` | POST | Send plan email | getUser |
| `/api/share/plan-completions` | GET/POST | Get/update completions by share token | Token only |
| `/api/jobs`, `/api/jobs/batch` | GET/POST | List/create jobs | listPlanJobs/createPlanJob (session) |
| `/api/jobs/[id]/process` | POST | Run job (invoke edge, create plans) | getSession |
| `/api/cron/autogen-drafts` | POST | Invoke pt-autogen-drafts | CRON_SECRET / AUTOGEN_SECRET |
| `/api/notifications/*` | GET/PATCH/DELETE | Notifications | getUser |
| `/api/clients/recent` | GET | Recent clients | getUser |
| `/api/dashboard/summary` | GET | Dashboard summary | getPtDashboardSummary (session) |
| `/api/generate-context` | GET | Clients + templates for generation | listClients etc. (session) |
| `/api/pt/upload-logo` | POST | Upload logo | getUser |
| `/api/dev/send-trial-email` | POST | Dev-only trial email | NODE_ENV dev |

---

## 3) Auth & Session Model

### Supabase client creation
- **Browser:** `src/lib/supabase/browser.ts` — lazy singleton via Proxy, `createBrowserClient(env.url, env.anonKey)`. Throws if env missing when accessed.
- **Server:** `src/lib/supabase/server.ts` — `supabaseServer()` async, `createServerClient` with `cookies()` getAll/setAll.
- **Middleware:** `src/middleware.ts` uses `updateSession` from `src/lib/supabase/middleware.ts` then creates its own `createServerClient` with request/response cookies to run `getUser()` for protection. Matcher: `/pt/app/:path*` only.

**Env:** `src/lib/supabase/env.ts` — `getSupabaseEnv()` (null if missing), `assertSupabaseEnv()` (throws). Used so build does not require env.

### Cookies
- Set: In route handlers that call Supabase auth (e.g. `signInWithPassword`, `verifyOtp`) via `createServerClient` with `setAll` writing to `cookies()` from `next/headers`.
- Read: Middleware and server components/actions use same cookie store via `getAll()`.
- **Explicit rule:** `/pt/auth/login` is excluded from middleware so the login page does not touch cookies on load (iOS Safari / in-app browser safe). See comment in `src/middleware.ts` lines 50–54.

### Auth flow (text diagram)
1. **Signup:** User hits `/signup` or `/auth/signup` → SignupPageContent → POST `/api/auth/send-otp` (email) → Supabase `signInWithOtp` (sends email with token).
2. **Verify:** User submits code + password + profile fields → POST `/api/auth/verify-otp` → `verifyOtp` + `updateUser({ password })` + profiles update (full_name, business_name, coaching_focus) → session established via cookies.
3. **Login:** User on `/pt/auth/login` → POST `/api/pt/login` (email, password) → `signInWithPassword` → cookies set → response includes `redirect` (e.g. `/pt/app/tutorial` or `/pt/app/billing` based on profile).
4. **Session:** All `/pt/app/*` requests go through middleware → `updateSession` refreshes session, then `getUser()`; if no user → redirect to `/pt/auth/login?next=...`.
5. **Dashboard:** Authenticated user uses server client (and browser client where needed) for RLS-backed data.

### Files that touch auth
- `src/middleware.ts` — protect /pt/app, redirect unauthenticated.
- `src/lib/supabase/middleware.ts` — updateSession (refresh).
- `src/lib/supabase/server.ts`, `browser.ts`, `env.ts` — client creation and env.
- `src/app/api/pt/login/route.ts` — signInWithPassword, set cookies, return redirect.
- `src/app/api/auth/send-otp/route.ts` — signInWithOtp.
- `src/app/api/auth/verify-otp/route.ts` — verifyOtp, updateUser, profile update.
- `src/app/api/auth/reset/send/route.ts` — reset OTP.
- `src/app/api/auth/reset/verify/route.ts` — verify reset.
- `src/app/pt/auth/logout/route.ts` — signOut.
- All API routes that call `supabase.auth.getUser()` or `getSession()` (see route map).

### Known error pattern
- **Login trial check:** In `src/app/api/pt/login/route.ts` (lines 72–77) access is granted when `status === "active" || status === "trialing" || ...`. Webhook in `src/app/api/billing/webhook/route.ts` maps Stripe `trialing` to `subscription_status: "trial"` (lines 81–85). So `"trialing"` never exists on profile; trial users can be mis-routed to billing. **Bug.**

---

## 4) Billing System Map

### Flow (text)
1. **Checkout start:** Client calls POST `/api/billing/create-checkout` or POST `/api/stripe/checkout` with `{ tier }`. Both use `PRICE_MAP[tier]` from env (`STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ELITE`). Authenticated via `supabase.auth.getUser()`.
2. **Stripe Checkout:** `getStripe().checkout.sessions.create` with 3-day trial, metadata `supabase_user_id`, `user_id`, `tier`, `client_reference_id` = user id. Success URL: either `/pt-hub/success?from=pt-hub-ad&...` (when `from=pt-hub-ad`) or `/pt/app/tutorial?success=true&session_id={CHECKOUT_SESSION_ID}`. Cancel URL: `/pt-hub?canceled=1` or `/pt/app/billing?canceled=true`.
3. **Webhook:** POST `/api/billing/webhook` — `req.text()` for raw body, `getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret)`. Events: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_succeeded`. Uses `createClient(url, serviceKey)` to update `profiles` (and `billing_processed_invoices` + `increment_profile_lifetime_value` for paid invoices). Trial started email via `sendTrialStartedEmail`, then `trial_started_email_sent_at` updated.
4. **Post-checkout UI:** Success page can call POST `/api/billing/sync-session` with `session_id` to avoid webhook delay; uses service role to update same profile fields (including `cancel_at_period_end`).

**File refs:**  
- Checkout: `src/app/api/billing/create-checkout/route.ts` (lines 44–57), `src/app/api/stripe/checkout/route.ts` (lines 68–85).  
- Webhook: `src/app/api/billing/webhook/route.ts` (signature check 107–125, handlers 139–339).  
- Sync: `src/app/api/billing/sync-session/route.ts`, `src/app/api/billing/sync/route.ts`.  
- Stripe client: `src/lib/stripe.ts` — lazy `getStripe()`, API version `2026-01-28.clover`.

### Subscription states and where enforced
- **Stored on profile:** `subscription_status` (free | trial | active | past_due | canceled), `subscription_tier`, `trial_ends_at`, `current_period_end`, `cancel_effective_at`, `subscription_started_at`, etc.
- **Enforced:** `src/lib/services/subscription.ts` — `getSubscriptionGate()`, `requireActiveSubscriptionOrRedirect()`, `requireClientCapacityOrThrow()` (starter 10, pro 30, elite 100 clients), `requireWritableAccessOrThrow()` (access_mode !== 'readonly'). Used by `createClient` and plan/job flows.

### Trial end
- **Computed:** From Stripe subscription `trial_end` in webhook and sync-session; stored as `trial_ends_at` (ISO) on profiles.
- **Checked:** In `subscription.ts` (trial valid if `trial_ends_at > now`); tutorial page and billing page read `trial_ends_at` from profile.

### DB vs UI
- **cancel_at_period_end:** In migration `20260217000000_profiles_table_and_rls.sql` (line 16). Webhook comment says “Omits cancel_at_period_end (not in schema)” — comment is wrong; sync-session does send it. No UI/DB mismatch; only comment stale.
- **sync-session** returns selected columns including `cancel_at_period_end`; billing page uses it. OK.

---

## 5) Subscription Gating Matrix

| Feature / action | Required tier / check | Enforcement location |
|------------------|------------------------|----------------------|
| Create client | Active or valid trial + under client limit | Server: `src/lib/services/clients.ts` → `requireClientCapacityOrThrow`, `requireWritableAccessOrThrow` |
| Client limit | starter 10, pro 30, elite 100 | `src/lib/services/subscription.ts` CLIENT_LIMITS, `requireClientCapacityOrThrow` |
| Generate plans (job process) | Session (no explicit tier check in process route) | Job creation uses `createPlanJob` (auth); process uses session; createPlan uses `requireWritableAccessOrThrow` |
| Create plan | Writable access | `src/lib/services/plans.ts` → `requireWritableAccessOrThrow` |
| Templates (workout) | Auth via Supabase from client | Client fetches from `pt_templates` (RLS) |
| Templates (meal) | Auth via server actions | `src/app/templates/meals/actions.ts` uses getSubscriptionStatus / getClientById |
| Send plan email | Pro/Elite for “branded” send | `src/app/api/plans/send/route.ts` — `isProOrElite = tier === "pro" \|\| tier === "elite"` (lines 89–91) |
| Billing / profile | Any authenticated user | GET/PATCH `/api/billing/profile` |

---

## 6) Supabase Schema & RLS Matrix

### Migrations present (all under `supabase/migrations/`)
- `20260216000000_add_profiles_brand_logo_url.sql`
- `20260216000001_storage_public_assets_bucket.sql`
- `20260217000000_profiles_table_and_rls.sql` — profiles CREATE + billing columns + RLS (select/update own) + `handle_new_user` trigger
- `20260218000000_plans_review_status.sql` — plans review_status, review_ready_at, sent_at
- `20260218100000_plan_jobs_table.sql` — plan_jobs CREATE
- `20260218200000_plans_send_and_profiles.sql` — clients.email, plans last_sent_*, profiles display_name, business_name, brand_logo_url
- `20260219000000_program_assignments_and_plans_autogen.sql` — program_assignments, plans assignment_id, week_number, status, generated_by, etc.
- `20260219100000_billing_cancel_effective_and_feedback.sql` — profiles.cancel_effective_at, cancellation_feedback table + RLS
- `20260219200000_automation_templates_and_dow.sql` — program_assignments FKs to pt_templates, pt_meal_templates, generate_on_dow, active
- `20260219300000_combined_automation_toggles.sql`
- `20260219400000_pt_notifications.sql` — pt_notifications + RLS
- `20260219500000_profiles_coaching_focus.sql`
- `20260219600000_profiles_trigger_bypass_rls.sql` — handle_new_user with SET LOCAL row_security = off for insert
- `20260219700000_profiles_signup_columns.sql` — full_name, business_name, coaching_focus
- `20260220100000_profiles_email_and_trigger_upsert.sql` — profiles.email, trigger upsert id+email
- `20260220200000_profiles_trial_started_email_sent_at.sql`

### Tables (from migrations + app usage)

| Table | Key columns | RLS | Policies / notes |
|------|-------------|-----|------------------|
| **profiles** | id (FK auth.users), subscription_*, stripe_*, trial_ends_at, email, display_name, business_name, brand_logo_url, access_mode, lifetime_value, trial_started_email_sent_at, … | Yes | SELECT/UPDATE own (auth.uid() = id). No INSERT for user; trigger handle_new_user (SECURITY DEFINER, row_security off) inserts on signup. Webhook uses service role to upsert/update. |
| **plan_jobs** | id, pt_user_id, client_id, job_type, status, payload, result_plan_ids, error, created_at, updated_at | Not in migrations | App assumes RLS or pt_user_id filtering; listPlanJobs/getPlanJobById filter by pt_user_id. |
| **program_assignments** | id, pt_user_id, client_id, program_type, program_id, start_date, auto_generate_enabled, autogen_lead_days, paused, workout_template_id, meal_template_id, generate_on_dow, active | Yes | SELECT/INSERT/UPDATE/DELETE own (pt_user_id = auth.uid()). |
| **plans** | Altered only (review_status, assignment_id, week_number, status, generated_by, last_sent_*, …). Base CREATE not in repo. | Assumed | App uses pt_user_id in all plan queries (getPlanById, listPlansForPtUser, etc.). |
| **clients** | Altered (email). Base CREATE not in repo. | Assumed | App uses pt_id in clients.ts. |
| **pt_templates** | Referenced by program_assignments. CREATE not in repo. | Assumed | templates page selects by session user. |
| **pt_meal_templates** | Referenced. CREATE not in repo. | Assumed | — |
| **pt_notifications** | id, pt_user_id, type, title, message, link_path, is_read, created_at | Yes | SELECT/UPDATE/DELETE/INSERT own (pt_user_id = auth.uid()). Autogen function uses service role to insert. |
| **cancellation_feedback** | id, pt_user_id, stripe_subscription_id, reason, details, created_at | Yes | INSERT/SELECT own. |
| **plan_completions** | Used in API (plan_id, week_number, day_index, completed_at). CREATE not in repo. | — | NOT FOUND in migrations. |
| **billing_processed_invoices** | Used in webhook (profile_id, stripe_invoice_id, amount_pence). CREATE not in repo. | — | NOT FOUND in migrations. |

### RLS risk list
- **profiles INSERT:** No user policy; only trigger with SECURITY DEFINER and row_security off. Low risk if trigger is the only writer for new users; webhook uses service role. **Recommendation:** Document that only trigger + service role may insert.
- **plan_jobs / plans / clients:** No RLS policies in migrations; app relies on pt_user_id/pt_id in queries. **Risk:** If RLS is enabled later without policies, reads could fail; if RLS is off, any leak of anon key with a valid user could allow access only to that user’s data (same as now). **Recommendation:** Add explicit RLS policies for plan_jobs, plans, clients to match app usage.
- **Service role usage:** Confined to webhook, sync-session, sync, share pages (plan by token), plan_completions API, getCompletionsForPlan. All server-side. **Recommendation:** Ensure SUPABASE_SERVICE_ROLE_KEY never in client bundle (already true).

---

## 7) Edge Functions Matrix

| Function | Purpose | Caller(s) | Auth method | Env / risk |
|----------|---------|-----------|-------------|------------|
| **pt-autogen-drafts** | Daily cron; create draft plans for assignments | POST `/api/cron/autogen-drafts` (fetch with secret in body/header) | Bearer AUTOGEN_SECRET (or CRON_SECRET) in body/header; no JWT | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTOGEN_SECRET. verify-jwt not required (custom secret). |
| **pt-plan-generator** | Template-based workout plan JSON | `src/app/api/jobs/[id]/process/route.ts` | Authorization: Bearer &lt;access_token&gt; (user JWT); edge uses auth.getUser(jwt) | Default verify-jwt. |
| **pt-workout-generator** | AI workout plan (normalised content_json) | Same process route; `src/lib/services/generator.ts` generateWorkoutDraft | Bearer user JWT | Default verify-jwt. |
| **pt-meal-generator** | Meal plan + grocery | generator.ts generateMeal; process route for job_type meal uses assignMealTemplateToClient (no direct invoke) | generator passes session access_token | README says “no auth required” and suggests `--no-verify-jwt` for deploy. If deployed with verify-jwt, anon key from client would fail. |
| **pt-generator** | Legacy/alternate workout? | generator.ts generateWorkout() only | Bearer user JWT | Default verify-jwt. |
| **pt-template-generator** | Workout template JSON | `src/app/templates/create/page.tsx` fetch with `Authorization: Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` | Anon key, not user JWT | **Risk:** Anyone with anon key can call; no per-user auth. Acceptable only if function is idempotent and does not expose data. Document. |

**Cron:** `src/app/api/cron/autogen-drafts/route.ts` calls `fetch(\`${supabaseUrl}/functions/v1/pt-autogen-drafts\`, { body: JSON.stringify({ secret: ... }) })` with no Authorization header; function checks body.secret === AUTOGEN_SECRET. **Risk:** Logs `CRON_SECRET`/`AUTOGEN_SECRET` presence (“[SET]”/“[MISSING]”) and incoming header — avoid logging secret value.

**NOT FOUND:** No `config.toml` or per-function `verify-jwt` flags in repo; Supabase default is verify-jwt true. pt-meal-generator README recommends `--no-verify-jwt` for that function.

---

## 8) PT Core Flows (Templates, Clients, Generation, View/Share)

### Templates
- **Workout:** List/create on `/templates` (tab workouts). List: `supabase.from("pt_templates").select(...)`. Create: `/templates/create` → fetch `pt-template-generator` (anon key) → then insert into `pt_templates` (implied; not shown in snippet). Edit: `templates/[templateId]/edit`, review/assign: `templates/[templateId]/review`, `templates/[templateId]/assign` with `actions.ts` (assign creates plan/job).
- **Meal:** `/templates/meals` via TemplatesMealsContent; create in `CreateProgramModal`; server actions in `templates/meals/actions.ts` (getMealTemplateById, generateMeal, createPlan, assignMealTemplateToClient). Meal “assign” can create plan via `assignMealTemplateToClient`.
- **Assign:** `templates/[templateId]/assign/actions.ts` — can create job and call setJobStatus with result_plan_ids, or create plan from template and link to client.

**File refs:** `src/app/templates/page.tsx` (pt_templates select), `src/app/templates/create/page.tsx` (pt-template-generator), `src/app/templates/meals/actions.ts`, `src/app/templates/[templateId]/assign/actions.ts`.

### Clients
- Create: `/pt/app/clients/new` → NewClientForm → `createClientAction` in `pt/app/clients/new/actions.ts` → `createClient` in `src/lib/services/clients.ts` (requireClientCapacityOrThrow, requireWritableAccessOrThrow, insert into `clients`).
- List: `listClients()` from clients.ts (pt_id = current user).
- Edit: `/pt/app/clients/[id]/edit` with EditClientForm and actions in `pt/app/clients/[id]/edit/actions.ts`.

**File refs:** `src/lib/services/clients.ts`, `src/app/pt/app/clients/new/actions.ts`, `src/app/pt/app/clients/[id]/edit/actions.ts`.

### Generation
- **Inputs:** Template defaults + client `presets_json` (and inputs_json) merged in meal flow in `templates/meals/actions.ts` (mergeMealInputs). Workout: job payload or client’s assigned_workout_program_id + presets.
- **Trigger:** User creates job via POST `/api/jobs` or `/api/jobs/batch`; then something (e.g. client) calls POST `/api/jobs/[id]/process`. Process route: get job, get client, then either pt-plan-generator (template) or pt-workout-generator (workoutInputs), and for meal calls `assignMealTemplateToClient`; creates plans via `createPlan` with `content_json`.
- **Storage:** `createPlan` in `src/lib/services/plans.ts` inserts into `plans` with `content_json`, `review_status: 'ready'`, `review_ready_at: now`. Plan type meal/workout; content_json structure differs by type.

**File refs:** `src/app/api/jobs/route.ts`, `src/app/api/jobs/[id]/process/route.ts`, `src/lib/services/plan-jobs.ts`, `src/lib/services/plans.ts` (createPlan), `src/app/templates/meals/actions.ts` (mergeMealInputs, assignMealTemplateToClient).

### View / share
- **PT view/edit:** `/pt/app/plans/[planId]` — data from getPlanById (server) or GET `/api/plans/[planId]` (returns plan + completions + client_name). Edit: update content_json via updatePlanContent.
- **Share link:** PT calls GET `/api/plans/[planId]/share` → signed token (HMAC planId+exp) → URL `/share/plan/{token}` or `/share/meal/{token}`. Public pages: `share/plan/[token]/page.tsx`, `share/meal/[token]/page.tsx` (and full, shopping). They use `verifyShareToken`, then service-role Supabase client to read `plans` by planId and optionally profiles (brand_logo, etc.). Plan sent to client email via `/api/plans/send`.

**File refs:** `src/lib/plan-share-token.ts`, `src/app/api/plans/[planId]/share/route.ts`, `src/app/share/plan/[token]/page.tsx`, `src/app/share/meal/[token]/page.tsx`, `src/app/api/plans/send/route.ts`, `src/lib/services/plans.ts` (getPlanById, updatePlanContent).

### Breakpoints
- **content_json:** Used consistently (no plan_json in app). Share and PT plan views all use `plan.content_json`.
- **Tutorial images:** Step images use `.png` in code but only `.svg` exist in `public/tutorial/` → 404 (see Section 11).
- **Capacitor/RevenueCat:** Grep for “Capacitor” or “RevenueCat” — NOT FOUND in repo.
- **generator.ts:** `generateWorkout()` calls `pt-generator`; process route uses `pt-workout-generator` for AI path — two different functions for “workout”; ensure both stay in sync or deprecate one.

---

## 9) Email & Analytics Map

### Email (Resend)
- **Trigger:** Only “trial started” — in `src/app/api/billing/webhook/route.ts` after checkout.session.completed when `subscription_status === "trial"`. Uses `sendTrialStartedEmail({ to })` from `src/lib/email/resend.ts`; then sets `trial_started_email_sent_at` on profile.
- **Template:** Inline HTML/text in `src/lib/email/resend.ts` (trialStartedHtml, trialStartedText). Subject: “Trial started — welcome in 🚀”. Uses `PT_HUB_DESKTOP_URL` for link.
- **Dev:** POST `/api/dev/send-trial-email` (NODE_ENV dev only) to test email.
- **Other events:** No Resend for signup confirmation, reset password, trial ending, or cancellation in this repo; Supabase sends its own magic link/OTP emails. No duplication with Supabase for trial started (we send after webhook; Supabase does not send trial emails).

**Event → template → route:**  
Trial started → inline HTML in resend.ts → webhook route (after profile upsert).

### Analytics (Meta Pixel)
- **Injection:** `src/app/layout.tsx` — Script id="meta-pixel", strategy="afterInteractive", inline fbq init and PageView. Pixel ID: 1419316019660548.
- **Helper:** `src/lib/meta.ts` — `trackMetaEvent(event, data)`, `getTierPriceGbp(tier)` for Purchase.
- **Events:**  
  - PageView: layout (all pages).  
  - Lead: `src/components/signup/EmailCodeModal.tsx` (on submit).  
  - StartTrial: `src/components/pt/StripeSuccessPixel.tsx` (when trial + session_id).  
  - Purchase: same component with value and currency from getTierPriceGbp.  
  - CompleteRegistration: `src/app/pt-hub/success/PtHubSuccessClient.tsx`.
- **Double firing:** Single Script in root layout; event helpers guard with `typeof window` and `fbq` check. Possible double PageView if layout remounts; no obvious duplicate Lead/StartTrial/Purchase from code.

---

## 10) Image / Asset Pipeline

- **next.config:** `next.config.ts` has no `images` config (no domains or remotePatterns). Local `/public` assets work without it.
- **Tutorial:** `src/app/pt/app/tutorial/page.tsx` uses `TUTORIAL_IMAGE_EXT = ".png"` and `TUTORIAL_IMAGE_BASE = "/tutorial/step-"` → requests `/tutorial/step-1.png` … `step-6.png`. `public/tutorial/` contains only `step-1.svg` … `step-6.svg` and `placeholder.svg`. So all six step images return 404.
- **Component:** `src/components/tutorial/TutorialStepImage.tsx` uses plain `<img src={absoluteSrc}>`, not next/image; no config needed for local paths. Root cause is extension mismatch.

**Fix plan (no implementation):** Either (1) set `TUTORIAL_IMAGE_EXT = ".svg"` in `src/app/pt/app/tutorial/page.tsx`, or (2) add step-1.png … step-6.png under `public/tutorial/`. Option 1 is one-line and matches repo assets.

---

## 11) Security Audit (Severity List)

| Severity | Issue | Location / ref |
|----------|--------|-----------------|
| **Critical** | None (no hardcoded secrets, no service role on client). | — |
| **High** | Login treats trial as “trialing” but DB has “trial” → trial users can be sent to billing. | `src/app/api/pt/login/route.ts` lines 72–77. |
| **High** | Cron route logs whether secret is set and logs Authorization header; if log shipping includes body, secret could leak. | `src/app/api/cron/autogen-drafts/route.ts` lines 9–18. |
| **Medium** | pt-template-generator called with anon key from client; no user binding. | `src/app/templates/create/page.tsx` (fetch with NEXT_PUBLIC_SUPABASE_ANON_KEY). |
| **Medium** | Env and Supabase URL logged in multiple places (getSupabaseEnv, getSupabaseClient, webhook, sync-session, etc.); no key logged but URL can aid reconnaissance. | `src/lib/supabase/env.ts`, `browser.ts`, `src/app/api/billing/webhook/route.ts`, etc. |
| **Low** | Share and plan-completions use service role server-side to read/write by token; acceptable if PLAN_SHARE_SECRET is strong and token is short-lived. | `src/app/share/*/page.tsx`, `src/app/api/share/plan-completions/route.ts`. |
| **Low** | Stripe API version pinned to `2026-01-28.clover`; ensure compatibility with Stripe SDK 20.x. | `src/lib/stripe.ts` line 10. |

---

## 12) Bugs & Risks List (Ranked)

1. **Trial redirect after login:** Profile has `subscription_status === "trial"` but login checks `"trialing"` → trial users may be redirected to billing. File: `src/app/api/pt/login/route.ts`.
2. **Tutorial images 404:** Code uses `.png`, repo has `.svg`. File: `src/app/pt/app/tutorial/page.tsx` (TUTORIAL_IMAGE_EXT).
3. **Cron logs secret presence / header:** Risk of leaking AUTOGEN_SECRET in logs. File: `src/app/api/cron/autogen-drafts/route.ts`.
4. **Base tables missing from migrations:** plans, clients, pt_templates, pt_meal_templates, plan_completions, billing_processed_invoices — CREATE TABLE not in repo; app and webhook depend on them. Add migrations or document external creation.
5. **Webhook comment stale:** Says cancel_at_period_end “not in schema”; schema has it. File: `src/app/api/billing/webhook/route.ts` comment.
6. **Two workout generator paths:** generator.ts uses pt-generator; job process uses pt-workout-generator; possible confusion or drift. Files: `src/lib/services/generator.ts`, `src/app/api/jobs/[id]/process/route.ts`.
7. **pt-meal-generator verify-jwt:** README suggests --no-verify-jwt; if deployed with verify-jwt, client must send user JWT (generator.ts does). Confirm deploy config.
8. **plan_jobs result_plan_ids:** Type is string[]; DB is jsonb. Supabase accepts array as jsonb; no bug found but ensure no legacy scalar usage.
9. **Tutorial redirect target:** Tutorial page redirects unauthenticated to `/signup` (line 92); rest of app uses `/pt/auth/login`. Consider consistency.
10. **Billing profile fallback:** When profile row missing, GET /api/billing/profile returns default object; PATCH can still run. OK; document.

---

## 13) Next 10 Fixes (Strict Priority, File Targets)

1. **Fix trial redirect on login** — In `src/app/api/pt/login/route.ts`, add `status === "trial"` to the condition that grants access (e.g. line 74: include `|| status === "trial"` or replace `"trialing"` with `"trial"`).
2. **Fix tutorial images** — In `src/app/pt/app/tutorial/page.tsx`, set `TUTORIAL_IMAGE_EXT = ".svg"` (or add .png assets under `public/tutorial/`).
3. **Stop logging secret presence / auth header** — In `src/app/api/cron/autogen-drafts/route.ts`, remove or redact `console.log` of CRON_SECRET/AUTOGEN_SECRET and incoming Authorization.
4. **Document or add base schema** — Add migrations (or a single “base” migration) that CREATE TABLE for `plans`, `clients`, `pt_templates`, `pt_meal_templates`, `plan_completions`, `billing_processed_invoices` with columns and FKs used by the app and webhook; or document that they are created elsewhere.
5. **Update webhook comment** — In `src/app/api/billing/webhook/route.ts`, fix the comment that says cancel_at_period_end is not in schema (remove or correct).
6. **Unify or document workout generator** — Either use only pt-workout-generator for all AI workout generation and deprecate pt-generator in generator.ts, or document both and ensure feature parity.
7. **Confirm edge JWT config** — For pt-meal-generator and pt-template-generator, document in README or deploy config whether verify-jwt is on/off and which header (user JWT vs anon) callers send.
8. **Tutorial redirect** — In `src/app/pt/app/tutorial/page.tsx`, consider redirecting unauthenticated users to `/pt/auth/login` instead of `/signup` for consistency with rest of app.
9. **RLS for plan_jobs, plans, clients** — Add Supabase migrations enabling RLS and policies (e.g. pt_user_id/pt_id = auth.uid()) for plan_jobs, plans, and clients to match app usage.
10. **Reduce env logging** — Remove or gate (e.g. NODE_ENV development only) console.log of NEXT_PUBLIC_SUPABASE_URL and similar in env.ts, browser.ts, webhook, sync-session, and other routes.

---

*End of audit. Every claim ties to a file path and, where relevant, a short code or SQL snippet above.*
