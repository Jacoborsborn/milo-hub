"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import PlanRenderer, { type OnExerciseChange } from "@/components/PlanRenderer";
import MealPlanRenderer from "@/components/MealPlanRenderer";
import MealPlanHeader from "@/components/meals/MealPlanHeader";
import PlanTypeBadge from "@/components/PlanTypeBadge";
import Breadcrumbs from "@/components/pt/Breadcrumbs";
import PlanContextualBar from "@/components/pt/plan/PlanContextualBar";
import PlanTabs from "@/components/pt/plan/PlanTabs";
import { supabaseBrowser } from "@/lib/supabase/client";
import { updatePlanContent } from "@/lib/services/plans";

interface Plan {
  id: string;
  pt_user_id: string;
  client_id: string;
  plan_type: "meal" | "workout";
  content_json: Record<string, unknown>;
  created_at: string;
  completions?: { week_number: number; day_index: number; completed_at: string }[];
  client_name?: string | null;
  coach_display_name?: string | null;
}

type WeekCompletionStat = {
  totalDays: number;
  completedCount: number;
  completionPercent: number;
};

function computeWeekCompletionStats(
  contentJson: Record<string, unknown>,
  completions: { week_number: number; day_index: number }[]
): WeekCompletionStat[] {
  const weeks = (contentJson?.weeks as { week?: number; days?: unknown[] }[] | undefined) ?? [];
  return weeks.map((w, wIdx) => {
    const totalDays = w.days?.length ?? 0;
    const weekNum = w.week ?? wIdx + 1;
    const completedCount = completions.filter((c) => c.week_number === weekNum).length;
    const completionPercent =
      totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
    return { totalDays, completedCount, completionPercent };
  });
}

function deepCopy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [shareError, setShareError] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContentJson, setEditedContentJson] = useState<Record<string, unknown> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [weekCommencingPickerOpen, setWeekCommencingPickerOpen] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setPlanId(p.planId);
      fetch(`/api/plans/${p.planId}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("Failed to load plan");
          }
          return res.json();
        })
        .then((data) => {
          setPlan(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load plan");
          setLoading(false);
        });
    });
  }, [params]);

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }: { data: { user?: { id?: string } | null } }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const handleCopy = async () => {
    if (!plan) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(plan.content_json, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleShareLink = async () => {
    if (!plan) return;
    setShareStatus("loading");
    setShareError(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}/share`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create share link");
      }
      const { url } = await res.json();
      const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
      await navigator.clipboard.writeText(fullUrl);
      setShareStatus("success");
      setTimeout(() => setShareStatus("idle"), 3000);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to create share link");
      setShareStatus("error");
    }
  };

  const handleExportPdf = async (path: "meals" | "shopping" | "full") => {
    if (!plan) return;
    setShareStatus("loading");
    setShareError(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}/share`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create share link");
      }
      const { url } = await res.json();
      const exportPath = path === "meals" ? url : path === "shopping" ? `${url}/shopping` : `${url}/full`;
      const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${exportPath}?print=1` : exportPath;
      window.open(fullUrl, "_blank", "noopener,noreferrer");
      setShareStatus("idle");
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to create export link");
      setShareStatus("error");
    }
  };

  const handleEditToggle = useCallback(() => {
    if (editMode) {
      setEditMode(false);
      setEditedContentJson(null);
      setSaveStatus("idle");
      setSaveError(null);
    } else {
      setEditMode(true);
      setEditedContentJson(plan ? deepCopy(plan.content_json) : null);
    }
  }, [editMode, plan]);

  const handleCoachMessageChange = useCallback((value: string) => {
    setEditedContentJson((prev) => {
      const next = deepCopy(prev ?? {});
      if (!next.meta || typeof next.meta !== "object") next.meta = {};
      (next.meta as Record<string, unknown>).coachMessage =
        value === "" ? undefined : value;
      return next;
    });
  }, []);

  const handleExerciseChange: OnExerciseChange = useCallback((weekIdx, dayIdx, exIdx, updates) => {
    setEditedContentJson((prev) => {
      type ContentWithWeeks = { weeks?: { days?: { exercises?: unknown[] }[] }[] };
      const p = prev as ContentWithWeeks | null;
      if (!p?.weeks?.[weekIdx]?.days?.[dayIdx]?.exercises) return prev;
      const next = deepCopy(prev) as ContentWithWeeks;
      const ex = next.weeks?.[weekIdx]?.days?.[dayIdx]?.exercises?.[exIdx] as Record<string, unknown> | undefined;
      if (ex && typeof ex === "object" && !Array.isArray(ex)) {
        if (updates.name !== undefined) ex.name = updates.name;
        if (updates.sets !== undefined) ex.sets = updates.sets;
        if (updates.reps !== undefined) ex.reps = updates.reps;
        if (updates.rest_sec !== undefined) ex.rest_sec = updates.rest_sec;
        if (updates.notes !== undefined) ex.notes = updates.notes;
      }
      return next;
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditedContentJson(plan ? deepCopy(plan.content_json) : null);
    setSaveStatus("idle");
    setSaveError(null);
  }, [plan]);

  const handleSave = useCallback(async () => {
    if (!planId || !editedContentJson || saveStatus === "saving") return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const updated = await updatePlanContent(planId, editedContentJson);
      setPlan((prev) => (prev ? { ...prev, content_json: updated.content_json as Record<string, unknown> } : null));
      setEditMode(false);
      setEditedContentJson(null);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Failed to save changes");
    }
  }, [planId, editedContentJson, saveStatus]);

  const weekCompletionStats = useMemo((): WeekCompletionStat[] => {
    if (!plan?.content_json || !plan.completions) return [];
    return computeWeekCompletionStats(plan.content_json, plan.completions);
  }, [plan?.content_json, plan?.completions]);

  const handleMealPlanSave = useCallback(
    async (updatedContent: Record<string, unknown>) => {
      if (!planId || !plan) return;
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const contentJson = { ...plan.content_json, ...updatedContent };
        const updated = await updatePlanContent(planId, contentJson);
        setPlan((prev) => (prev ? { ...prev, content_json: updated.content_json as Record<string, unknown> } : null));
        setEditMode(false);
        setEditedContentJson(null);
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } catch (err) {
        setSaveStatus("error");
        setSaveError(err instanceof Error ? err.message : "Failed to save changes");
      }
    },
    [planId, plan]
  );

  const handleWeekCommencingChange = useCallback(
    async (isoDate: string) => {
      if (!planId || !plan) return;
      setWeekCommencingPickerOpen(false);
      const nextContent = {
        ...plan.content_json,
        meta: { ...(typeof plan.content_json?.meta === "object" && plan.content_json.meta != null ? plan.content_json.meta : {}), weekCommencing: isoDate },
      };
      try {
        const updated = await updatePlanContent(planId, nextContent);
        setPlan((p) => (p ? { ...p, content_json: updated.content_json as Record<string, unknown> } : null));
      } catch {
        // ignore
      }
    },
    [planId, plan]
  );

  if (loading) {
    return (
      <div style={{ padding: "0 0 24px" }}>
        <p>Loading plan...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div style={{ padding: "0 0 24px" }}>
        <p style={{ color: "#c00" }}>{error || "Plan not found"}</p>
        <Link href="/pt/app/clients" style={{ color: "#0070f3", textDecoration: "none" }}>
          ← Back to Clients
        </Link>
      </div>
    );
  }

  if (currentUserId != null && plan.pt_user_id !== currentUserId) {
    return (
      <div style={{ padding: "0 0 24px" }}>
        <p style={{ color: "#666" }}>You don’t have access to this plan.</p>
        <Link href="/pt/app/clients" style={{ color: "#0070f3", textDecoration: "none" }}>
          ← Back to Clients
        </Link>
      </div>
    );
  }

  const coachMessage =
    editedContentJson?.meta &&
    typeof editedContentJson.meta === "object" &&
    "coachMessage" in editedContentJson.meta
      ? (editedContentJson.meta as { coachMessage?: string }).coachMessage ?? ""
      : plan.content_json?.meta &&
          typeof plan.content_json.meta === "object" &&
          "coachMessage" in (plan.content_json.meta as object)
        ? (plan.content_json.meta as { coachMessage?: string }).coachMessage ?? ""
        : "";

  const planCreatedLabel = new Date(plan.created_at).toLocaleDateString(undefined, { dateStyle: "medium" });
  const clientLabel = plan.client_name || "Client";
  const isMealPlan = plan.plan_type === "meal";

  const mealContent = (editMode ? editedContentJson ?? plan.content_json : plan.content_json) as Record<string, unknown>;
  const dailyCaloriesTarget = (mealContent.dailyCaloriesTarget as number) ?? (mealContent as { dailyCaloriesTarget?: number }).dailyCaloriesTarget;
  const groceryTotals = (mealContent.groceryTotals as { totalPriceGBP?: number; estimatedTotalWeek?: number }) ?? {};
  const weeklySpend = groceryTotals.totalPriceGBP ?? groceryTotals.estimatedTotalWeek ?? 0;
  const mealInputs = (mealContent.meta as { mealInputs?: { budgetTier?: string } } | undefined)?.mealInputs ?? (mealContent.mealInputs as { budgetTier?: string } | undefined);
  const budgetTier = mealInputs?.budgetTier ?? "—";
  const days = (mealContent.days as { totalCalories?: number; meals?: { macrosPerPortion?: { protein_g?: number } }[] }[] | undefined) ?? [];
  const avgProtein = days.length > 0
    ? Math.round(
        days.reduce((sum, d) => {
          const dayProtein = (d.meals ?? []).reduce(
            (s, m) => s + (m.macrosPerPortion?.protein_g ?? 0),
            0
          );
          return sum + dayProtein;
        }, 0) / days.length
      )
    : null;

  const mealMeta = (mealContent.meta as { weekCommencing?: string } | undefined);
  const weekCommencingIso = mealMeta?.weekCommencing ?? plan.created_at;
  const weekCommencingLabel = new Date(weekCommencingIso).toLocaleDateString(undefined, { dateStyle: "medium" });
  const coachName = plan.coach_display_name ?? "Your coach";

  type Macros = { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
  const dayTotalsForSignals = days.map((d) => {
    const macros = (m: { macrosPerPortion?: unknown }) => (m.macrosPerPortion as Macros | undefined);
    return {
      kcal: d.totalCalories ?? (d.meals ?? []).reduce((s, m) => s + (macros(m)?.calories ?? 0), 0),
      p: (d.meals ?? []).reduce((s, m) => s + (macros(m)?.protein_g ?? 0), 0),
      c: (d.meals ?? []).reduce((s, m) => s + (macros(m)?.carbs_g ?? 0), 0),
      f: (d.meals ?? []).reduce((s, m) => s + (macros(m)?.fat_g ?? 0), 0),
    };
  });
  const targetKcal = typeof dailyCaloriesTarget === "number" && dailyCaloriesTarget > 0 ? dailyCaloriesTarget : null;
  const alignmentScore = (actual: number, target: number) =>
    target <= 0 ? null : Math.max(0, Math.min(100, 100 - (Math.abs(actual - target) / target) * 100));
  const calorieAlignments =
    targetKcal != null && dayTotalsForSignals.length > 0
      ? dayTotalsForSignals
          .map((d) => (d.kcal > 0 ? alignmentScore(d.kcal, targetKcal) : null))
          .filter((x): x is number => x != null)
      : [];
  const calorieAlignmentPercent =
    calorieAlignments.length > 0
      ? Math.round(calorieAlignments.reduce((a, b) => a + b, 0) / calorieAlignments.length)
      : null;
  const budgetFitVisible = budgetTier != null && budgetTier !== "—" && String(budgetTier).length > 0;
  const grocerySections = (mealContent?.grocerySections as unknown[] | undefined) ?? [];
  const shoppingSectionCount = grocerySections.length;
  const mealPlanTitle = `Meal Plan – ${new Date(weekCommencingIso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

  /** Count ingredients that appear in more than one meal; if > 2, show "Ingredient overlap minimised". */
  const sharedIngredientCount = (() => {
    const daysWithMeals = days as { meals?: { ingredientsPerPortion?: { foodId?: string }[] }[] }[];
    const mealToFoodIds = new Map<string, Set<string>>();
    let mealKey = 0;
    for (const day of daysWithMeals) {
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

  if (isMealPlan) {
    return (
      <div
        className="pb-36 md:pb-6 max-w-[1000px]"
        style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0 }}
      >
        <Breadcrumbs
          items={[
            { label: "Clients", href: "/pt/app/clients" },
            { label: clientLabel, href: `/pt/app/clients/${plan.client_id}` },
            { label: "Meal Plan" },
          ]}
        />

        <MealPlanHeader
          clientLabel={clientLabel}
          weekCommencingLabel={weekCommencingLabel}
          weekCommencingIso={weekCommencingIso}
          onWeekCommencingChange={handleWeekCommencingChange}
          dailyCaloriesTarget={dailyCaloriesTarget}
          avgProtein={avgProtein}
          budgetTier={budgetTier}
          weeklySpend={typeof weeklySpend === "number" ? weeklySpend : 0}
          calorieAlignmentPercent={calorieAlignmentPercent}
          systemStatusMacroAligned={systemStatusMacroAligned}
          systemStatusOverlapMinimised={systemStatusOverlapMinimised}
          coachName={coachName}
        />

        {/* Contextual top plan bar + tabs (sticky workspace) */}
        <div className="sticky top-0 z-20 -mx-0 mb-4 bg-white border-b border-neutral-200 shadow-sm rounded-b-lg">
          <PlanContextualBar
            clientId={plan.client_id}
            clientName={clientLabel}
            planId={plan.id}
            planType="meal"
            planTitle={mealPlanTitle}
            editMode={editMode}
            onEditClick={() => setEditMode((e) => !e)}
            shareStatus={shareStatus}
            onShareClick={handleShareLink}
            exportOpen={exportOpen}
            onExportToggle={() => setExportOpen((o) => !o)}
            onExportPdf={handleExportPdf}
            showExportOptions
          />
          <PlanTabs
            planId={plan.id}
            activeTab="meals"
            mealCount={days.length}
            shoppingSectionCount={shoppingSectionCount}
          />
        </div>

        {saveStatus === "error" && saveError && (
          <p className="text-red-600 text-sm mb-2">{saveError}</p>
        )}
        {!editMode && shareStatus === "error" && shareError && (
          <p className="text-red-600 text-sm mb-2">{shareError}</p>
        )}
        <div>
          <MealPlanRenderer
            data={mealContent as any}
            editMode={editMode}
            onSave={handleMealPlanSave}
            saving={saveStatus === "saving"}
            hideGrocery
            planId={plan.id}
          />
        </div>
        <div className="fixed left-0 right-0 z-50 flex md:hidden" style={{ bottom: "4rem" }}>
          <Link
            href={`/pt/app/clients/${plan.client_id}`}
            className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 font-medium text-sm border-t border-black/10"
          >
            ← Back to Client
          </Link>
        </div>
      </div>
    );
  }

  const workoutPlanTitle = `Workout Plan – ${planCreatedLabel}`;

  return (
    <div
      className="pb-36 md:pb-6 max-w-[1000px]"
      style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0 }}
    >
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/pt/app/clients" },
          { label: clientLabel, href: `/pt/app/clients/${plan.client_id}` },
          { label: "Workout Plan" },
        ]}
      />

      {/* Plan header */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-100 overflow-hidden mb-4" data-plan-authority>
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-neutral-900 m-0">Workout Plan</h1>
            <PlanTypeBadge planType="workout" />
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {planCreatedLabel}
            {clientLabel && clientLabel !== "Client" ? ` · ${clientLabel}` : ""}
          </p>
        </div>
      </div>

      {/* Contextual top plan bar (no tabs for workout) */}
      <div className="sticky top-0 z-20 -mx-0 mb-4 bg-white border-b border-neutral-200 shadow-sm rounded-b-lg">
        <PlanContextualBar
          clientId={plan.client_id}
          clientName={clientLabel}
          planId={plan.id}
          planType="workout"
          planTitle={workoutPlanTitle}
          editMode={editMode}
          onEditClick={handleEditToggle}
          shareStatus={shareStatus}
          onShareClick={handleShareLink}
          exportOpen={exportOpen}
          onExportToggle={() => setExportOpen((o) => !o)}
          onExportPdf={() => {}}
          showExportOptions={false}
        />
      </div>

      {editMode && (
        <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            style={{
              padding: "8px 16px",
              background: saveStatus === "saving" ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
            }}
          >
            {saveStatus === "saving" ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleCancelEdit}
            disabled={saveStatus === "saving"}
            style={{
              padding: "8px 16px",
              background: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          {saveStatus === "success" && (
            <span style={{ color: "#28a745", fontWeight: 500 }}>Saved</span>
          )}
          {saveStatus === "error" && saveError && (
            <span style={{ color: "#dc3545" }}>{saveError}</span>
          )}
        </div>
      )}

      {!editMode && shareStatus === "error" && shareError && (
        <div style={{ marginBottom: 16 }}>
          <span style={{ color: "#dc3545" }}>{shareError}</span>
        </div>
      )}

      {editMode && (
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="coach-message" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
            Coach Message
          </label>
          <textarea
            id="coach-message"
            value={coachMessage}
            onChange={(e) => handleCoachMessageChange(e.target.value)}
            placeholder="Optional message to your client (e.g. focus areas, reminders)"
            rows={4}
            style={{
              width: "100%",
              maxWidth: 600,
              padding: 12,
              borderRadius: 4,
              border: "1px solid #ccc",
              fontSize: 14,
              resize: "vertical",
            }}
          />
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <PlanRenderer
          plan={plan.content_json}
          editMode={editMode}
          editedPlanJson={editedContentJson ?? undefined}
          onExerciseChange={editMode ? handleExerciseChange : undefined}
          weekCompletionStats={weekCompletionStats}
        />
      </div>

      <div className="hidden md:block" style={{ marginTop: 24 }}>
        <Link href={`/pt/app/clients/${plan.client_id}`} style={{ color: "#0070f3", textDecoration: "none" }}>
          ← Back to Client
        </Link>
      </div>

      {/* Mobile-only sticky action bar (above global bottom nav) */}
      {!editMode && (
        <div className="fixed left-0 right-0 z-50 flex items-center justify-center gap-2 border-t border-black/10 bg-white/95 backdrop-blur px-4 py-3 md:hidden" style={{ bottom: "4rem" }}>
          <Link
            href={`/pt/app/clients/${plan.client_id}`}
            className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 font-medium text-sm"
          >
            ← Back
          </Link>
          <button
            type="button"
            onClick={handleShareLink}
            disabled={shareStatus === "loading"}
            className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg bg-neutral-800 text-white font-medium text-sm disabled:opacity-50"
          >
            {shareStatus === "loading" ? "…" : shareStatus === "success" ? "Copied!" : "Share"}
          </button>
          <a
            href={`/pt/app/plans/${plan.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg bg-neutral-800 text-white font-medium text-sm no-underline"
          >
            Export
          </a>
        </div>
      )}
    </div>
  );
}
