# Personal Trainer Scheduling & Auto-Generation — Full Audit

**Scope:** Feature allowing trainers to select a client, meal/workout templates, schedule a day for auto-generation, and have the system generate draft plans (including “offline” expectations).

**Conclusion:** Scheduling and server-side auto-generation are implemented and **can work** when the cron is invoked daily and env is correct. **Offline support (service worker, local queue, IndexedDB) does not exist.** Several logic and deployment gaps can cause the feature to appear “broken.”

---

## 1. Summary of What IS Working

| Area | Status | Notes |
|------|--------|--------|
| **Schedule persistence** | ✅ Working | Automation is stored in `program_assignments` with `program_type = 'combined'`, `generate_on_dow`, `auto_meals_enabled`, `auto_workouts_enabled`, `workout_template_id`, `meal_template_id`. |
| **Create automation flow** | ✅ Working | `createAutomationAssignment()` in `program-assignments.ts` (lines 141–179) inserts one row; Automation page form calls it and refreshes the list. |
| **Manage automations** | ✅ Working | `loadAssignments()` in `automation/page.tsx` (lines 74–161) loads `program_type = 'combined'` rows and displays them with templates and day. |
| **Cron endpoint** | ✅ Working | `POST /api/cron/autogen-drafts` (route.ts) validates `CRON_SECRET`/`AUTOGEN_SECRET` and invokes `pt-autogen-drafts` edge function. |
| **Edge autogen logic** | ✅ Working | `pt-autogen-drafts` (supabase/functions/pt-autogen-drafts/index.ts) selects combined assignments, filters by `generate_on_dow` and time window, calls `pt-plan-generator` (workout) and `pt-meal-generator` (meal), inserts into `plans` with `assignment_id`, `week_number`, `status = 'draft'`, `generated_by = 'auto'`. |
| **Workout autogen path** | ✅ Working | Edge uses `assignment_id` + `week_number`; `pt-plan-generator` supports `autogen_secret` + `assignment_id` + `week_number`, loads assignment, `workout_template_id`, template, client, and returns one week. |
| **Meal autogen path** | ✅ Working | Edge loads meal template + client, merges defaults + presets, invokes `pt-meal-generator`, inserts plan with `content_json`, `assignment_id`, `week_number`. |
| **Draft visibility** | ✅ Working | `listAutoDraftPlansForDashboard()` in `plans.ts` (lines 285–333) selects `status = 'draft'` and `generated_by = 'auto'`; dashboard uses this for “Drafts Ready” (dashboard.ts, ControlWall.tsx). |
| **Notifications** | ✅ Working | Edge inserts into `pt_notifications` for each created draft (`insertAutogenDraftNotification`). |

---

## 2. Bugs and Broken Links (with file:line)

### 2.1 Scheduling / trigger logic

| # | Issue | Location | Severity |
|---|--------|----------|----------|
| 1 | **Generation window excludes week-start day** | `supabase/functions/pt-autogen-drafts/index.ts` (lines 114–118) | **High** |
|   | Window is `[nextWeekStart - leadDays, nextWeekStart)`. With default `autogen_lead_days = 2`, only the two calendar days *before* the “next week start” are in the window. If the user picks as “Generate day” the same weekday as their week start (e.g. automation created on a Wednesday → week starts Wednesday; user picks “Wednesday”), cron never runs on that day because `today >= nextWeekStart` skips it. So “Generate day” only works when that day falls *strictly before* the computed next week start. | | |
| 2 | **Combined assignments never set `autogen_lead_days`** | `src/lib/services/program-assignments.ts` (lines 155–171) | **Medium** |
|   | `createAutomationAssignment()` does not set `autogen_lead_days`; the DB default is 2. So the run window is always 2 days. There is no UI to change this for the Automation page (only for the client-level program assignments in ClientAssignedPrograms). If a different lead window were desired for “combined” automations, it cannot be set. | | |
| 3 | **Cron must be invoked externally** | `src/app/api/cron/autogen-drafts/route.ts`; docs `AUTOGEN_DRAFTS_CRON.md` | **High** |
|   | Nothing in the app calls the cron automatically. If Vercel Cron (or GitHub Actions, etc.) is not configured to `POST /api/cron/autogen-drafts` at least once per day (e.g. 06:00 UTC), the scheduler never runs and no drafts are created. This is the most likely reason the feature appears “broken.” | | |

### 2.2 Auto-generation logic

| # | Issue | Location | Severity |
|---|--------|----------|----------|
| 4 | **No retry or idempotency key for edge invocations** | `supabase/functions/pt-autogen-drafts/index.ts` (e.g. lines 158–164, 262–266) | **Low** |
|   | If `pt-plan-generator` or `pt-meal-generator` fails transiently (e.g. timeout), the edge function does not retry. The assignment is skipped for that run. | | |
| 5 | **Plan insert uses `pt_user_id`; clients use `pt_id`** | Edge inserts into `plans` with `pt_user_id`; `listAutoDraftPlansForDashboard` joins clients with `pt_id` (plans.ts line 318). Both should refer to the same PT. If schema or RLS ever diverges, drafts could be hidden. | **Low** (verify schema consistency) |

### 2.3 Offline support

| # | Issue | Location | Severity |
|---|--------|----------|----------|
| 6 | **No service worker** | Entire `src/` | **Critical for “offline”** |
|   | No service worker is registered. There is no PWA or offline shell. | | |
| 7 | **No Background Sync or local queue** | Entire `src/` | **Critical for “offline”** |
|   | No Background Sync API, no client-side queue for “schedule automation” or “generate when back online.” | | |
| 8 | **No IndexedDB / localStorage for scheduled job** | Entire `src/` | **Critical for “offline”** |
|   | Schedule is only persisted when `createAutomationAssignment` (server action) succeeds. If the user is offline, the action fails and the schedule is not stored anywhere locally; there is no replay when back online. | | |
| 9 | **Generation is server-only** | Edge function + cron | **By design** |
|   | Draft creation runs only in the edge function when cron calls it. There is no client-side or “offline” generation path. “Works when offline” only in the sense that the trainer does not need to be in the app at trigger time—not that scheduling or generation can happen while the device is offline. | | |

### 2.4 Data flow / integration

| # | Issue | Location | Severity |
|---|--------|----------|----------|
| 10 | **Outdated doc** | `docs/AUTOGEN_DRAFTS_CRON.md` (line 23) | **Low** |
|   | Doc says “workout only in v1”; implementation supports `program_type = 'combined'` with both meals and workouts. | | |
| 11 | **Cron route does not pass JWT** | `src/app/api/cron/autogen-drafts/route.ts` (lines 27–34) | **By design** |
|   | Cron uses only `secret` in body/header; edge uses `AUTOGEN_SECRET` and service role. Correct for server-to-server; no bug. | | |

---

## 3. Root Cause Analysis: Why Offline Generation Fails

- **“Offline” is not implemented.**  
  The codebase has:
  - No service worker.
  - No IndexedDB or localStorage persistence of “schedule automation” or “run generation when online.”
  - No Background Sync or similar API to replay failed or deferred requests.

- **Where the chain effectively breaks for “offline”:**
  1. **Saving the schedule:** `CreateAutomationForm` calls server action `createAutomationAssignment()`. If the user is offline, the request fails and no row is written to `program_assignments`. There is no local queue to retry when online.
  2. **Running generation:** Generation only runs when the **cron** calls the edge function. Cron runs on the server (or external scheduler). So:
     - If the trainer is “offline” but the server is up: cron can still run and create drafts; the trainer just doesn’t see them until they’re back online. That part works.
     - If “offline” means the trainer’s device is offline: they cannot save a new automation until they’re online; once saved, generation still depends on cron (server-side), not on the device.

- **Conclusion:** The feature does not support “create schedule while offline” or “queue generation to run when I’m back online.” To support that, you’d need a client-side queue (e.g. IndexedDB) and a sync path (e.g. Background Sync or a “sync when online” flow) that creates/updates `program_assignments` and optionally triggers or marks jobs for the next cron run.

---

## 4. Suggested Fixes (Priority Order)

### P0 – Must fix for “scheduler works at all”

1. **Ensure the cron runs daily**
   - Configure Vercel Cron (or equivalent) to `POST https://<your-app>/api/cron/autogen-drafts` once per day (e.g. 06:00 UTC).
   - Or use GitHub Actions / external cron with `Authorization: Bearer <CRON_SECRET>` or body `{ "secret": "<CRON_SECRET>" }`.
   - Set `CRON_SECRET` and `AUTOGEN_SECRET` in the app and in Supabase Edge Function secrets.

2. **Fix “Generate day” window so the chosen day can run**
   - **Option A:** Include the week-start day in the run window, e.g. use `today > windowStartStr || today >= nextWeekStart` → “run when today is in (windowStart, nextWeekStart]” so the day that equals `nextWeekStart` can trigger (file: `supabase/functions/pt-autogen-drafts/index.ts`, around 118).
   - **Option B:** Keep window as-is but document clearly: “Generate day must be before the week start (e.g. if your week starts Monday, choose Saturday or Sunday).” Option A is better UX.

### P1 – Important for correctness and UX

3. **Optional: Allow `autogen_lead_days` for combined automations**
   - In `createAutomationAssignment` (and update path), accept optional `autogen_lead_days` (e.g. 0–6) and persist it so the edge window matches user expectation.
   - Optionally expose this in the Automation UI (e.g. “Run up to N days before week start”).

4. **Update AUTOGEN_DRAFTS_CRON.md**
   - Replace “workout only in v1” with “combined (meal + workout) assignments; both run when enabled.”

### P2 – Offline (only if product requires it)

5. **Design offline support**
   - **Service worker:** Register a worker; cache static assets and optionally cache API responses for read-only views.
   - **Queue scheduling intent:** When the user taps “Schedule” offline, store payload in IndexedDB (e.g. “pending_automation” store). When back online, call `createAutomationAssignment` for each pending item and clear on success.
   - **Background Sync:** If supported, register a sync event for “pending_automation” so replay happens when the browser decides (e.g. when connection is restored). Fallback: on load when `navigator.onLine`, process the IndexedDB queue.
   - **Generation:** Keep generation server-side (cron + edge). No need to run generation in the client; once the schedule is synced to `program_assignments`, the next daily cron will create drafts.

---

## 5. Data Flow Summary

```
Trainer selects client + templates + day (Automation page)
  → CreateAutomationForm.handleSchedule()
  → createAutomationAssignment({ client_id, workout_template_id, meal_template_id, generate_on_dow, auto_meals_enabled, auto_workouts_enabled })
  → INSERT program_assignments (program_type='combined', ...)
  → Row persisted in DB ✅

Daily (external) cron
  → POST /api/cron/autogen-drafts (Bearer CRON_SECRET or body.secret)
  → route.ts: fetch(pt-autogen-drafts) with body { secret }
  → Edge: SELECT program_assignments WHERE auto_generate_enabled=true, paused=false, active=true, program_type='combined'
  → For each: if todayDow === generate_on_dow && today in [nextWeekStart - leadDays, nextWeekStart)
      → Workout: fetch(pt-plan-generator, { autogen_secret, assignment_id, week_number }) → INSERT plans (workout, assignment_id, week_number, status=draft, generated_by=auto)
      → Meal:   fetch(pt-meal-generator, { mealInputs }) → INSERT plans (meal, ...)
  → insertAutogenDraftNotification for each created plan

Dashboard / Review
  → listAutoDraftPlansForDashboard() → plans WHERE status=draft, generated_by=auto
  → “Drafts Ready” in ControlWall; links to /pt/app/plans/[planId]
```

The chain breaks if: (1) cron is never invoked, (2) `generate_on_dow` falls outside the computed window (see bug #1), or (3) env/secrets are missing or wrong. Offline scheduling/generation breaks because there is no client-side queue or service worker.

---

## 6. Post-fix: Env vars for go-live

**Vercel (project env)**

| Variable | Required | Notes |
|----------|----------|--------|
| `CRON_SECRET` | Yes (for cron) | Long random string. Vercel sends it as `Authorization: Bearer <CRON_SECRET>` when invoking the cron. |
| `AUTOGEN_SECRET` | Yes | Same value as in Supabase; used when route calls pt-autogen-drafts and for fallback auth if `CRON_SECRET` is unset. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key. |

**Supabase Edge Function secrets (pt-autogen-drafts)**

| Secret | Required | Notes |
|--------|----------|--------|
| `SUPABASE_URL` | Yes | Auto-injected by Supabase; ensure the function has it. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | For server-side DB and invoking other functions. |
| `AUTOGEN_SECRET` | Yes | Must match the value in Vercel; validated in the function body. |
