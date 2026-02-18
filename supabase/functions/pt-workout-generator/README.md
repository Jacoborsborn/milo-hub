# PT-Workout-Generator Edge Function

AI workout plan generator for PT Hub. Extracted from meal-workout-generator; generates weekly workout plans from `workoutInputs` (camelCase). Returns normalised plan JSON for `public.plans.content_json`. Invoked by the PT Hub process route (job-based: create job → process → save plan).

## Request (camelCase)

**POST** with `Authorization: Bearer <JWT>`.

```json
{
  "workoutInputs": {
    "daysPerWeek": 4,
    "workoutType": "Strength",
    "sessionLengthMin": 45,
    "equipment": "Full Gym",
    "experience": "Intermediate",
    "workoutSplit": "full-body",
    "preset": "neutral",
    "goals": "hypertrophy",
    "coachNotes": "",
    "restrictions": []
  },
  "model": "gpt-4.1-mini"
}
```

| Field | Type | Default |
|-------|------|---------|
| `daysPerWeek` | number | 4 |
| `workoutType` | string or string[] | "Strength" |
| `sessionLengthMin` | number | 45 |
| `equipment` | string | "Full Gym" |
| `experience` | string | "Intermediate" |
| `workoutSplit` | string | "full-body" |
| `preset` / `presetStyle` | string | "neutral" |
| `goals` | string | "hypertrophy" |
| `coachNotes` | string | "" |
| `restrictions` | string[] | [] |
| `model` (body) | string | "gpt-4.1-mini" |

## Response

**200** – success:

```json
{
  "ok": true,
  "plan": { "plan_name", "generated_at", "phases", "weeks": [{ "week", "days": [{ "day_index", "focus", "exercises": [{ "name", "sets", "reps", "rest_sec", "notes" }] }] }], ... }
}
```

**4xx/5xx** – error:

```json
{
  "ok": false,
  "error": { "code": "string", "message": "string", "details": "optional" }
}
```

## Env

- `SUPABASE_URL` – set by Supabase
- `SUPABASE_ANON_KEY` – set by Supabase
- `OPENAI_API_KEY` – required for generation

## How to deploy

1. **Migrations**  
   No new migration required for this function. Job-based flow uses existing `plan_jobs` table.

2. **Deploy function**
   ```bash
   supabase functions deploy pt-workout-generator
   ```
   With env (e.g. local override):
   ```bash
   supabase functions deploy pt-workout-generator --env-file .env.local
   ```

3. **Required secrets**
   - `OPENAI_API_KEY` (set in Supabase dashboard or via `supabase secrets set OPENAI_API_KEY=...`)

4. **Quick manual test**
   - Create a plan job with `workoutInputs` via `POST /api/jobs` (body: `{ "client_id": "<uuid>", "job_type": "workout", "payload": { "workoutInputs": { "daysPerWeek": 3, "workoutType": "Strength" }, "client_name": "Test" } }`).
   - Call `POST /api/jobs/<jobId>/process` with auth.
   - Poll `GET /api/jobs/<jobId>` until `status` is `succeeded` or `failed`.
   - Expect `result_plan_ids` and a plan row in `plans` with `content_json` containing `weeks[].days[].exercises[]`.

   Or use the dev page: **/pt/app/dev/workout-generator-test** (select client, click "Create job & run", wait for polling to finish, then "View plan").
