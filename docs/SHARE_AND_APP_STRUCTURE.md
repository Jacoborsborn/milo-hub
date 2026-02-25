# Share pages, API routes, and app folder structure

Complete code for share pages and `app/api/share/` routes, plus full `app/` tree. No code changes — reference only.

---

## 1. `app/share/plan/[token]/page.tsx`

```tsx
import { createClient } from "@supabase/supabase-js";
import { verifyShareToken } from "@/lib/plan-share-token";
import { getBrandLogoUrl } from "@/lib/branding";
import SharePageHeader from "@/components/share/SharePageHeader";
import ClientShareView from "./ClientShareView";

type Plan = {
  id: string;
  plan_type: "meal" | "workout";
  pt_user_id?: string;
  content_json: Record<string, unknown>;
  created_at: string;
};

async function getPlanByIdUnsafe(planId: string): Promise<Plan | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[supabase share/plan/[token] getPlanByIdUnsafe] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("plans")
    .select("id, plan_type, pt_user_id, content_json, created_at")
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Plan;
}

async function getProfileForShare(ptUserId: string | undefined): Promise<{ brand_logo_url?: string | null } | null> {
  if (!ptUserId) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[supabase share/plan/[token] getProfileForShare] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data } = await supabase.from("profiles").select("brand_logo_url").eq("id", ptUserId).maybeSingle();
  return data as { brand_logo_url?: string | null } | null;
}

export default async function SharePlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const secret = process.env.PLAN_SHARE_SECRET;
  if (!secret) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-neutral-600">
        Share links are not configured.
      </div>
    );
  }

  const payload = verifyShareToken(token, secret);
  if (!payload) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-neutral-600">
        This link is invalid or has expired.
      </div>
    );
  }

  const plan = await getPlanByIdUnsafe(payload.planId);
  if (!plan) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-neutral-600">
        Plan not found.
      </div>
    );
  }

  const createdDate = new Date(plan.created_at).toLocaleDateString(undefined, {
    dateStyle: "long",
  });
  const planTitle =
    plan.plan_type === "meal" ? "Your Meal Plan" : "Your Workout Plan";
  const profile = await getProfileForShare(plan.pt_user_id);
  const brandLogoUrl = getBrandLogoUrl(profile);

  return (
    <>
      <SharePageHeader brandLogoUrl={brandLogoUrl} />
      <ClientShareView
        plan={plan}
        planTitle={planTitle}
        planType={plan.plan_type}
        createdDate={createdDate}
        shareToken={token}
      />
    </>
  );
}
```

---

## 2. `app/share/meal/[token]/page.tsx`

```tsx
import { createClient } from "@supabase/supabase-js";
import { verifyShareToken } from "@/lib/plan-share-token";
import { getCoachDisplayName } from "@/lib/coach-display-name";
import { getBrandLogoUrl } from "@/lib/branding";
import SharePageHeader from "@/components/share/SharePageHeader";
import PublicMealShareView from "./PublicMealShareView";

type Plan = {
  id: string;
  plan_type: "meal" | "workout";
  pt_user_id?: string;
  content_json: Record<string, unknown>;
  created_at: string;
};

async function getPlanByIdUnsafe(planId: string): Promise<Plan | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[supabase share/meal/[token] getPlanByIdUnsafe] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("plans")
    .select("id, plan_type, pt_user_id, content_json, created_at")
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Plan;
}

type ProfileForShare = { display_name?: string; full_name?: string; name?: string; brand_logo_url?: string | null } | null;

async function getProfileForShare(ptUserId: string | undefined): Promise<ProfileForShare> {
  if (!ptUserId) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[supabase share/meal/[token] getProfileForShare] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data } = await supabase
    .from("profiles")
    .select("display_name, full_name, name, brand_logo_url")
    .eq("id", ptUserId)
    .maybeSingle();
  return data as ProfileForShare;
}

export default async function ShareMealPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const secret = process.env.PLAN_SHARE_SECRET;
  if (!secret) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-neutral-600 text-center">
        Share links are not configured.
      </div>
    );
  }

  const payload = verifyShareToken(token, secret);
  if (!payload) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-neutral-600 text-center">
        This link is invalid or has expired.
      </div>
    );
  }

  const plan = await getPlanByIdUnsafe(payload.planId);
  if (!plan || plan.plan_type !== "meal") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-neutral-600 text-center">
        Plan not found or not a meal plan.
      </div>
    );
  }

  const createdDate = new Date(plan.created_at).toLocaleDateString(undefined, {
    dateStyle: "long",
  });
  const profile = await getProfileForShare(plan.pt_user_id);
  const coachDisplayName = getCoachDisplayName(profile);
  const brandLogoUrl = getBrandLogoUrl(profile);
  const meta = (plan.content_json?.meta as { weekCommencing?: string } | undefined);
  const weekCommencing = meta?.weekCommencing
    ? new Date(meta.weekCommencing).toLocaleDateString(undefined, { dateStyle: "long" })
    : createdDate;

  return (
    <>
      <SharePageHeader brandLogoUrl={brandLogoUrl} />
      <PublicMealShareView
        plan={plan}
        createdDate={createdDate}
        weekCommencing={weekCommencing}
        coachDisplayName={coachDisplayName}
        token={token}
      />
    </>
  );
}
```

---

## 3. `app/api/share/plan-completions/route.ts`

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyShareToken } from "@/lib/plan-share-token";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[supabase api/share/plan-completions getServiceClient] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !key) return null;
  return createClient(url, key);
}

function verifyToken(token: string | null): { planId: string } | NextResponse {
  const secret = process.env.PLAN_SHARE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Share not configured. Set PLAN_SHARE_SECRET in your environment (e.g. Vercel)." },
      { status: 500 }
    );
  }
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const payload = verifyShareToken(token, secret);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }
  return { planId: payload.planId };
}

export type PlanCompletionRow = {
  week_number: number;
  day_index: number;
  completed_at: string;
};

/** GET ?token=... — returns completions for the plan */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const verified = verifyToken(token);
  if (verified instanceof NextResponse) return verified;
  const { planId } = verified;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("plan_completions")
    .select("week_number, day_index, completed_at")
    .eq("plan_id", planId)
    .order("week_number")
    .order("day_index");

  if (error) {
    console.error("[plan-completions GET]", error);
    return NextResponse.json({ error: "Failed to load completions" }, { status: 500 });
  }

  const list = (data ?? []).map((r) => ({
    week_number: r.week_number,
    day_index: r.day_index,
    completed_at: r.completed_at,
  }));
  return NextResponse.json(list);
}

/** POST { token, week_number, day_index, completed } — toggle completion */
export async function POST(request: Request) {
  const secret = process.env.PLAN_SHARE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Share not configured. Set PLAN_SHARE_SECRET in your environment (e.g. Vercel)." },
      { status: 500 }
    );
  }

  let body: { token?: string; week_number?: number; day_index?: number; completed?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, week_number, day_index, completed } = body;
  if (!token || typeof week_number !== "number" || typeof day_index !== "number" || typeof completed !== "boolean") {
    return NextResponse.json({ error: "Missing token, week_number, day_index, or completed" }, { status: 400 });
  }

  const payload = verifyShareToken(token, secret);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }
  const planId = payload.planId;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  if (completed) {
    const { error: upsertError } = await supabase.from("plan_completions").upsert(
      { plan_id: planId, week_number, day_index },
      { onConflict: "plan_id,week_number,day_index" }
    );
    if (upsertError) {
      console.error("[plan-completions POST upsert]", upsertError);
      return NextResponse.json({ error: "Failed to save completion" }, { status: 500 });
    }
  } else {
    const { error: deleteError } = await supabase
      .from("plan_completions")
      .delete()
      .eq("plan_id", planId)
      .eq("week_number", week_number)
      .eq("day_index", day_index);
    if (deleteError) {
      console.error("[plan-completions POST delete]", deleteError);
      return NextResponse.json({ error: "Failed to remove completion" }, { status: 500 });
    }
  }

  const { data } = await supabase
    .from("plan_completions")
    .select("week_number, day_index, completed_at")
    .eq("plan_id", planId)
    .order("week_number")
    .order("day_index");

  const list = (data ?? []).map((r) => ({
    week_number: r.week_number,
    day_index: r.day_index,
    completed_at: r.completed_at,
  }));
  return NextResponse.json(list);
}
```

---

## 4. `app/share/plan/[token]/ClientShareView.tsx`

```tsx
"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import PlanRenderer from "@/components/PlanRenderer";
import MealPlanRenderer from "@/components/MealPlanRenderer";
import PlanTypeBadge from "@/components/PlanTypeBadge";

type Plan = {
  id: string;
  plan_type: "meal" | "workout";
  content_json: Record<string, unknown>;
  created_at: string;
};

function completionKey(week_number: number, day_index: number) {
  return `${week_number}-${day_index}`;
}

export default function ClientShareView({
  plan,
  planTitle,
  planType,
  createdDate,
  shareToken,
}: {
  plan: Plan;
  planTitle: string;
  planType: "meal" | "workout";
  createdDate: string;
  shareToken: string;
}) {
  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
  const [completionError, setCompletionError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    const url = `/api/share/plan-completions?token=${encodeURIComponent(shareToken)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load completions");
        return res.json();
      })
      .then((list: { week_number: number; day_index: number }[]) => {
        const set = new Set(list.map((r) => completionKey(r.week_number, r.day_index)));
        setCompletedDays(set);
      })
      .catch(() => setCompletedDays(new Set()));
  }, [shareToken]);

  const handleToggleDayComplete = useCallback(
    async (week_number: number, day_index: number, completed: boolean) => {
      const key = completionKey(week_number, day_index);
      setCompletionError(null);
      setCompletedDays((prev) => {
        const next = new Set(prev);
        if (completed) next.add(key);
        else next.delete(key);
        return next;
      });
      const res = await fetch("/api/share/plan-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: shareToken,
          week_number,
          day_index,
          completed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCompletedDays((prev) => {
          const next = new Set(prev);
          if (completed) next.delete(key);
          else next.add(key);
          return next;
        });
        setCompletionError(data?.error ?? "Could not save. Please try again.");
      } else {
        setCompletionError(null);
      }
    },
    [shareToken]
  );

  const weeks = (plan.content_json?.weeks as { week?: number }[] | undefined) ?? [];
  const weekNumbers = useMemo(
    () => weeks.map((w, i) => w?.week ?? i + 1),
    [weeks]
  );

  const scrollToWeek = useCallback((weekNum: number) => {
    const el = document.getElementById(`week-${weekNum}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const coachMessage =
    plan.content_json?.meta &&
    typeof plan.content_json.meta === "object" &&
    "coachMessage" in (plan.content_json.meta as object)
      ? (plan.content_json.meta as { coachMessage?: string }).coachMessage
      : undefined;
  const hasCoachMessage =
    typeof coachMessage === "string" && coachMessage.trim().length > 0;

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 shadow-sm safe-area-inset-top">
        <div className="max-w-xl mx-auto px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-neutral-900 truncate">
              {planTitle}
            </h1>
            <PlanTypeBadge planType={planType} />
          </div>
          {planType === "workout" && (
            <div className="flex items-center gap-2">
              <label htmlFor="week-select" className="text-sm font-medium text-neutral-600 shrink-0">
                Jump to:
              </label>
              <select
                id="week-select"
                onChange={(e) => scrollToWeek(Number(e.target.value))}
                className="flex-1 min-w-0 min-h-[44px] text-base rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-400 touch-manipulation"
                aria-label="Select week"
              >
                {weekNumbers.map((num) => (
                  <option key={num} value={num}>
                    Week {num}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-neutral-500">Created: {createdDate}</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 pb-8">
        <div className="break-words overflow-x-hidden flex flex-col gap-6">
          {hasCoachMessage && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-base leading-relaxed text-neutral-900 whitespace-pre-wrap">
                {coachMessage!.trim()}
              </p>
            </div>
          )}
          {completionError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {completionError}
            </div>
          )}
          {planType === "meal" ? (
            <MealPlanRenderer data={plan.content_json} />
          ) : (
            <PlanRenderer
              plan={plan.content_json}
              mode="client"
              completedDayKeys={completedDays}
              onToggleDayComplete={handleToggleDayComplete}
            />
          )}
        </div>
      </main>
    </div>
  );
}
```

---

## 5. `app/share/meal/[token]/PublicMealShareView.tsx`

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import MealPlanRenderer from "@/components/MealPlanRenderer";

type Plan = {
  id: string;
  plan_type: string;
  content_json: Record<string, unknown>;
  created_at: string;
};

export default function PublicMealShareView({
  plan,
  createdDate,
  weekCommencing,
  coachDisplayName,
  token,
}: {
  plan: Plan;
  createdDate: string;
  weekCommencing: string;
  coachDisplayName: string;
  token: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      window.print();
    }
  }, []);

  const content = plan.content_json as {
    dailyCaloriesTarget?: number;
    days?: {
      totalCalories?: number;
      meals?: {
        macrosPerPortion?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
        ingredientsPerPortion?: { foodId?: string }[];
      }[];
    }[];
    meta?: { mealInputs?: { budgetTier?: string } };
  };
  const dailyCaloriesTarget =
    typeof content.dailyCaloriesTarget === "number" && content.dailyCaloriesTarget > 0
      ? content.dailyCaloriesTarget
      : null;
  const days = content.days ?? [];
  const dayTotals = days.map((d) => ({
    kcal: d.totalCalories ?? (d.meals ?? []).reduce((s, m) => s + (m.macrosPerPortion?.calories ?? 0), 0),
  }));
  const alignmentScore = (actual: number, target: number) =>
    target <= 0 ? null : Math.max(0, Math.min(100, 100 - (Math.abs(actual - target) / target) * 100));
  const calorieAlignments =
    dailyCaloriesTarget != null && dayTotals.length > 0
      ? dayTotals
          .map((d) => (d.kcal > 0 ? alignmentScore(d.kcal, dailyCaloriesTarget) : null))
          .filter((x): x is number => x != null)
      : [];
  const calorieAlignmentPercent =
    calorieAlignments.length > 0
      ? Math.round(calorieAlignments.reduce((a, b) => a + b, 0) / calorieAlignments.length)
      : null;
  const budgetTier = content.meta?.mealInputs?.budgetTier;
  const budgetFitVisible = !!budgetTier && budgetTier !== "—";

  const sharedIngredientCount = (() => {
    const mealToFoodIds = new Map<string, Set<string>>();
    let mealKey = 0;
    for (const day of days) {
      for (const meal of day.meals ?? []) {
        const ids = new Set<string>();
        for (const ing of meal.ingredientsPerPortion ?? []) {
          const id = (ing.foodId ?? "").trim();
          if (id) ids.add(id);
        }
        if (ids.size > 0) mealToFoodIds.set(String(mealKey++), ids);
      }
    }
    const foodIdToMealCount = new Map<string, number>();
    for (const ids of mealToFoodIds.values()) {
      for (const id of ids) foodIdToMealCount.set(id, (foodIdToMealCount.get(id) ?? 0) + 1);
    }
    let shared = 0;
    for (const count of foodIdToMealCount.values()) if (count > 1) shared++;
    return shared;
  })();
  const systemStatusMacroAligned = calorieAlignmentPercent != null && calorieAlignmentPercent >= 90;
  const systemStatusBudgetOptimised = budgetFitVisible;
  const systemStatusOverlapMinimised = sharedIngredientCount > 2;
  const hasAnySystemStatus = systemStatusMacroAligned || systemStatusBudgetOptimised || systemStatusOverlapMinimised;

  return (
    <div className="min-h-screen bg-white print:bg-white">
      <header className="sticky top-0 z-10 bg-white border-b border-neutral-200 print:border-neutral-300 safe-area-inset-top">
        <div className="max-w-xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-neutral-900">Your Meal Plan</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Week commencing: {weekCommencing}</p>
          <p className="text-sm text-neutral-500">Prepared by: {coachDisplayName}</p>
          {(calorieAlignmentPercent != null || budgetFitVisible) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 mt-2">
              {calorieAlignmentPercent != null && (
                <span title="Alignment compares planned totals vs targets.">
                  Calorie alignment: {calorieAlignmentPercent}%
                </span>
              )}
              {budgetFitVisible && <span>Budget fit: On target</span>}
            </div>
          )}
          {hasAnySystemStatus && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 mt-2 pt-2 border-t border-neutral-100">
              <span className="font-medium text-neutral-500">System status:</span>
              {systemStatusMacroAligned && <span>✔ Macro aligned</span>}
              {systemStatusBudgetOptimised && <span>✔ Budget optimised</span>}
              {systemStatusOverlapMinimised && <span>✔ Ingredient overlap minimised</span>}
            </div>
          )}
        </div>
        <div className="max-w-xl mx-auto px-4 py-2 border-t border-neutral-100 flex flex-wrap items-center gap-2 bg-neutral-50/80">
          <Link
            href={`/share/meal/${token}`}
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-neutral-200 text-neutral-800"
          >
            Meals
          </Link>
          <Link
            href={`/share/meal/${token}/shopping`}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            Shopping
          </Link>
          <span className="px-3 py-1.5 rounded-md text-sm font-medium text-neutral-400">Overview</span>
          <Link
            href={`/share/meal/${token}#top`}
            className="ml-auto text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main id="top" className="max-w-xl mx-auto px-4 py-6 pb-10 print:py-6 print:pb-6">
        <div className="text-base" style={{ fontSize: "14px" }}>
          <MealPlanRenderer
            data={plan.content_json}
            hideGrocery
            shareToken={token}
          />
        </div>
      </main>
    </div>
  );
}
```

---

## 6. Full `app/` folder structure (tree)

Paths are relative to `src/app/` (i.e. the Next.js `app` directory).

```
app/
├── globals.css
├── layout.tsx
├── (marketing)/
│   ├── layout.tsx
│   ├── page.tsx
│   └── demo/
│       └── page.tsx
├── api/
│   ├── auth/
│   │   ├── login/          (no route file in login dir)
│   │   ├── reset/
│   │   │   ├── send/route.ts
│   │   │   └── verify/route.ts
│   │   ├── send-otp/route.ts
│   │   ├── signup/         (dir)
│   │   └── verify-otp/route.ts
│   ├── billing/
│   │   ├── apply-exit-offer/route.ts
│   │   ├── apply-loyalty-reward/route.ts
│   │   ├── cancel/route.ts
│   │   ├── cancellation-feedback/route.ts
│   │   ├── create-checkout/route.ts
│   │   ├── exit-offer-50/route.ts
│   │   ├── profile/route.ts
│   │   ├── resume/route.ts
│   │   ├── sync/route.ts
│   │   ├── sync-session/route.ts
│   │   └── webhook/route.ts
│   ├── clients/recent/route.ts
│   ├── cron/autogen-drafts/route.ts
│   ├── dashboard/summary/route.ts
│   ├── dev/send-trial-email/route.ts
│   ├── generate-context/route.ts
│   ├── internal/send-plan-ready/route.ts
│   ├── jobs/
│   │   ├── route.ts
│   │   ├── batch/route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       └── process/route.ts
│   ├── notifications/
│   │   ├── route.ts
│   │   ├── count/route.ts
│   │   ├── mark-all-read/route.ts
│   │   └── [id]/route.ts
│   ├── plans/
│   │   ├── send/route.ts
│   │   └── [planId]/
│   │       ├── route.ts
│   │       └── share/route.ts
│   ├── pt/
│   │   ├── login/route.ts
│   │   └── upload-logo/route.ts
│   ├── share/
│   │   └── plan-completions/route.ts
│   └── stripe/checkout/route.ts
├── auth/signup/page.tsx
├── plans/review/
│   ├── actions.ts
│   └── page.tsx
├── privacy/page.tsx
├── profile/page.tsx
├── pt/
│   ├── page.tsx
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── automation/page.tsx
│   │   ├── billing/page.tsx
│   │   ├── clients/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   │   ├── actions.ts
│   │   │   │   └── page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── edit/
│   │   │       │   ├── actions.ts
│   │   │       │   └── page.tsx
│   │   │       └── meals/
│   │   │           ├── new/
│   │   │           │   └── page.tsx
│   │   │           └── review/page.tsx
│   │   ├── dev/
│   │   │   ├── meal-templates-test/page.tsx
│   │   │   └── workout-generator-test/page.tsx
│   │   ├── generate/page.tsx
│   │   ├── plans/[planId]/
│   │   │   ├── page.tsx
│   │   │   ├── print/page.tsx
│   │   │   └── shopping/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── review-plans/page.tsx
│   │   ├── settings/branding/page.tsx
│   │   ├── templates/       (referenced by layout)
│   │   ├── terms/page.tsx
│   │   └── tutorial/page.tsx
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── logout/route.ts
│   │   ├── reset/
│   │   │   ├── page.tsx
│   │   │   └── verify/
│   │   │       ├── page.tsx
│   │   │       └── ResetVerifyClient.tsx
│   │   └── signup/page.tsx
│   └── login/page.tsx
├── pt-hub/
│   ├── page.tsx
│   └── success/
│       ├── page.tsx
│       └── PtHubSuccessClient.tsx
├── share/
│   ├── meal/[token]/
│   │   ├── page.tsx
│   │   ├── PublicMealShareView.tsx
│   │   ├── full/page.tsx
│   │   ├── full/PublicMealFullView.tsx
│   │   ├── shopping/page.tsx
│   │   └── shopping/PublicMealShoppingView.tsx
│   └── plan/[token]/
│       ├── page.tsx
│       └── ClientShareView.tsx
├── signup/page.tsx
├── templates/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── CreateProgramModal.tsx
│   ├── create/page.tsx
│   ├── meals/
│   │   ├── actions.ts
│   │   ├── page.tsx
│   │   └── TemplatesMealsContent.tsx
│   └── [templateId]/
│       ├── assign/
│       │   ├── actions.ts
│       │   └── page.tsx
│       ├── edit/page.tsx
│       └── review/page.tsx
└── terms/page.tsx
```

Note: In this repo the `app` directory lives at `src/app/`. The tree above is the structure under that folder. Route segments in square brackets (e.g. `[token]`, `[planId]`, `[id]`) are dynamic.
