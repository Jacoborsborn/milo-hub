# Auto-Generate Weekly Drafts — Scheduler

The **pt-autogen-drafts** edge function runs once per day to create one-week draft plans for assignments that have auto-generate enabled.

## How to run it daily

1. **Set secrets**
   - In Supabase: set `AUTOGEN_SECRET` (and optionally `CRON_SECRET` same value) in Edge Function secrets and in your app env.
   - Use a long random string (e.g. `openssl rand -hex 32`).

2. **Call the cron endpoint once per day**
   - **Option A — External cron (e.g. cron job, GitHub Actions, Vercel Cron):**
     - `POST https://your-app-url/api/cron/autogen-drafts`
     - Header: `Authorization: Bearer YOUR_CRON_SECRET`
     - Or body: `{ "secret": "YOUR_CRON_SECRET" }`
   - **Option B — Invoke the edge function directly** (e.g. from Supabase Dashboard or `supabase functions invoke pt-autogen-drafts` with secret in body).

3. **Recommended schedule**
   - Run once per day, e.g. 06:00 UTC. Do not run more than once per day in v1.

## Behaviour

- Finds all `program_assignments` where `auto_generate_enabled = true` and `paused = false` (workout only in v1).
- For each, computes whether “today” is in the generation window (between `next_week_start - autogen_lead_days` and `next_week_start`).
- If a plan for that assignment and week already exists: does not overwrite; if not edited and inputs changed, sets `needs_regen = true`.
- If no plan exists: calls pt-plan-generator (week mode), inserts one plan with `status = 'draft'`, `generated_by = 'auto'`.
- Never auto-sends; PT must review and send from the app.
