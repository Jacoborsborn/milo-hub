# Milo Hub — Product Context

**Milo Hub** (brand: **Milo PT Hub** in the app) is a web app for **personal trainers and online coaches** to create, manage, and deliver **meal plans** and **workout plans** for their clients. The goal is to reduce repetitive admin so coaches can focus on coaching instead of rewriting the same plans every week.

---

## What the website is

- A **B2B SaaS** product: trainers sign up, subscribe (trial then paid tiers), and use the app to build and send plans to their clients.
- **Trainer-facing:** The main experience is the PT app at `/pt/app` (dashboard, clients, programs, plans, automation, billing). Clients do not log in; they receive **shareable links** (workout or meal plan views) and optional **emails** with the link.
- **Template + preset driven:** Plans are generated from **templates** (reusable structure) and **client presets** (goals, restrictions, preferences). The app can generate **drafts** (workout and/or meal) on demand or on a **scheduled day** (automation).
- **Review-before-send:** Generated plans are always drafts first. The trainer reviews (and can edit) in the app, then **sends** to the client via share link and/or email. Nothing is auto-sent without approval.

---

## Who it’s for

- **Independent personal trainers** and **online coaches** who write weekly or periodic meal and/or workout plans for multiple clients.
- Users who want to **reuse structure** (templates) and **scale** the number of clients without proportionally scaling admin time.
- Target flow: “Start trial on phone → open on laptop to build plans” (laptop is the primary plan-building experience).

---

## What it can do

### For the trainer (PT)

1. **Sign up & subscribe**
   - Sign up (email/password), optionally from a PT Hub landing page (`/pt-hub`).
   - 3-day free trial; then paid subscription (Starter / Pro / Elite) via Stripe. Billing and subscription management live under **Billing** in the app.

2. **Clients**
   - **Add and manage clients:** name, contact, and **presets** (e.g. goals, dietary preferences, restrictions, equipment). Presets feed into plan generation.
   - **Assign programs:** per client, assign a **workout template** and/or **meal template** (from the Programs/Templates library). Optional **auto-generate** settings (lead days, start date) for client-level automation.

3. **Programs (templates)**
   - **Workout programs:** Create or use built-in workout templates (structure: phases, weekly split, exercises). Stored in `pt_templates`; used by the workout generator.
   - **Meal programs:** Create or use meal templates (defaults: meals per day, days, dietary preference, etc.). Stored in `pt_meal_templates`; used by the meal generator.
   - Templates are reusable; clients get **assignments** that point to a template plus optional overrides.

4. **Plan generation**
   - **On demand:** From the **Generate** flow or from a client’s “Create plan” / “Generate next week” actions. Trainer picks client and (if needed) template; the app generates a **draft** workout and/or meal plan.
   - **Workout plans:** Either template-based (structure from template + client presets) or AI-generated from inputs; result is stored as a plan with `plan_type: 'workout'`.
   - **Meal plans:** Template + client presets merged → meal generator → draft plan (often with grocery sections/totals). Stored as `plan_type: 'meal'`.
   - **Generation Center / jobs:** Some flows create a **plan_jobs** row (queued → running → succeeded/failed) so the trainer can see status and open the resulting plan.

5. **Review plans**
   - **Review Plans** lists plans (e.g. drafts, ready to send). Trainer can open a plan, edit if needed, then **send** to the client.
   - Plans can be marked as sent; share links are generated (signed tokens) so clients can view without logging in.

6. **Automation**
   - **Automation** page: trainer picks a **client**, turns on **Auto-generate Meals** and/or **Auto-generate Workouts**, chooses **templates** and a **day of week** to run.
   - A daily **cron** (e.g. Vercel Cron at 06:00 UTC) runs the autogen pipeline: for each matching assignment, the system generates the next week’s draft(s) and stores them as drafts. Trainer is notified; nothing is sent until they review and send.
   - **Offline scheduling:** If the trainer saves an automation while offline, the payload is queued in IndexedDB and synced when they’re back online.

7. **Dashboard**
   - **Dashboard** shows a high-level overview: active clients, plans this week/month, time-saved estimate, **Drafts Ready** (auto-generated drafts), client cards with status (e.g. no plan, due soon, overdue) and quick actions (create plan, generate next week, view plan).

8. **Sending to clients**
   - **Share link:** Generate a signed link (`/share/plan/<token>` or `/share/meal/<token>`) that clients open in a browser. No login required.
   - **Email:** Optional “send plan” flow that emails the client with the share link and optional message.
   - **Client view:** Read-only plan view (workout or meal, including grocery for meals). Can support features like marking days complete (e.g. plan completions API).

9. **Settings & branding**
   - **Profile** and **Billing** (subscription, cancel, resume).
   - **Settings / Branding:** e.g. logo URL so client-facing share pages can show the trainer’s brand.

10. **Tutorial**
    - **Tutorial** page walks through: access/trial, create client, choose template, assign to client, review plan, send to client. Links to Clients, Programs, Review Plans.

### For the client (end user)

- **No account:** Clients do not sign up or log in.
- **Share link:** They receive a link (from the trainer or via email). Opening it shows the plan (workout or meal) in a clean, often mobile-friendly view.
- **Optional:** Plan completion tracking (e.g. marking days complete) where implemented via share/completions API.

---

## Tech and structure (high level)

- **Stack:** Next.js (App Router), React, Supabase (auth, Postgres, edge functions), Stripe (billing), Resend (or similar) for transactional email.
- **Auth:** Supabase Auth. PT app is protected; share pages are public with signed tokens.
- **Key backend pieces:**
  - **Cron:** `POST /api/cron/autogen-drafts` (secured by `CRON_SECRET` / `AUTOGEN_SECRET`) invokes the `pt-autogen-drafts` edge function daily.
  - **Edge functions:** e.g. `pt-autogen-drafts` (orchestrates daily drafts), `pt-plan-generator` (workout, template-based), `pt-meal-generator` (meal plans), `pt-workout-generator` (AI workout).
  - **APIs:** Jobs (create/process), plans (CRUD, share, send), billing (profile, create-checkout, webhook, sync), share/completions for client-side tracking.
- **Data:** `clients`, `plans`, `program_assignments`, `plan_jobs`, `pt_templates`, `pt_meal_templates`, `profiles`, `pt_notifications`, etc. RLS restricts access by `pt_user_id` / `pt_id`.

---

## Important flows (summary)

| Flow | What happens |
|------|----------------|
| **Signup** | User signs up → trial starts → can open PT Hub on desktop via email link. |
| **Create automation** | Trainer selects client, templates, day → row in `program_assignments` (program_type `combined`). If offline, payload is queued in IndexedDB and synced when online. |
| **Daily autogen** | Cron calls edge function → selects combined assignments whose “generate day” and window match today → generates workout and/or meal draft per assignment → inserts into `plans` (draft, `generated_by: 'auto'`) and can create notifications. |
| **Generate on demand** | Trainer triggers from Generate or client card → job created and processed → workout/meal generator runs → plan created and linked to client. |
| **Send to client** | Trainer clicks send on a plan → share token generated → optional email with link → client opens `/share/plan/<token>` or `/share/meal/<token>`. |

---

## Branding and copy

- **Product name:** Milo Hub (or “Milo PT Hub” in the PT app and landing).
- **Support:** e.g. `support@meetmilo.app` referenced in tutorial and emails.
- **Tagline / value:** “Build client plans in minutes”; “Get your weekend back”; start on phone, build on laptop.

This document is the single high-level context for what the website is, who it’s for, and what it can do. Use it to onboard developers, align features, and keep product and code in sync.
