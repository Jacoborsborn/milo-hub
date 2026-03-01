# Automation System & "Your Draft Plan" Email — Audit

**Scope:** End-to-end automation (cron → edge → draft plans → PT notification + email).  
**Conclusion:** Automation and in-app notifications are wired correctly. The **"Your draft plan" email is only sent when the edge function has `APP_URL` set** in Supabase; if missing, no email is sent (no error, silent skip).

---

## 1. Automation system flow

| Step | Component | What happens |
|------|-----------|--------------|
| 1 | **Vercel Cron** | `vercel.json` runs `POST /api/cron/autogen-drafts` at `0 6 * * *` (06:00 UTC daily). |
| 2 | **Cron route** | `src/app/api/cron/autogen-drafts/route.ts` validates `Authorization: Bearer <CRON_SECRET>` or body `{ secret }` against `CRON_SECRET` or `AUTOGEN_SECRET`. Then `fetch(pt-autogen-drafts)` with body `{ secret: AUTOGEN_SECRET \|\| expected }`. |
| 3 | **Edge pt-autogen-drafts** | Validates secret with `AUTOGEN_SECRET`. Selects `program_assignments` where `auto_generate_enabled=true`, `paused=false`, `active=true`, `program_type='combined'`. For each, if `todayDow === generate_on_dow` and today is in the generation window, generates workout and/or meal draft via `pt-plan-generator` / `pt-meal-generator`, inserts into `plans`, inserts `pt_notifications` row, then **optionally** calls Next.js to send "plan ready" email (see below). |
| 4 | **pt-plan-generator** | When body has `autogen_secret`, `assignment_id`, `week_number` and matches `AUTOGEN_SECRET`, loads assignment and template, returns one week JSON. No DB write. |
| 5 | **pt-meal-generator** | Invoked with `mealInputs`; returns meal plan JSON. |

**Checks performed:**

- Cron is configured: `vercel.json` has `"path": "/api/cron/autogen-drafts"`, `"schedule": "0 6 * * *"`.
- Cron route uses `NEXT_PUBLIC_SUPABASE_URL` and sends `secret` in body to the edge; does not require `SUPABASE_SERVICE_ROLE_KEY` for the autogen invoke (only for optional reminder/loyalty/due-soon emails).
- Edge selects the same columns and filters as in `createAutomationAssignment()` (e.g. `auto_workouts_enabled`, `auto_meals_enabled`, `workout_template_id`, `meal_template_id`).
- Generation window includes the week-start day: `inNextWeekWindow = today >= windowStartStr && today <= nextWeekStart` (inclusive).

---

## 2. "Your draft plan" email wiring

### 2.1 Intended flow

1. **Edge** (after inserting a new draft plan): calls `sendPlanReadyEmailToPt(...)` which:
   - Builds URL: `${appUrl}/api/internal/send-plan-ready` where `appUrl = Deno.env.get("APP_URL") ?? ""`.
   - If `appUrl` is empty, the function **returns without calling the API** (no fetch, no error).
   - If `appUrl` is set: `POST` with header `x-internal-secret: <AUTOGEN_SECRET>` and body `{ ptUserId, ptEmail, clientName, planType, planId }`.

2. **Next.js** `POST /api/internal/send-plan-ready`:
   - Validates `x-internal-secret` against `CRON_SECRET` or `AUTOGEN_SECRET`.
   - Reads body, checks `emailAlreadySent(ptUserId, "autogen_plan_ready_<planId>")` (uses `pt_email_log` via `SUPABASE_SERVICE_ROLE_KEY`).
   - Builds `reviewUrl` from `process.env.NEXT_PUBLIC_APP_URL ?? ""` + `/pt/app/plans/${planId}`.
   - Calls `sendAutogenPlanReadyEmail({ to, clientName, planType, reviewUrl })` (Resend).
   - On success, logs to `pt_email_log`.

3. **Resend** sends the "New plan ready to review" email (subject: "New plan ready to review 📋", preheader: "Milo has generated a draft plan for your client.").

### 2.2 Where it can break

| Issue | Location | Effect |
|-------|----------|--------|
| **APP_URL not set in Supabase** | Edge: `Deno.env.get("APP_URL") ?? ""` | `appUrl` is `""`. Code does `if (appUrl) { await sendPlanReadyEmailToPt(...) }` → email is **never sent**, no error. |
| **AUTOGEN_SECRET mismatch** | Edge sends `x-internal-secret: autogenSecret`; Next.js checks `CRON_SECRET` or `AUTOGEN_SECRET` | If values differ, Next.js returns 401; email not sent. |
| **NEXT_PUBLIC_APP_URL unset (Vercel)** | send-plan-ready: `baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""` | Review link in email is `/pt/app/plans/<id>` (relative); may break in email clients. |
| **RESEND_API_KEY unset (Vercel)** | sendAutogenPlanReadyEmail | Returns `{ error: "RESEND_API_KEY is not set" }`; email not sent. |
| **SUPABASE_SERVICE_ROLE_KEY unset (Vercel)** | emailAlreadySent / logEmailSent in send-plan-ready | getSupabase() throws; route fails before sending. |

### 2.3 Verification checklist

- [ ] **Supabase Edge (pt-autogen-drafts):** `APP_URL` set to the full Next.js app URL (e.g. `https://your-app.vercel.app`).
- [ ] **Supabase Edge (pt-autogen-drafts):** `AUTOGEN_SECRET` set and same value as in Vercel.
- [ ] **Vercel:** `AUTOGEN_SECRET` or `CRON_SECRET` set (for cron and for send-plan-ready auth).
- [ ] **Vercel:** `NEXT_PUBLIC_APP_URL` set (for the review link in the email).
- [ ] **Vercel:** `RESEND_API_KEY` set (for sending the email).
- [ ] **Vercel:** `SUPABASE_SERVICE_ROLE_KEY` set (required for `emailAlreadySent` / `logEmailSent` in send-plan-ready; cron route also uses it for optional reminder/loyalty/due-soon emails).

---

## 3. File reference

| Purpose | File |
|--------|------|
| Cron schedule | `vercel.json` |
| Cron handler | `src/app/api/cron/autogen-drafts/route.ts` |
| Edge autogen + notification + email trigger | `supabase/functions/pt-autogen-drafts/index.ts` |
| Internal email API | `src/app/api/internal/send-plan-ready/route.ts` |
| Send "plan ready" email | `src/lib/email/resend.ts` (`sendAutogenPlanReadyEmail`) |
| Email dedup/log | `src/lib/email/check-and-log.ts` |

---

## 4. Recommended fixes (applied)

1. **Document APP_URL** in Supabase Edge secrets (see `docs/AUTOGEN_DRAFTS_CRON.md` and `docs/audits/SCHEDULING_AUTOGEN_AUDIT.md`).
2. **Edge:** Log a warning when `APP_URL` is missing so deployers see that draft plan emails are disabled.
3. **Comment:** send-plan-ready route comment updated to mention `AUTOGEN_SECRET` (it accepts both CRON_SECRET and AUTOGEN_SECRET).
