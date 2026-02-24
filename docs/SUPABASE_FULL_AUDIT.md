# Supabase full audit — findings only (no edits)

Audit date: 2025-02-20. No code or SQL changes; findings only for review before cleanup.

---

## 1. Tables

### 1.1 Tables created or altered in `supabase/migrations/`

| Table | Purpose | Actively queried? | RLS in migrations? | Redundancy / notes |
|-------|---------|-------------------|---------------------|--------------------|
| **profiles** | Extended user profile (billing, branding, trial, access_mode). FK to `auth.users`. | Yes — `src/` and `supabase/functions/` (many routes, cron, webhook, profile, billing, auth). | Yes. SELECT/UPDATE own; INSERT only via trigger (SECURITY DEFINER + row_security off). | None. `display_name`, `business_name`, `brand_logo_url` added in more than one migration (IF NOT EXISTS, safe). |
| **plan_jobs** | Generation Center job queue (meal/workout/both); status, payload, result_plan_ids. | Yes — `src/lib/services/plan-jobs.ts`, `src/app/api/jobs/*`, assign flow, process route, edge function `pt-autogen-drafts`. | **No.** No RLS in any migration. | None. |
| **program_assignments** | One row per client–program; start_date, autogen settings, template FKs, generate_on_dow, active, auto_meals_enabled, auto_workouts_enabled. | Yes — `src/lib/services/program-assignments.ts`, automation page, `pt-autogen-drafts`, `pt-plan-generator`. | Yes. SELECT/INSERT/UPDATE/DELETE own (`pt_user_id = auth.uid()`). | None. |
| **plans** | Per-PT, per-client plans (workout/meal); content_json, review_status, assignment_id, week_number, status, generated_by, etc. | Yes — plans service, share pages, send route, autogen, plan-generator. | **Unknown.** Table only **altered** in migrations (never created here). RLS not set in this repo. | None. |
| **clients** | PT’s clients; name, email, notes, inputs_json, presets_json, assigned_*_program_id. | Yes — clients service, plans send, automation, cron autogen-drafts, pt-plan-generator. | **Unknown.** Table only **altered** in migrations (never created here). RLS not set in this repo. | None. |
| **cancellation_feedback** | Cancel flow: reason + details per PT user. | Yes — `src/app/api/billing/cancellation-feedback/route.ts`. | Yes. INSERT/SELECT own. | None. |
| **pt_notifications** | In-app notifications (e.g. autogen draft ready). | Yes — `src/app/api/notifications/*`, edge function `pt-autogen-drafts` (insert). | Yes. SELECT/UPDATE/DELETE/INSERT own. Service role used for cron inserts. | None. |

### 1.2 Tables referenced in code but **not** created in `supabase/migrations/`

(Assumed to exist in DB via Dashboard or other migrations.)

| Table | Purpose (from usage) | Actively queried? | RLS in repo? | In `src/types/database.ts`? |
|-------|----------------------|-------------------|--------------|------------------------------|
| **pt_templates** | Workout templates (name, goal, blueprint_json, etc.). | Yes — templates pages, assign, plan-generator, autogen-drafts, ptTemplatesServer, workoutTemplates. | No (not in migrations). | Yes — `PtTemplate`. |
| **pt_meal_templates** | Meal templates (name, defaults). | Yes — meal templates services, automation page, autogen-drafts. | No (not in migrations). | Yes — `MealTemplate`. |
| **billing_processed_invoices** | Idempotency for Stripe invoice events (webhook). | Yes — `src/app/api/billing/webhook/route.ts` (select/insert). | No (not in migrations). | No. |
| **pt_email_log** | Dedupe log for sent emails (e.g. trial started, loyalty). | Yes — `src/lib/email/check-and-log.ts` (select/insert). Service role only. | No (not in migrations). | No. |
| **plan_completions** | Share flow: completions per plan (week_number, day_index, completed_at). | Yes — `src/app/api/share/plan-completions/route.ts`, `src/app/api/plans/[planId]/route.ts`. Service role in share route. | No (not in migrations). | No (local type in route). |

### 1.3 Storage

- **Bucket `public-assets`** — Created in `20260216000001_storage_public_assets_bucket.sql`. Policies: pt-logos upload/update (authenticated, own folder), public read. No redundancy found.

### 1.4 Other

- **RPC `increment_profile_lifetime_value`** — Used in billing webhook. Not defined in migrations (assumed created elsewhere). Not listed in `database.ts`.

- **Profile `name`** — Referenced in `src/types/database.ts` and `src/lib/coach-display-name.ts` as fallback for display name. **Not** added to `profiles` in any migration in this repo (may be from auth or external schema).

---

## 2. Edge functions

All under `supabase/functions/`. Invocations found via grep of `src/` and `supabase/functions/` for `functions.invoke(...)`, `fetch(.../functions/v1/...)`.

| Function | What it does | Invoked from? | Duplicate / superseded? |
|----------|----------------|---------------|--------------------------|
| **pt-autogen-drafts** | Cron job: lists program_assignments, creates draft plans (workout + meal) via pt-plan-generator / pt-meal-generator, inserts plans and pt_notifications; calls internal send-plan-ready API. | `src/app/api/cron/autogen-drafts/route.ts` (cron → `fetch(…/functions/v1/pt-autogen-drafts)`). | No. |
| **pt-plan-generator** | Template-based plan generation; reads program_assignments, pt_templates, clients, profiles; returns plan JSON. | `src/app/api/jobs/[id]/process/route.ts` (invoke), `supabase/functions/pt-autogen-drafts/index.ts` (fetch). | No. |
| **pt-workout-generator** | AI workout generation; returns normalised plan. | `src/lib/services/generator.ts` (generateWorkoutDraft), `src/app/api/jobs/[id]/process/route.ts` (invoke). | No. |
| **pt-meal-generator** | Meal plan generation (mealInputs → mealPlan, grocerySections, etc.). | `src/lib/services/generator.ts` (generateMeal), `supabase/functions/pt-autogen-drafts/index.ts` (fetch). | No. |
| **pt-generator** | Workout plan generation (different API from pt-workout-generator). | `src/lib/services/generator.ts` (generateWorkout only). | Not superseded; both pt-generator and pt-workout-generator are used (different flows). |
| **pt-template-generator** | Creates workout template (blueprint). | `src/app/templates/CreateProgramModal.tsx`, `src/app/templates/create/page.tsx` (fetch from browser). | No. |

**Summary:** All six deployable functions are invoked. None are duplicates; pt-generator and pt-workout-generator serve different code paths.

---

## 3. Migrations

### 3.1 Alter/drop of non-existent objects

- All `DROP` usages in migrations use `IF EXISTS` (policies, trigger, constraint, index). No migrations alter or drop objects that are guaranteed to be missing.
- Tables altered but not created in this repo: `plans`, `clients`. They are assumed to exist before these migrations run.

### 3.2 Columns added in migrations but never referenced in code

- **profiles:** All added columns appear in code or types (including `subscription_started_at`, `lifetime_value`, `access_mode`, `trial_started_email_sent_at`, `coaching_focus`, `cancel_effective_at`, `email`). `name` is used in types/coach-display-name but **not** added in any migration (see 1.4).
- **plans:** All added columns (review_status, review_ready_at, sent_at, assignment_id, week_number, status, generated_by, edited_at, source_hash, needs_regen, last_sent_to, last_sent_subject) are referenced in `src/` or types.
- **program_assignments:** All added columns (workout_template_id, meal_template_id, generate_on_dow, active, auto_meals_enabled, auto_workouts_enabled, program_id nullable) are referenced.
- **plan_jobs:** `result_plan_ids` (jsonb) is used in code; migration uses jsonb (code uses string[] — type coercion).
- **clients:** Only `email` is added in migrations; it is used.
- **cancellation_feedback / pt_notifications:** All columns used.

No migration-added column was found that is never selected or inserted in `src/` or `supabase/functions/`.

### 3.3 Tables created in migrations but not in `src/types/database.ts`

- **cancellation_feedback** — Created in migrations, used in API route; **not** in `database.ts`.
- **pt_notifications** — Created in migrations, used in API and edge function; **not** in `database.ts`.
- **pt_email_log** — Not in migrations (not created here); used in code; **not** in `database.ts**.

Tables created in migrations that **are** in `database.ts`: profiles (Profile), plan_jobs (PlanJob), program_assignments (ProgramAssignment). Plans, clients, pt_templates, pt_meal_templates are in `database.ts` but not created in this repo’s migrations.

### 3.4 Duplicate / redundant migrations

- **coaching_focus** — Added in both `20260219500000_profiles_coaching_focus.sql` and `20260219700000_profiles_signup_columns.sql` (both `ADD COLUMN IF NOT EXISTS`). Safe but redundant.
- **profiles** — display_name, business_name, brand_logo_url added in `20260217000000` and again in `20260218200000` (IF NOT EXISTS). Safe but redundant.

---

## 4. Orphaned or unused items — candidates for cleanup

No edits or SQL below; prioritised list only.

### High confidence (safe to consider for removal after confirmation)

- **None.** Every table that is queried in the codebase appears to be in use. No table was found that has zero reads and zero writes in `src/` or `supabase/functions/`.
- **Edge functions:** All six are invoked; none are orphaned.
- **my_subscription:** Not referenced anywhere in the repo; no such table or object found.

### Medium / low confidence (verify before removing)

- **RPC `increment_profile_lifetime_value`** — Used in webhook; not defined in migrations. If it were removed from DB, webhook would break; do not remove without replacing behaviour.
- **Tables not in migrations** (`billing_processed_invoices`, `plan_completions`, `pt_email_log`, and the base tables `plans`, `clients`, `pt_templates`, `pt_meal_templates`) — All are actively used. They are “orphans” only in the sense that they are not created or RLS-managed in this repo; they are not unused.

### Type / schema tidy-up (non-destructive)

- Add types to `database.ts` for: **cancellation_feedback**, **pt_notifications**, **plan_completions** (shape already in share route), **pt_email_log**, and optionally **billing_processed_invoices**, so schema and code stay in sync.
- **Profile**: Consider adding `subscription_started_at`, `lifetime_value` (and `name` if it exists in DB) to the `Profile` interface if they exist in the DB.

---

## 5. RLS gaps

Tables that hold user/tenant data but have **no RLS** in this repo’s migrations and are not exclusively accessed via service role:

| Table | Notes |
|-------|--------|
| **plan_jobs** | Holds `pt_user_id`, client_id, payload. Queried via **user-scoped Supabase client** in `src/lib/services/plan-jobs.ts` (supabaseServer()). With **no RLS**, any authenticated user could in theory query all rows (app filters by `pt_user_id` in WHERE). **Recommendation:** Enable RLS and add policies so users only see/update their own rows. |
| **plans** | Altered only in migrations; RLS not set here. If RLS is disabled, plans are visible to any anon/authenticated client that hits the API. Need to confirm in DB whether RLS is enabled and policies exist. |
| **clients** | Same as plans — altered only; RLS unknown in repo. Confirm in DB. |
| **pt_templates** | Referenced by FKs from program_assignments; not created in repo. If no RLS, templates could be cross-tenant visible. Confirm in DB. |
| **pt_meal_templates** | Same as pt_templates. Confirm in DB. |
| **billing_processed_invoices** | Only used in webhook with **service role**. If the table is never accessed with anon/key, RLS is less critical but still recommended for defence in depth. |
| **plan_completions** | Share route uses **service role**. Same as above. |
| **pt_email_log** | Only used in `check-and-log.ts` with **service role**. Same as above. |

**Summary:** The only table in this repo that we **know** has no RLS and is accessed with the **user’s** Supabase client is **plan_jobs**. The others are either RLS-protected in migrations (profiles, program_assignments, cancellation_feedback, pt_notifications) or their RLS status is unknown because the table is not created/managed here.

---

## 6. Summary

| Area | Finding |
|------|--------|
| **Tables** | 7 tables created/altered in migrations; 5 more used in code but not created here. All are actively used. No redundant tables found. |
| **Edge functions** | 6 functions; all invoked. No orphans or duplicates. |
| **Migrations** | No DROP/ALTER of non-existent objects. No column added in migrations is never referenced. Some tables (cancellation_feedback, pt_notifications) are not in `database.ts`. Minor redundancy (same column added in multiple migrations with IF NOT EXISTS). |
| **Orphaned/unused** | No tables or edge functions identified as safe to remove. Optional: add missing types and consider RLS for plan_jobs and for tables not managed in repo. |
| **RLS** | **plan_jobs** has no RLS and is accessed with user client — clear gap. RLS status of plans, clients, pt_templates, pt_meal_templates, billing_processed_invoices, plan_completions, pt_email_log is unknown in repo (confirm in DB). |

No edits or SQL have been made. Use this list to decide cleanup and then request specific changes (e.g. RLS policies, type additions, or migration tidy-up) in a follow-up.
