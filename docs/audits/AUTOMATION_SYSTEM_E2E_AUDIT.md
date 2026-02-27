# Automation system – end-to-end audit

**Goal:** Automation is the core USP; it must work 100% reliably in Vercel production.  
**Scope:** Cron trigger → Next.js route → Supabase Edge Function → plan creation → dashboard and failure handling.

---

## 1. Cron trigger

### 1.1 Vercel cron configuration

**File:** `vercel.json`

```json
{"crons":[{"path":"/api/cron/autogen-drafts","schedule":"0 6 * * *"}]}
```

- **Path:** `/api/cron/autogen-drafts` → matches Next.js route `src/app/api/cron/autogen-drafts/route.ts`.
- **Schedule:** `0 6 * * *` = **06:00 UTC every day** (cron expression: minute 0, hour 6).
- **Method:** Vercel cron sends **GET** only. The route exports both **GET** and **POST**. GET validates `Authorization: Bearer CRON_SECRET` and runs the same logic as POST (shared `runAutogenCron()`). POST still accepted for manual calls with `body.secret`.
- **Auth:** When `CRON_SECRET` is set in Vercel env, Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron requests. The route accepts that or `body.secret`.

### 1.2 Cron route handler (full)

**File:** `src/app/api/cron/autogen-drafts/route.ts`

- **Auth:** Reads `Authorization: Bearer <token>` or `body.secret`. Compares to `process.env.CRON_SECRET || process.env.AUTOGEN_SECRET`. If missing or no match → **401 Unauthorized**. Correct.
- **Errors:** Missing Supabase URL/anon key → 500. Edge function non‑OK → 500 with details. Top-level catch → 500 with message and stack. Graceful.
- **Edge invocation:** `fetch(\`${supabaseUrl}/functions/v1/pt-autogen-drafts\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: process.env.AUTOGEN_SECRET || expected }) })`. No `Authorization` header; secret is in **body only**. The edge function accepts `body.secret` or `Authorization`, so this is valid.
- **SUPABASE_SERVICE_ROLE_KEY:** Not passed to the edge function. The edge function uses its own `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` (set in Supabase Edge Function secrets). Correct for server‑to‑server; no user session.
- **maxDuration:** **Set to 300** in the route so the handler can wait for the edge function and optional emails within Vercel’s limit.

---

## 2. Edge function invocation (from cron route)

- **URL:** `process.env.NEXT_PUBLIC_SUPABASE_URL` + `/functions/v1/pt-autogen-drafts` (e.g. `https://<project>.supabase.co/functions/v1/pt-autogen-drafts`).
- **Method:** POST.
- **Headers:** `Content-Type: application/json` only. No `Authorization`, no `apikey`.
- **Body:** `{ "secret": process.env.AUTOGEN_SECRET || process.env.CRON_SECRET }`.
- **AUTOGEN_SECRET / CRON_SECRET:** Same value must be set in (1) Vercel env as `CRON_SECRET` and/or `AUTOGEN_SECRET`, and (2) **Supabase Edge Function secrets** as `AUTOGEN_SECRET`. The edge function validates only `AUTOGEN_SECRET` from its env. So if you only set `CRON_SECRET` in Vercel, the body will send that value, but the edge compares to `AUTOGEN_SECRET` in Supabase; they must match. Best practice: set one shared secret as both `AUTOGEN_SECRET` in Supabase and either `AUTOGEN_SECRET` or `CRON_SECRET` in Vercel.
- **SUPABASE_SERVICE_ROLE_KEY:** Not sent from Next.js. The edge function uses its own Supabase client with `createClient(supabaseUrl, serviceRoleKey)` from its env. Correct.

---

## 3. pt-autogen-drafts edge function

**File:** `supabase/functions/pt-autogen-drafts/index.ts`

### 3.1 Config and auth

- **Env:** Requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTOGEN_SECRET` (all from Deno.env). Optional `APP_URL` for “plan ready” emails.
- **Auth:** `secret = body.secret ?? Authorization Bearer`. Rejects if `secret !== autogenSecret` with 401.

### 3.2 Who gets plans today

- **Table:** `program_assignments`.
- **Query:**  
  `auto_generate_enabled = true`, `paused = false`, `active = true`, `program_type = 'combined'`.  
  Selects: id, pt_user_id, client_id, start_date, autogen_lead_days, generate_on_dow, active, auto_meals_enabled, auto_workouts_enabled, workout_template_id, meal_template_id.
- **“Today” condition (UTC):**  
  - `today = toDateOnly(now)` (YYYY-MM-DD).  
  - `todayDow = now.getUTCDay()` (0–6, Sunday–Saturday).  
  - For each assignment: **run only if `todayDow === (generate_on_dow ?? 6)`**. So generation runs only on the configured weekday (e.g. Thursday = 4).
- **Lead days and windows:**  
  - `leadDays = clamp(autogen_lead_days ?? 2, 0, 6)`.  
  - **Next week:** `nextWeekStart = start_date + (nextWeekNumber - 1) * 7 days`, `windowStart = nextWeekStart - leadDays`. `inNextWeekWindow = today >= windowStartStr && today <= nextWeekStart`.  
  - **Week 1:** `week1WindowStart = start_date - leadDays`. `inWeek1Window = today >= week1WindowStartStr && today <= week1Start`.  
  - If not in either window, assignment is skipped (no duplicate run for that week).
- **Timezone:** All logic is **UTC** (e.g. `getUTCDay()`, dates in ISO). Cron at 06:00 UTC means “today” is the same calendar day everywhere for the trigger; trainers in other timezones see drafts “on the chosen day” in UTC terms (e.g. 06:00 UTC Thursday = late Wed / early Thu elsewhere). Document for users or consider timezone later.

### 3.3 Workout vs meal

- **Workout:** When `auto_workouts_enabled !== false` and `workout_template_id` is set: calls **pt-plan-generator** (template-based), then inserts into `plans` with `status: 'draft'`, `generated_by: 'auto'`, `review_status: 'ready'`, etc.
- **Meal:** When `auto_meals_enabled === true` and `meal_template_id` is set: loads template + client, builds `mealInputs`, calls **pt-meal-generator**, then inserts plan. Same status/generated_by/review_status.
- Both can run for the same assignment (workout then meal).

### 3.4 How drafts are created

- **Workout:** `fetch(supabaseUrl/functions/v1/pt-plan-generator)` with body `{ autogen_secret, assignment_id, week_number }`. No `Authorization` header. pt-plan-generator validates `body.autogen_secret === AUTOGEN_SECRET` and uses service role to load assignment/template/client and generates plan; returns `{ week, source_hash }`. Edge function inserts row into `plans`.
- **Meal:** `fetch(supabaseUrl/functions/v1/pt-meal-generator)` with body `{ mealInputs }` only. **No auth header and no secret in body.** pt-meal-generator comment says “no auth required”; if Supabase project enforces JWT on functions, this could 401. Confirm function is deployable with `--no-verify-jwt` or equivalent so server-to-server call works.
- **Inserted fields:** pt_user_id, client_id, plan_type, content_json, assignment_id, week_number, **status: 'draft'**, **generated_by: 'auto'**, review_status: 'ready', review_ready_at: now. Optional source_hash (workout). Unique constraint `(assignment_id, week_number, plan_type)` prevents duplicate plans per assignment/week/type.

### 3.5 One client fails

- Each assignment is in a **try/catch**. On error, the error is logged and pushed to `results` with `action: "error"`; the loop **continues** to the next assignment. No all-or-nothing; one failure does not stop others.

### 3.6 Notifications and email

- After each **successful** plan insert: `insertAutogenDraftNotification(...)` inserts into `pt_notifications` (type `autogen_draft_ready`, link to plan).
- If `APP_URL` is set: `sendPlanReadyEmailToPt(...)` calls **Next.js** `POST ${appUrl}/api/internal/send-plan-ready` with header `x-internal-secret: cronSecret` and body ptUserId, ptEmail, clientName, planType, planId. That API sends the “autogen plan ready” email and logs it. Fire-and-forget; errors are logged in the edge function only.

---

## 4. program_assignments table

### 4.1 Schema (from migrations)

- **Core:** id, pt_user_id, client_id, program_type ('workout' | 'meal' | 'combined'), program_id (nullable), start_date (date), auto_generate_enabled, autogen_lead_days (0–6), paused, active, generate_on_dow (0–6, 0=Sunday), workout_template_id, meal_template_id, auto_meals_enabled, auto_workouts_enabled, created_at, updated_at.
- **Automation behaviour:**  
  - **generate_on_dow:** Day of week to run (cron runs daily; edge filters by this).  
  - **autogen_lead_days:** How many days before the week start to generate (window start = week start − lead_days).  
  - **active:** If false, excluded from autogen.  
  - **paused:** If true, excluded.  
  - **auto_generate_enabled:** Must be true to be considered.  
  - **program_type:** Only `'combined'` is selected by pt-autogen-drafts.

### 4.2 Query used for “due today”

As above: `auto_generate_enabled = true`, `paused = false`, `active = true`, `program_type = 'combined'`, then in code `todayDow === generate_on_dow` and date in window.

### 4.3 Duplicate risk

- **Plans:** Unique index `(assignment_id, week_number, plan_type)`. Same assignment/week/type cannot insert twice; duplicate insert yields 23505, handled as `duplicate_skipped`.  
- **Same day double run:** If cron ran twice the same day (e.g. retry or misconfiguration), the second run would see existing plans and either skip (exists_unchanged / skipped_edited) or update needs_regen. No duplicate plan rows.  
- **program_assignments:** No unique constraint on (client_id, program_type). Creating automation twice (e.g. from offline queue twice for same client) can create two rows. Offline flush can therefore create duplicate automations (see §7).

---

## 5. Plan creation from automation vs manual

- **Auto:** Insert sets `status: 'draft'`, `generated_by: 'auto'`, `review_status: 'ready'`, `review_ready_at: now`, plus assignment_id, week_number.  
- **Manual:** Typically `generated_by: 'manual'` (or default), same status/review_status depending on flow.  
- **Review Plans page:** Uses `listPlansForReview()` which selects `review_status IN ('ready', 'sent')` — so auto drafts with `review_status: 'ready'` appear.  
- **Dashboard “Drafts Ready”:** Uses `listAutoDraftPlansForDashboard()` which selects `status = 'draft'` and `generated_by = 'auto'`. So auto-generated drafts are correctly shown in both places.

---

## 6. Failure handling and reliability

| Scenario | Current behaviour | Gap / risk |
|----------|-------------------|------------|
| Vercel cron doesn’t fire (e.g. outage) | No retry; that day’s run is lost. | No built-in retry or idempotent “catch-up” run. |
| Cron route timeout (e.g. >10s) | Vercel returns 5xx; edge may still complete but client doesn’t get response. | Set `maxDuration` (e.g. 300) on the cron route. |
| Edge function timeout mid-generation | Supabase kills the function; partial results (some plans created, some not). No transactional rollback. | Per-assignment try/catch limits blast radius; no retry inside edge. |
| Retry logic | None in cron route or edge function. | Optional: idempotent “run again same day” or retry failed assignments. |
| Logging / monitoring | console.log/error in route and edge; Vercel/Supabase logs. No structured alerting. | No alert on 5xx or zero plans generated; no health check. |
| Trainer subscription expired | pt-plan-generator checks `profile.access_mode === 'readonly'` and returns 403; edge pushes `action: "error"` and continues. Meal path does not check subscription in the edge function. | Meal autogen does not enforce subscription; could generate for expired accounts. |

---

## 7. Offline queue (IndexedDB)

**File:** `src/lib/offline/automationQueue.ts`

- **Store:** IndexedDB `milo-automation-queue`, store `pending_automations`. Items: `{ id, payload, createdAt }`. Payload: client_id, workout_template_id, meal_template_id, generate_on_dow, auto_meals_enabled, auto_workouts_enabled.
- **Add:** When trainer saves automation while offline (`!navigator.onLine`), `addToAutomationQueue(payload)` is called; no server call.
- **Flush:** On load and on `window.addEventListener("online")`, `flushAutomationQueue()` runs: `getAutomationQueue()`, then for each item `createAutomationAssignment(item.payload)` and `removeFromAutomationQueue(item.id)` on success.
- **Sync:** Each queued item becomes one `createAutomationAssignment` call (insert one row). No deduplication by client_id. If the trainer queued two saves for the same client (e.g. two “Create” clicks while offline), reconnecting will create **two** program_assignments for the same client. **Risk:** duplicate automations for one client.

---

## 8. End-to-end happy path (Monday → Thursday)

1. **Monday:** Trainer goes to Automation, creates automation for Client A: generate on **Thursday** (dow 4), meals + workouts, templates chosen. `createAutomationAssignment` inserts one `program_assignments` row (program_type `combined`, start_date = today, generate_on_dow = 4, etc.).
2. **Thursday 06:00 UTC:** Vercel cron fires, sends GET or POST (see §1.1) to `/api/cron/autogen-drafts` with `Authorization: Bearer CRON_SECRET`.
3. **Cron route:** Validates secret, calls `fetch(pt-autogen-drafts)` with `body: { secret }`. Waits for response (risk: timeout if no maxDuration).
4. **pt-autogen-drafts:** Loads assignments where program_type = combined, auto_generate_enabled, !paused, active. Filters to todayDow === 4. For Client A, computes week 1 or next-week window; if today is in window, runs workout and meal.
5. **Workout:** Fetches pt-plan-generator with autogen_secret, assignment_id, week_number; inserts plan (draft, generated_by auto).
6. **Meal:** Fetches pt-meal-generator with mealInputs; inserts plan (draft, generated_by auto).
7. **Notifications:** Inserts into pt_notifications; calls send-plan-ready API for email.
8. **Thursday morning (trainer):** Dashboard “Drafts Ready” and Review Plans show the new drafts.

**Failure points in this flow:**

1. **Cron method:** If Vercel sends GET and route only exports POST → 405, nothing runs.  
2. **CRON_SECRET / AUTOGEN_SECRET:** Missing or mismatch in Vercel or Supabase → 401.  
3. **Cron route timeout:** No maxDuration → possible 504 before edge responds.  
4. **Edge env:** Missing SUPABASE_URL, SERVICE_ROLE_KEY, or AUTOGEN_SECRET in Supabase secrets → 500.  
5. **APP_URL:** Missing in edge → no “plan ready” email (drafts still created).  
6. **pt-meal-generator auth:** If project requires JWT and edge calls with no auth → 401, meal draft not created.  
7. **Subscription:** Workout path checks readonly; meal path does not.  
8. **RLS on program_assignments:** Edge uses service role, so RLS is bypassed; no issue.  
9. **Offline queue:** Flushing creates one assignment per queued item; duplicate saves → duplicate rows.

---

## 9. Prioritised fix list

### Critical (must fix for 100% reliability)

1. ~~**Set `maxDuration` on the cron route**~~ **Done.** Route now has `export const maxDuration = 300`.

2. ~~**Cron HTTP method (GET)**~~ **Done.** Route now exports GET (validates Bearer, runs shared logic) and POST (for manual calls).

3. **Meal generator auth from edge**  
   Ensure pt-meal-generator can be invoked from pt-autogen-drafts without a user JWT (e.g. deploy with `--no-verify-jwt` or have it accept a server secret in body and validate that). If it currently requires JWT, add the same pattern as pt-plan-generator (e.g. AUTOGEN_SECRET in body) and call it with that.

4. **Secrets consistency**  
   Document and enforce: same secret value set as `AUTOGEN_SECRET` in Supabase Edge Function secrets and as `CRON_SECRET` or `AUTOGEN_SECRET` in Vercel. Edge only reads `AUTOGEN_SECRET`.

### High (should fix)

5. **Subscription check for meal autogen**  
   In pt-autogen-drafts, before calling pt-meal-generator for a given pt_user_id, check profile (e.g. subscription_status / access_mode) and skip or error if not allowed, so expired accounts don’t get meal drafts.

6. **Offline queue deduplication**  
   When flushing, either merge by client_id (e.g. upsert one assignment per client from queued payloads) or prevent duplicate queue entries for the same client so reconnecting doesn’t create multiple automations for one client.

### Medium (improve robustness)

7. **Retry / catch-up**  
   Optional: idempotent “run autogen for today” so a one-off manual call (or second cron run) can catch missed runs without creating duplicate plans (existing unique constraint supports this).

8. **Structured logging**  
   Log a single summary (e.g. assignment count, created count, errors) from the cron route and edge function for easier monitoring and alerting.

9. **Alerting**  
   Use Vercel/Supabase alerts or external monitoring on 5xx from the cron path and on edge errors so silent failures are visible.

### Nice to have

10. **Timezone**  
    Document that “generate day” is UTC; optionally add trainer timezone and “local” generate day later.

11. **Week 1 window vs generate_on_dow**  
    If start_date is Monday and generate_on_dow is Thursday, week 1 window is Sat–Mon so week 1 only runs Sat/Sun/Mon. First “Thursday” run produces week 2. Document or adjust so week 1 can be generated on the chosen weekday if desired.

12. **Health check**  
    Simple GET endpoint that verifies cron route is reachable and (optionally) that key env vars are set (without exposing secrets).

---

**Summary:** The pipeline is wired end-to-end and mostly correct. The main blockers for 100% reliability in production are: **cron route timeout (add maxDuration)**, **cron method (GET vs POST)**, **pt-meal-generator auth when called from the edge**, and **consistent CRON_SECRET/AUTOGEN_SECRET**. After that, subscription for meal autogen and offline-queue deduplication are the next highest impact.
