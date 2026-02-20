# Supabase client audit – env vars and client creation

## Summary

Every place that creates a Supabase client has been audited. A temporary `console.log` was added in each file that logs the **URL** variable (or `"undefined"`) so you can see in Vercel logs which path runs and whether the URL is set.

---

## 1. Central Supabase lib (used by most app code)

| File | Env vars used | Client type | NEXT_PUBLIC_? | Log label |
|------|----------------|-------------|---------------|-----------|
| `src/lib/supabase/env.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (no client; returns env for others) | **Both must be NEXT_PUBLIC_** (so server + browser can read them) | `[supabase env.ts getSupabaseEnv]` |
| `src/lib/supabase/server.ts` | Via `assertSupabaseEnv()` → same as above | **Server** (createServerClient) | Same | `[supabase server.ts supabaseServer]` |
| `src/lib/supabase/browser.ts` | Via `getSupabaseEnv()` → same as above | **Browser** (createBrowserClient) | Same | `[supabase browser.ts getSupabaseClient]` |
| `src/lib/supabase/middleware.ts` | Via `getSupabaseEnv()` → same as above | **Server** (middleware; createServerClient) | Same | `[supabase middleware.ts updateSession]` |

**Note:** The error *"Your project's URL and Key are required to create a Supabase client"* comes from the Supabase SDK when `createClient`/`createServerClient`/`createBrowserClient` is called with `undefined` for url or key. That can happen if env is missing at **runtime** (e.g. Vercel not exposing them to the Node runtime).

---

## 2. API routes and server-only code that create a client

| File | Env vars used | Client type | NEXT_PUBLIC_? | Log label |
|------|----------------|-------------|---------------|-----------|
| `src/app/api/billing/webhook/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Server** (createClient with service role) | URL: **NEXT_PUBLIC_**. Key: **must NOT** be NEXT_PUBLIC (secret) | `[supabase billing/webhook getSupabaseAdmin]` |
| `src/app/api/billing/sync/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Server** | Same | `[supabase billing/sync]` |
| `src/app/api/billing/sync-session/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Server** | Same | `[supabase billing/sync-session]` |
| `src/app/pt/login/page.tsx` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Server** (createServerClient) | **Both NEXT_PUBLIC_** | `[supabase pt/login page createSupabaseServerClient]` |
| `src/app/api/auth/reset/send/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Server** | **Both NEXT_PUBLIC_** | `[supabase api/auth/reset/send supa]` |
| `src/app/api/auth/reset/verify/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Server** | **Both NEXT_PUBLIC_** | `[supabase api/auth/reset/verify supa]` |
| `src/app/api/auth/send-otp/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Server** | **Both NEXT_PUBLIC_** | `[supabase api/auth/send-otp]` |
| `src/app/api/auth/verify-otp/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Server** | **Both NEXT_PUBLIC_** | `[supabase api/auth/verify-otp]` |
| `src/app/pt/auth/logout/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Server** | **Both NEXT_PUBLIC_** | `[supabase pt/auth/logout]` |
| `src/app/api/cron/autogen-drafts/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Server** (fetch to Edge Function, not createClient) | **Both NEXT_PUBLIC_** | `[supabase api/cron/autogen-drafts]` |
| `src/app/api/plans/[planId]/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Server** (createClient service role) | URL: **NEXT_PUBLIC_**. Key: **must NOT** | `[supabase api/plans/[planId] getCompletionsForPlan]` |
| `src/app/api/share/plan-completions/route.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Server** | Same | `[supabase api/share/plan-completions getServiceClient]` |

---

## 3. Share pages (server components, createClient with service role)

| File | Env vars used | Client type | NEXT_PUBLIC_? | Log label |
|------|----------------|-------------|---------------|-----------|
| `src/app/share/plan/[token]/page.tsx` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Server** | URL: **NEXT_PUBLIC_**. Key: **must NOT** | `[supabase share/plan/[token] getPlanByIdUnsafe]`, `getProfileForShare` |
| `src/app/share/meal/[token]/page.tsx` | Same | **Server** | Same | `[supabase share/meal/[token] getPlanByIdUnsafe]`, `getProfileForShare` |
| `src/app/share/meal/[token]/full/page.tsx` | Same | **Server** | Same | `[supabase share/meal/[token]/full getPlanByIdUnsafe]`, `getProfileForShare` |
| `src/app/share/meal/[token]/shopping/page.tsx` | Same | **Server** | Same | `[supabase share/meal/[token]/shopping getPlanByIdUnsafe]`, `getProfileForShare` |

---

## 4. Code that uses `supabaseServer()` (no direct env in file)

These files do **not** read `process.env` themselves; they call `supabaseServer()` from `@/lib/supabase/server`, which uses `assertSupabaseEnv()` and thus **`NEXT_PUBLIC_SUPABASE_URL`** and **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**. No extra log in these files; the log in `server.ts` covers them.

- `src/app/pt/auth/login/page.tsx`
- `src/app/pt/app/tutorial/page.tsx`
- `src/app/api/billing/create-checkout/route.ts`
- `src/app/api/billing/exit-offer-50/route.ts`
- `src/app/api/billing/apply-exit-offer/route.ts`
- `src/app/api/stripe/checkout/route.ts`
- `src/app/api/notifications/*.ts`
- `src/app/api/billing/resume/route.ts`
- `src/app/api/billing/cancel/route.ts`
- `src/app/api/billing/cancellation-feedback/route.ts`
- `src/app/api/billing/profile/route.ts`
- `src/app/api/jobs/[id]/process/route.ts`
- `src/app/api/plans/send/route.ts`
- `src/app/api/pt/upload-logo/route.ts`
- `src/app/api/clients/recent/route.ts`
- `src/app/api/plans/[planId]/share/route.ts`
- `src/app/pt/app/profile/page.tsx`
- `src/app/pt/app/page.tsx`
- `src/lib/services/*` (program-assignments, plans, subscription, generator, plan-jobs, ptTemplatesServer, clients, meal-templates)

---

## 5. Browser-only usage (no Supabase client created in repo)

| File | Env vars used | Context | NEXT_PUBLIC_? |
|------|----------------|--------|---------------|
| `src/app/templates/CreateProgramModal.tsx` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Browser** (fetch to Edge Function) | **Both must be NEXT_PUBLIC_** (inlined at build) |
| `src/app/templates/create/page.tsx` | Same | **Server** (fetch) | Same |

---

## NEXT_PUBLIC_ rules

- **`NEXT_PUBLIC_SUPABASE_URL`** – **Must be NEXT_PUBLIC**. Used on server and (for CreateProgramModal / browser client) in the browser. Next inlines `NEXT_PUBLIC_*` at build time; without the prefix it would be undefined in the client bundle.
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** – **Must be NEXT_PUBLIC** for the same reason where the anon key is used (server auth, browser client, middleware). The anon key is safe to expose; RLS protects data.
- **`SUPABASE_SERVICE_ROLE_KEY`** – **Must NOT be NEXT_PUBLIC**. Server-only secret; never expose to the browser.

---

## Vercel checklist – environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for the environments you use (Production, Preview, Development):

| Variable | Required | NEXT_PUBLIC? | Notes |
|----------|----------|--------------|--------|
| **NEXT_PUBLIC_SUPABASE_URL** | Yes | Yes | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Yes | Yes | Supabase anon/public key from Project Settings → API |
| **SUPABASE_SERVICE_ROLE_KEY** | Yes (for webhook, sync, sync-session, share pages, plan completions) | No | Service role key from Project Settings → API (bypasses RLS) |

After adding or changing env vars in Vercel, **redeploy** (or trigger a new deployment). Env vars are baked in at build time for `NEXT_PUBLIC_*` and available at runtime for server-only vars.

---

## Using the temporary logs

After deploy, reproduce the error or hit the failing route. In **Vercel → Project → Logs** (or Runtime Logs), search for `[supabase` to see which file ran and whether the URL was `undefined`. That shows which code path is executing and confirms if the env var is missing or not exposed to that runtime.

Remove the `console.log` lines once you’ve verified production.
