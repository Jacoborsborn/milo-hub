# Milo Hub — Full Project Audit Report

**Workspace:** `Milo-Hub`  
**Audit date:** 2026-03-27  
**Scope:** What this project is, how it’s wired, and every major integration + subsystem (Supabase, Stripe, Resend, automation, meal/workout generation, templates, jobs, sharing).  
**Redaction:** This report lists **env var names and connection points** but never includes secret values.

---

## Executive summary

### What this project is used for

**Milo Hub is a Next.js “PT Hub” web app** where personal trainers:

- **Authenticate via Supabase** and use a protected `/pt/app/*` dashboard.
- **Manage clients** (stored in Supabase `clients`).
- **Create and assign workout templates** (Supabase `pt_templates`) and **meal templates** (`pt_meal_templates`).
- **Generate workout and meal plans** using Supabase **Edge Functions** (AI + deterministic/template generators).
- **Store generated plans** in Supabase `plans.content_json`.
- **Send plans to clients by email** (Resend), using a signed share-link system.
- **Automate weekly draft plan creation** via Vercel Cron → Supabase Edge cron function.
- **Charge subscription tiers** via Stripe Checkout + Webhook → updates `profiles` in Supabase.

### Core stack (from `package.json`)

- **Next.js** `16.1.6` (App Router, `src/app/**`)
- **React** `19.2.3`
- **Supabase**: `@supabase/ssr`, `@supabase/supabase-js`
- **Stripe**: `stripe`
- **Email**: `resend`
- **State**: `zustand`
- **TypeScript** + **ESLint** + **Tailwind v4**

---

## Repository layout (high-signal)

- **App code**: `src/`
  - `src/app/**`: pages + API route handlers
  - `src/lib/**`: services (Supabase access, plan/job services, billing helpers, generator wrapper)
  - `src/components/**`: UI
  - `src/middleware.ts`: auth protection for `/pt/app/*`
- **Supabase**: `supabase/`
  - `supabase/functions/**`: Edge Functions (automation + generators)
  - `supabase/migrations/**`: schema & RLS changes (note: not all base tables are created here)
- **Generator proto**: `meal-workout-generator/` (standalone script + food list; appears to be the source/precursor for edge generator logic)
- **Docs**: `docs/` and `docs/audits/` (already contains multiple audits; this report consolidates + updates)

---

## System map (end-to-end)

### High-level architecture

```text
Browser (Trainer)
  |
  | 1) Supabase Auth (SSR cookies) + App UI
  v
Next.js (Vercel)
  - App Router pages: /pt/app/*
  - API routes: /api/*
  - Middleware: protects /pt/app/*
  |
  | 2) Calls Supabase DB via @supabase/ssr client (RLS-backed)
  | 3) Calls Supabase Edge Functions via supabase.functions.invoke(...)
  v
Supabase
  - Postgres: profiles, clients, plans, templates, jobs, assignments, notifications...
  - Storage bucket: public-assets
  - Edge Functions: plan generators + automation cron worker
  |
  | 4) External integrations
  v
Stripe (billing)  <->  Next.js webhook /api/billing/webhook  -> Supabase profiles updates
Resend (email)    <->  Next.js routes/services              -> emails + email-log table
```

---

## Auth & session model (Supabase SSR)

### Middleware protection

- **File**: `src/middleware.ts`
- **Matcher**: protects only `"/pt/app/:path*"`
- **Flow**:
  - refreshes session via `updateSession()` (`src/lib/supabase/middleware.ts`)
  - creates a server client and calls `supabase.auth.getUser()`
  - if not authed → redirects to `/pt/auth/login?next=...`

### Supabase client creation

- **Env accessor**: `src/lib/supabase/env.ts`
  - `getSupabaseEnv()` returns `{ url, anonKey }` or `null` (safe at build time)
  - `assertSupabaseEnv()` throws at runtime if missing
- **Server client**: `src/lib/supabase/server.ts`
  - `createServerClient(url, anonKey, { cookies: getAll/setAll })`
- **Browser client**: `src/lib/supabase/browser.ts`
  - lazy singleton via Proxy over `createBrowserClient(url, anonKey)`

### Auth routes (selected)

- `POST /api/pt/login`: email+password login, sets cookies, returns redirect
- `POST /api/auth/send-otp` + `POST /api/auth/verify-otp`: OTP signup + verification
- `POST /api/auth/reset/send` + `POST /api/auth/reset/verify`: reset flow
- `GET /pt/auth/logout`: sign out

---

## Data model (Supabase tables) and where they’re used

This codebase assumes a multi-tenant model where “PT user id” partitions data.

### Primary “business” tables (actively used)

- **`profiles`**
  - purpose: trainer account profile + subscription/billing fields
  - updated by: Stripe webhook, sync routes, signup verify route, profile UI
  - RLS: created/enabled in migrations; user can select/update own row; inserts via trigger

- **`clients`**
  - purpose: PT’s client list, client inputs and presets
  - used by: dashboard pages, generation inputs, automation, plan sending
  - note: table is **referenced and altered** in migrations but base `CREATE TABLE` is not in this repo

- **`plans`**
  - purpose: saved meal/workout plans; `content_json` is the core payload
  - used by: plan review UI, share pages, send-email route, automation drafts, completion tracking
  - note: base `CREATE TABLE` not present in migrations here (ALTERs exist)

- **`pt_templates`**
  - purpose: workout templates; `blueprint_json` drives deterministic plan generation
  - used by: template UI, assignment + generation, pt-plan-generator
  - note: base table not created in this repo

- **`pt_meal_templates`**
  - purpose: meal template defaults; used to shape meal generation inputs
  - used by: meal templates UI and assignment flows, autogen drafts
  - note: base table not created in this repo

### Generation orchestration tables

- **`plan_jobs`**
  - purpose: job queue for manual generation (“Generation Center”)
  - created in migrations, but **RLS is called out as a gap** in existing audit docs
  - lifecycle: `queued` → `running` → `succeeded|failed`
  - result: `result_plan_ids` written on success

- **`program_assignments`**
  - purpose: automation configuration per client (auto-generate weekly)
  - created in migrations with RLS
  - fields: `generate_on_dow`, `autogen_lead_days`, `auto_meals_enabled`, `auto_workouts_enabled`, template ids, etc.

### Notifications & misc

- **`pt_notifications`**
  - purpose: in-app notifications (e.g., “draft ready”)
  - created with RLS in migrations

- **`cancellation_feedback`**
  - purpose: billing cancel feedback
  - created with RLS in migrations

### Tables used by code but not created in this repo’s migrations

These appear in code paths and/or audit docs:

- `billing_processed_invoices` (Stripe invoice idempotency)
- `pt_email_log` (email dedupe)
- `plan_completions` (share-flow completion tracking)
- `plans`, `clients`, `pt_templates`, `pt_meal_templates` (base tables)

---

## Integrations

### Stripe (billing)

#### Stripe client

- **File**: `src/lib/stripe.ts`
- Uses `STRIPE_SECRET_KEY`
- API version pinned: `"2026-01-28.clover"`

#### Checkout creation routes (two entry points)

- `POST /api/billing/create-checkout`
- `POST /api/stripe/checkout`

Both:
- require authenticated user via Supabase session
- create a subscription checkout session
- set metadata containing `supabase_user_id` and tier
- use price ids from env: `STRIPE_PRICE_STARTER|PRO|ELITE`
- use `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` to build success/cancel URLs

#### Webhook

- **Route**: `POST /api/billing/webhook`
- Uses:
  - `STRIPE_WEBHOOK_SECRET` (signature verification)
  - Supabase service role client (`SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL`)
- Handles:
  - `checkout.session.completed`
  - `customer.subscription.created|updated|deleted`
  - `invoice.paid`, `invoice.payment_succeeded`
- Effects:
  - updates `profiles.subscription_status`, `trial_ends_at`, tier, Stripe IDs, etc.
  - invoice events log idempotency in `billing_processed_invoices`
  - calls RPC `increment_profile_lifetime_value`
  - sends lifecycle emails via Resend (trial started + welcome-to-team)

#### Sync routes

- `/api/billing/sync-session` and `/api/billing/sync` exist to reduce “webhook lag” and/or keep profile in sync.

---

### Supabase (DB + Auth + Storage + Edge Functions)

#### Required app env (server + client)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Server-only key (never expose client-side)

- `SUPABASE_SERVICE_ROLE_KEY`

#### Storage

- Bucket: `public-assets` (created in migrations)
- Upload route: `POST /api/pt/upload-logo` (PT brand logo)

---

### Resend (email)

#### Email sending

- **File**: `src/lib/email/resend.ts`
- **File**: `src/lib/email-plan-send.ts`
- Env:
  - `RESEND_API_KEY`
- Email types implemented:
  - trial started
  - trial ending soon (cron)
  - welcome to team (first payment)
  - loyalty reward (cron)
  - autogen plan ready (called by edge autogen after draft insert)
  - client plan due soon (cron)
  - client “your plan is ready” (send plan email)

#### Email dedupe/logging

- `src/lib/email/check-and-log.ts` uses Supabase service role and table `pt_email_log` to avoid duplicate sends.

---

## Plan sharing system (public links)

### How sharing works

1. PT calls `GET /api/plans/[planId]/share`
2. Server signs `{ planId, exp }` using `PLAN_SHARE_SECRET`
3. Returns a public URL:
   - workout: `/share/plan/<token>`
   - meal: `/share/meal/<token>`
4. Public share pages verify token and then query the plan using a **service role** Supabase client.

### Components/routes involved

- Signing: `src/lib/plan-share-token` (HMAC signing/verification)
- API: `src/app/api/plans/[planId]/share/route.ts`
- Public pages:
  - `src/app/share/plan/[token]/page.tsx`
  - `src/app/share/meal/[token]/page.tsx`
  - `src/app/share/meal/[token]/full/page.tsx`
  - `src/app/share/meal/[token]/shopping/page.tsx`
- Completion tracking (share flow): `/api/share/plan-completions`

---

## Meal + workout plan generation subsystem

There are **two conceptual generation modes**:

1. **Template-based deterministic generation** (workout)  
2. **AI generation** (workout + meal), using Edge Functions and OpenAI keys

### 1) Workout generation (template-based)

#### Edge Function: `pt-plan-generator`

- Input:
  - normal (user JWT): `{ template_id, client_id, user_id }` plus `Authorization: Bearer <access_token>`
  - automation (server secret): `{ autogen_secret, assignment_id, week_number }` (uses service role inside function)
- Output:
  - full plan JSON (manual path) OR `{ week, source_hash }` (autogen path)
- Data read:
  - `program_assignments`, `pt_templates.blueprint_json`, `clients.presets_json|inputs_json`, `profiles.access_mode`

#### Next.js job processor route

- `POST /api/jobs/[id]/process`
  - chooses template-based generation when a `workout_template_id` is present
  - invokes `pt-plan-generator`
  - stores a `plans` row with `content_json` = returned plan

### 2) Workout generation (AI)

#### Edge Function: `pt-workout-generator`

- Auth: requires `Authorization: Bearer <user JWT>`
- Inputs: `workoutInputs`, optional `model`, optional `correlationId`, optional `coachMessage`
- Env: `OPENAI_API_KEY` (Supabase Edge secret)
- Output: `{ ok: true, plan }` where `plan` is normalized to the app’s expected `weeks[].days[].exercises` shape

#### Wrapper in app

- `src/lib/services/generator.ts`
  - `generateWorkoutDraft()` calls `pt-workout-generator`
  - `generateWorkout()` calls `pt-generator` (legacy/alternate path)

### 3) Meal generation (AI + grocery list)

#### Edge Function: `pt-meal-generator`

- Called by:
  - server wrapper `generateMeal()` (`src/lib/services/generator.ts`)
  - automation edge worker `pt-autogen-drafts` (server-to-server fetch)
- Env:
  - `OPENAI_API_KEY`
  - optional: `MEAL_PROMPT_VERSION`
  - optional audit/debug toggles in `_shared/grocery-builder.ts` (see env list below)
- Output:
  - `{ mealPlan, grocerySections, groceryTotals, notes? }`

#### How meal “templates” work

Meal templates (`pt_meal_templates`) store **defaults only** (diet, meals/day, days, goal, etc.).  

They are merged with **client constraints** (stored in `clients.presets_json.meal`, typically calories/budget/allergies/restrictions) to form a single `mealInputs` object that is passed into `pt-meal-generator`.

---

## Automation system (weekly draft generation)

### What it does

Automation creates **draft** plans ahead of time (workout +/or meal) for clients on a recurring weekly schedule.

### Trigger chain (production)

```text
Vercel Cron (06:00 UTC daily)
  -> GET /api/cron/autogen-drafts (Next.js)
      -> POST { secret } to Supabase Edge Function pt-autogen-drafts
          -> loads eligible program_assignments (combined, active, not paused, enabled)
          -> for each assignment due today:
               - workout: call pt-plan-generator (autogen mode) + insert plans row
               - meal: call pt-meal-generator + insert plans row
               - insert pt_notifications "draft ready"
               - (optional) call Next.js internal email endpoint send-plan-ready
```

### Vercel cron config

- **File**: `vercel.json`
- Schedule: `0 6 * * *` (06:00 UTC daily)
- Path: `/api/cron/autogen-drafts`

### Cron route (Next.js)

- **Route**: `src/app/api/cron/autogen-drafts/route.ts`
- Security:
  - expects `Authorization: Bearer <CRON_SECRET|AUTOGEN_SECRET>` (GET)
  - POST also supports `{ "secret": "..." }`
- Calls: `POST ${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pt-autogen-drafts`
  - includes `x-autogen-secret` header and `body.secret`
- Also optionally sends reminder/loyalty emails using Supabase service role (if `SUPABASE_SERVICE_ROLE_KEY` is set).

### Edge Function: `pt-autogen-drafts`

- **File**: `supabase/functions/pt-autogen-drafts/index.ts`
- Security: validates `AUTOGEN_SECRET` (header/body/bearer)
- DB access: uses **service role** inside function
- Criteria:
  - `program_type = "combined"`
  - `auto_generate_enabled = true`
  - `paused = false`
  - `active = true`
  - Only runs on assignments where `todayDow === (generate_on_dow ?? 6)` (UTC)
- Output side effects:
  - Inserts draft `plans` for `workout` and/or `meal`
  - Inserts `pt_notifications` of type `autogen_draft_ready`
  - Optionally calls `POST ${APP_URL}/api/internal/send-plan-ready` to email the PT

### Internal email callback from edge → app

- **Route**: `src/app/api/internal/send-plan-ready/route.ts`
- Auth: expects `x-internal-secret` matching `CRON_SECRET` or `AUTOGEN_SECRET`
- Sends: “autogen plan ready” email via Resend and records dedupe in `pt_email_log`

---

## Edge Functions inventory (Supabase)

All functions live in `supabase/functions/*`.

| Function | Type | Primary purpose | Called from | Auth model | Key env |
|---|---|---|---|---|---|
| `pt-autogen-drafts` | cron worker | create weekly draft plans + notifications + optional email callback | Next route `/api/cron/autogen-drafts` | `AUTOGEN_SECRET` (custom) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTOGEN_SECRET`, optional `APP_URL` |
| `pt-plan-generator` | deterministic | template-based workout plan generation | `/api/jobs/[id]/process` and `pt-autogen-drafts` | user JWT for manual path; `AUTOGEN_SECRET` for autogen path | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTOGEN_SECRET` |
| `pt-workout-generator` | AI | AI workout plan generation; normalizes to app plan shape | `/api/jobs/[id]/process`, `src/lib/services/generator.ts` | user JWT | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY` |
| `pt-meal-generator` | AI | AI meal plan + grocery list (UK grocery rules) | `src/lib/services/generator.ts`, `pt-autogen-drafts` | usually user JWT when invoked via Supabase client; autogen fetch path exists | `OPENAI_API_KEY`, optional `MEAL_PROMPT_VERSION`, `AUTOGEN_SECRET` (present in code) |
| `pt-generator` | AI | legacy/alternate workout generator invoked by `generateWorkout()` | server wrapper `src/lib/services/generator.ts` | user JWT | `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` (per code) |
| `pt-template-generator` | deterministic | creates a workout template blueprint json | templates UI (browser fetch) | **anon key** (public) | none required |

---

## API routes inventory (Next.js)

All route handlers live under `src/app/api/**/route.ts`. High-signal list (complete list found in repo):

### Auth

- `POST /api/pt/login`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/reset/send`
- `POST /api/auth/reset/verify`

### Billing / Stripe

- `POST /api/billing/create-checkout`
- `POST /api/stripe/checkout`
- `POST /api/stripe/checkout-milo`
- `POST /api/billing/webhook` (Stripe → app)
- `POST /api/billing/sync-session`
- `POST /api/billing/sync`
- `GET|PATCH /api/billing/profile`
- `POST /api/billing/cancel`
- `POST /api/billing/resume`
- `POST /api/billing/cancellation-feedback`
- `POST /api/billing/exit-offer-50`
- `POST /api/billing/apply-exit-offer`
- `POST /api/billing/apply-loyalty-reward` (cron/internal)

### Plans / Share

- `GET /api/plans/[planId]`
- `GET /api/plans/[planId]/share`
- `POST /api/plans/send`
- `GET|POST /api/share/plan-completions`

### Jobs / generation

- `GET|POST /api/jobs`
- `POST /api/jobs/batch`
- `GET /api/jobs/[id]`
- `POST /api/jobs/[id]/process`
- `POST /api/jobs/[id]/cancel`

### Automation / internal

- `GET|POST /api/cron/autogen-drafts` (Vercel cron)
- `POST /api/internal/send-plan-ready` (edge callback)

### Dashboard / clients / notifications

- `GET /api/dashboard/summary`
- `GET /api/clients/recent`
- `POST /api/pt/upload-logo`
- `GET /api/generate-context`
- `GET|POST|PATCH|DELETE /api/notifications*`

### Dev-only

- `POST /api/dev/send-trial-email` (guarded by `NODE_ENV === "development"`)

---

## Environment variables (complete surface area)

### Next.js app (Vercel) — used in `src/`

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

**Stripe:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_ELITE`

**Email (Resend):**
- `RESEND_API_KEY`

**Share links:**
- `PLAN_SHARE_SECRET`

**Automation / internal secrets:**
- `CRON_SECRET`
- `AUTOGEN_SECRET`

**Deployment / app URL:**
- `NEXT_PUBLIC_APP_URL`
- `VERCEL_URL` (provided by Vercel)

**Debug flags:**
- `NEXT_PUBLIC_DEBUG_GENERATION` (enables generation audit logging/UI)

**Runtime:**
- `NODE_ENV`

### Supabase Edge Function secrets — used in `supabase/functions/*`

**Supabase platform:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Automation:**
- `AUTOGEN_SECRET`
- `APP_URL` (the Next.js app base URL, used for callback email)

**AI keys:**
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY` (used by `pt-generator` and prototype generator)

**Meal generator:**
- `MEAL_PROMPT_VERSION` (optional)

**Grocery builder audit/debug toggles (optional):**
- `UNIT_CONVERSION_AUDIT`
- `COOKED_DRY_AUDIT`
- `COOKED_DRY_LOOKUP_FALLBACK`
- `GROCERY_PACK_AUDIT`
- `GROCERY_UNIT_DEBUG`
- `DEBUG_GROCERY_EXPLAIN`
- `GROCERY_ID_AUDIT`
- `DENO_ENV`
- `NODE_ENV`

---

## Current setup & connection checklist (what must be configured)

### Supabase

- **Project URL + anon key**: set in Vercel as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Service role key**: set in Vercel as `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- **DB schema**:
  - migrations in `supabase/migrations` must be applied
  - verify existence of base tables not created here: `plans`, `clients`, `pt_templates`, `pt_meal_templates`, `billing_processed_invoices`, `pt_email_log`, `plan_completions`
- **Edge functions deployed**: deploy all functions in `supabase/functions/*` used by the app

### Stripe

- **Checkout price ids**: set `STRIPE_PRICE_STARTER|PRO|ELITE`
- **Webhook endpoint**: configure Stripe to call `/api/billing/webhook`
- **Webhook signing secret**: set `STRIPE_WEBHOOK_SECRET`

### Resend

- Set `RESEND_API_KEY`
- Verify from-domain/sender is configured to allow `hello@meetmilo.app` and `no-reply@meetmilo.app` (as used in templates)

### Vercel Cron + automation

- Ensure `vercel.json` cron is active in your Vercel project
- Set `CRON_SECRET` (and/or `AUTOGEN_SECRET`) in Vercel
- Set the same value as `AUTOGEN_SECRET` in Supabase Edge Function secrets
- Set `APP_URL` in Supabase secrets so `pt-autogen-drafts` can call back into `/api/internal/send-plan-ready`

---

## Known risks / gaps (from repo docs + direct code reading)

These are “as-is” findings, not fixes:

- **Base schema missing from migrations**: several tables are used but not created here; keep DB schema documented and versioned.
- **plan_jobs RLS**: existing audit docs flag `plan_jobs` as accessed with user client and lacking RLS in migrations.
- **Multiple workout generator paths**: `pt-generator` and `pt-workout-generator` are both used; keep behaviors aligned or deprecate one.
- **Automation timebase is UTC**: `generate_on_dow` logic uses UTC; user expectations may differ by timezone.

---

## Appendix: key file pointers

- **Supabase SSR**: `src/lib/supabase/{env,server,browser,middleware}.ts`, `src/middleware.ts`
- **Stripe**: `src/lib/stripe.ts`, `src/app/api/billing/webhook/route.ts`
- **Checkout**: `src/app/api/billing/create-checkout/route.ts`, `src/app/api/stripe/checkout/route.ts`
- **Jobs**: `src/app/api/jobs/**`, `src/lib/services/plan-jobs.ts`
- **Generators**: `src/lib/services/generator.ts`, `supabase/functions/pt-*-generator/*`
- **Automation**: `vercel.json`, `src/app/api/cron/autogen-drafts/route.ts`, `supabase/functions/pt-autogen-drafts/index.ts`
- **Plan sharing**: `src/lib/plan-share-token*`, `src/app/share/**`, `src/app/api/plans/[planId]/share/route.ts`

