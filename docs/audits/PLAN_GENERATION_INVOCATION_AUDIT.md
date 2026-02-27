# Plan generation invocation audit

**Issue:** Plan generation appears to loop; Supabase edge function is never invoked (no logs on Supabase).  
**Focus:** Where the edge function is called, URL/auth, polling logic, job creation, and CRON/AUTOGEN secrets.

---

## 1. Where the Supabase edge function is called

The edge function is **only** invoked from the **Next.js API route** (server-side), not from the browser.

### 1.1 Call site (full invoke)

**File:** `src/app/api/jobs/[id]/process/route.ts`

**Template-based workout** (pt-plan-generator):

```ts
const supabase = await supabaseServer();
const { data, error } = await supabase.functions.invoke("pt-plan-generator", {
  body: { template_id: templateId, client_id: clientId, user_id: userId },
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

**AI workout** (pt-workout-generator):

```ts
const supabase = await supabase.functions.invoke("pt-workout-generator", {
  body: { workoutInputs, model: model ?? "gpt-4.1-mini" },
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

**Meal** (via server action, then generator): `assignMealTemplateToClient` → `generateMeal()` → `supabase.functions.invoke("pt-meal-generator", { body: { mealInputs }, headers: { Authorization: \`Bearer ${accessToken}\` } })` in `src/lib/services/generator.ts`.

There is **no direct `fetch()` to a hardcoded URL** for plan generation. All invocations go through the Supabase JS client’s `functions.invoke()`.

### 1.2 Effective URL, headers, and auth

- **URL:** Built by `@supabase/supabase-js` as:
  - `this.functionsUrl = new URL("functions/v1", baseUrl)` with `baseUrl` from the client’s first argument.
  - Client is created with `createServerClient(url, anonKey, ...)` where `url` and `anonKey` come from **env** (see below).
  - So the request URL is: **`${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/<functionName>`**  
  - Examples:  
    - `https://<project>.supabase.co/functions/v1/pt-plan-generator`  
    - `https://<project>.supabase.co/functions/v1/pt-workout-generator`  
    - `https://<project>.supabase.co/functions/v1/pt-meal-generator`
- **Headers:** The client’s `fetch` is `fetchWithAuth(supabaseKey, getAccessToken, ...)`. For each request it:
  - Sets **`apikey`** to the **anon key** (if not already set).
  - Sets **`Authorization: Bearer <token>`** to the result of `getAccessToken()` (or anon key if no session). When the process route passes `headers: { Authorization: \`Bearer ${accessToken}\` }` into `invoke()`, that **overrides** the default and sends the **user’s session `access_token`**.
- **Auth token used for Edge Function:** **User JWT** (`session.access_token` from `supabase.auth.getSession()` in the process route). **SUPABASE_SERVICE_ROLE_KEY is not used** for invoking the plan/meal/workout generators.

**Summary:** URL comes from **env** (`NEXT_PUBLIC_SUPABASE_URL`). No hardcoded edge function URL in this flow. Auth is user session token; anon key is also sent as `apikey` by the client.

---

## 2. Edge function URL: env vs hardcoded

- **Source:** The Supabase server client is created in `src/lib/supabase/server.ts` with `assertSupabaseEnv()`, which reads:
  - `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
- So the edge function base URL is **always** `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://<project>.supabase.co`). It is **not** hardcoded for the plan generation pipeline.
- **Vercel:** Ensure **NEXT_PUBLIC_SUPABASE_URL** and **NEXT_PUBLIC_SUPABASE_ANON_KEY** are set in the Vercel project (Environment Variables). If either is missing, `assertSupabaseEnv()` throws and the process route will fail before any invoke.

---

## 3. SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY

- **Plan generation flow (process route + generator):**
  - Uses **NEXT_PUBLIC_SUPABASE_ANON_KEY** (via `createServerClient(url, anonKey, ...)` in `server.ts`).
  - **SUPABASE_SERVICE_ROLE_KEY** is **not** used for invoking `pt-plan-generator`, `pt-workout-generator`, or `pt-meal-generator`. Those are called with the **user’s session token** in `Authorization`.
- **Where SERVICE_ROLE is used elsewhere:** Share pages, billing webhook, cron, internal send-plan-ready, etc. They are separate from the “Generate plan” → process route → edge function path.
- **Vercel:** For this flow you **must** have **NEXT_PUBLIC_SUPABASE_ANON_KEY** set. **SUPABASE_SERVICE_ROLE_KEY** is not required for the edge function invocation itself (but is required for other features that use the service role client).

---

## 4. Polling / job status loop

**Files:** `src/components/pt/GenerateDrawer.tsx`, `src/components/generation/GenerationCenterButton.tsx`.

### 4.1 How polling runs

- **GenerateDrawer:** When the drawer is open, it polls **GET /api/jobs** every **3 seconds** (`POLL_INTERVAL_MS = 3000`).
- **GenerationCenterButton:** When the panel is open, it polls **GET /api/jobs** every **2s** if there are active jobs (`POLL_MS_ACTIVE = 2000`), else every **3s** (`POLL_MS = 3000`).

```ts
// GenerateDrawer.tsx
useEffect(() => {
  if (!open) return;
  const t = setInterval(fetchJobs, POLL_INTERVAL_MS);
  return () => clearInterval(t);
}, [open, fetchJobs]);
```

### 4.2 When does “completed” stop the loop?

- A job is considered “done” when **status** is **`succeeded`** or **`failed`**.
- **GenerateDrawer** clears “Generating…” when:
  - `job.status === "succeeded" || job.status === "failed"` for the pending job.
- **GenerationCenterButton** only shows jobs with status **`queued`** or **`running`** in the “active” list; when a job becomes **succeeded** or **failed** it drops out of that list.

So **polling continues indefinitely** as long as the job stays **`queued`** or **`running`**. There is **no** max poll count or timeout in code; the loop runs until status becomes terminal.

### 4.3 What can cause “infinite” polling?

- Job stays **`queued`**: process route was never run to completion (e.g. **process route not called**, or returns **401/404** before setting status to `running`), or job creation and process trigger are inconsistent.
- Job stays **`running`**: process route **was** entered and **did** set status to `running`, but then never set `succeeded` or `failed` (e.g. **Vercel function timeout**, **edge invoke never returns**, or **unhandled exception** before `setJobStatus`).

So “looping” with no Supabase logs usually means either:
1. Process route is not receiving a valid session (401), or
2. Process route is never hit (e.g. client fetch problem), or
3. Process route runs but times out or fails before/during `functions.invoke()` so the edge function is never reached or never completes.

---

## 5. CRON_SECRET / AUTOGEN_SECRET

- **CRON_SECRET** and **AUTOGEN_SECRET** are used only for:
  - **`/api/cron/autogen-drafts`** (cron that calls `pt-autogen-drafts` and optional reminder/loyalty flows),
  - **`/api/billing/apply-loyalty-reward`** (when called with Bearer token),
  - **`/api/internal/send-plan-ready`** (internal callback used by `pt-autogen-drafts`).
- They are **not** used in the **Generate Drawer → POST /api/jobs → POST /api/jobs/[id]/process** path. No CRON_SECRET or AUTOGEN_SECRET is passed when invoking **pt-plan-generator**, **pt-workout-generator**, or **pt-meal-generator**.

So for “plan generation from the UI” getting stuck, **CRON_SECRET / AUTOGEN_SECRET are not the cause**. They are only needed for cron and internal callbacks.

---

## 6. plan_jobs row creation and status when stuck

### 6.1 Creation

**File:** `src/lib/services/plan-jobs.ts`

```ts
export async function createPlanJob(payload: Omit<PlanJobInsert, "pt_user_id">): Promise<PlanJob> {
  const pt_user_id = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("plan_jobs")
    .insert({
      pt_user_id,
      client_id: payload.client_id,
      job_type: payload.job_type,
      status: "queued",
      payload: payload.payload ?? {},
    })
    .select()
    .single();
  // ...
}
```

- **Initial status** is always **`queued`**.
- **Who creates the row:** **POST /api/jobs** (single) or **POST /api/jobs/batch** (batch). Both use `createPlanJob()`.

### 6.2 Status transitions (process route)

**File:** `src/app/api/jobs/[id]/process/route.ts`

1. If job not found or status not `queued`/`failed` → return 404/400 (**job stays `queued`** if it was queued).
2. If no session / no `access_token` → return **401** (**job stays `queued`**).
3. Set **`running`**: `await setJobStatus(jobId, "running", { error: undefined });`
4. Then either:
   - **Success:** `setJobStatus(jobId, "succeeded", { result_plan_ids: planIds });`
   - **Failure (catch):** `setJobStatus(jobId, "failed", { error: msg });`
   - If the route is killed (e.g. Vercel timeout) or throws before any of these, **job stays `running`**.

### 6.3 What you’ll see when stuck

- **Stuck at `queued`:** Process route never ran to the point of setting `running`, or returned 401/404. So either the **process request isn’t sent**, **cookies/session missing** on the process request, or **env missing** and route throws before `setJobStatus(jobId, "running", ...)`.
- **Stuck at `running`:** Process route **did** set `running` but never set `succeeded` or `failed`. Typical causes: **Vercel function timeout**, **edge invoke hanging/failing** without the route updating the job, or **unhandled error** after `running` but before the final `setJobStatus`.

---

## 7. Recommended checks (Vercel + Supabase)

1. **Vercel env**
   - **NEXT_PUBLIC_SUPABASE_URL** – must be set and correct (Supabase project URL).
   - **NEXT_PUBLIC_SUPABASE_ANON_KEY** – must be set (used by server client and for `apikey` on edge invokes).
   - Confirm in Vercel → Project → Settings → Environment Variables (and the env you’re running, e.g. Production).

2. **Process route and cookies**
   - The process route is triggered by a **client-side** `fetch(\`/api/jobs/${jobId}/process\`, { method: "POST" })` (no body). By default, same-origin fetch sends cookies. If the app is on a different origin than the API (e.g. custom domain vs `*.vercel.app`), ensure cookies are still sent (e.g. `credentials: "include"` if you use cross-origin).
   - Add **temporary logging** in the process route: log at the very start (e.g. “process route hit”), after `getSession()` (e.g. “has session: yes/no”), and right before `supabase.functions.invoke(...)`. That will show whether the route is reached and whether it fails before invoking.

3. **Vercel function timeout**
   - If the job goes to **`running`** but never completes, the route may be **timing out** (e.g. default 10s on some plans). The edge function can take tens of seconds. Add **`export const maxDuration = 60`** (or higher, per plan) to **`src/app/api/jobs/[id]/process/route.ts`** so the route can wait for the invoke to finish.

4. **Supabase logs**
   - If you see “process route hit” and “has session: yes” in Vercel logs but still no Supabase edge logs, the request from the **Vercel server** to **Supabase** may be failing (network, wrong URL, or Supabase rejecting the request). Check Supabase Dashboard → Edge Functions → Logs and confirm the project URL and anon key match what’s in Vercel.

---

## 8. File reference: flow from trigger to stored plan

| Step | File | What happens |
|------|------|----------------|
| 1 | `src/components/pt/GenerateDrawer.tsx` | User runs single/batch; POST /api/jobs or POST /api/jobs/batch; then `fetch(/api/jobs/${jobId}/process)` (fire-and-forget). |
| 2 | `src/app/api/jobs/route.ts` or `src/app/api/jobs/batch/route.ts` | Creates plan_jobs row(s) with status **queued** via `createPlanJob()`. |
| 3 | `src/lib/services/plan-jobs.ts` | `createPlanJob()` inserts into `plan_jobs` (status `queued`). |
| 4 | `src/app/api/jobs/[id]/process/route.ts` | Gets job, checks session, sets status **running**, then calls `runWorkoutGenerationFromTemplate` / `runWorkoutGenerationFromInputs` or `assignMealTemplateToClient`. |
| 5 | Same file | `supabase.functions.invoke("pt-plan-generator" \| "pt-workout-generator", { body, headers: { Authorization: Bearer <accessToken> } })`. |
| 6 | `src/app/templates/meals/actions.ts` (meal path) | `assignMealTemplateToClient` → `generateMeal()` in `src/lib/services/generator.ts` → `supabase.functions.invoke("pt-meal-generator", ...)`. |
| 7 | `src/lib/supabase/server.ts` | `supabaseServer()` uses `assertSupabaseEnv()` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| 8 | Supabase (Edge) | pt-plan-generator / pt-workout-generator / pt-meal-generator run. |
| 9 | `src/app/api/jobs/[id]/process/route.ts` | On success: `createPlan()` (in `src/lib/services/plans.ts`), then `setJobStatus(jobId, "succeeded", { result_plan_ids })`. On failure: `setJobStatus(jobId, "failed", { error })`. |
| 10 | `src/components/pt/GenerateDrawer.tsx` (polling) | `fetch("/api/jobs")` every 3s; when job status is **succeeded** or **failed**, UI clears “Generating…” / shows result. |

End-to-end: **GenerateDrawer** → **POST /api/jobs** (create job) → **fetch POST /api/jobs/[id]/process** (no await) → **process route** (session, set running, invoke edge, create plan, set succeeded/failed) → **polling GET /api/jobs** until terminal status.
