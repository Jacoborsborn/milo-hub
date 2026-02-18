"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/pt/Breadcrumbs";
import PlanContextualBar from "@/components/pt/plan/PlanContextualBar";
import PlanTabs from "@/components/pt/plan/PlanTabs";
import ShoppingOverviewBar, {
  getStoredViewMode,
  setStoredViewMode,
  type ViewMode,
} from "@/components/meals/ShoppingOverviewBar";
import {
  stableItemKey,
  getSmartTags,
  formatSectionTitle,
  getStrategyBullets,
  parseCost,
  type GroceryItem,
  type GrocerySection,
  type GroceryTotals,
} from "@/lib/shopping-utils";
import { updatePlanContent } from "@/lib/services/plans";

interface Plan {
  id: string;
  client_id: string;
  plan_type: string;
  content_json: Record<string, unknown>;
  created_at: string;
  client_name?: string | null;
}

function tagColorClass(tag: string): string {
  switch (tag) {
    case "High protein":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "Carb base":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    case "Healthy fats":
      return "bg-violet-100 text-violet-800 border border-violet-200";
    case "Multi-pack":
      return "bg-sky-100 text-sky-800 border border-sky-200";
    default:
      return "bg-neutral-100 text-neutral-600 border border-neutral-200";
  }
}

export default function PlanShoppingPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => new Set([0]));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ needed: string; buy: string; cost: string }>({ needed: "", buy: "", cost: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [shareError, setShareError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("structured");

  useEffect(() => {
    setViewMode(getStoredViewMode());
  }, []);

  const handleShareLink = useCallback(async () => {
    if (!planId) return;
    setShareStatus("loading");
    setShareError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/share`);
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
  }, [planId]);

  const handleExportPdf = useCallback(
    (path: "meals" | "shopping" | "full") => {
      if (!planId) return;
      setShareStatus("loading");
      setShareError(null);
      fetch(`/api/plans/${planId}/share`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to create share link");
          return res.json();
        })
        .then(({ url }) => {
          const exportPath = path === "meals" ? url : path === "shopping" ? `${url}/shopping` : `${url}/full`;
          const fullUrl =
            typeof window !== "undefined" ? `${window.location.origin}${exportPath}?print=1` : exportPath;
          window.open(fullUrl, "_blank", "noopener,noreferrer");
          setShareStatus("idle");
        })
        .catch((err) => {
          setShareError(err instanceof Error ? err.message : "Failed to export");
          setShareStatus("error");
        });
    },
    [planId]
  );

  const loadPlan = useCallback(async (id: string) => {
    const res = await fetch(`/api/plans/${id}`);
    if (!res.ok) throw new Error("Failed to load plan");
    const data = await res.json();
    if (data.plan_type !== "meal") throw new Error("Not a meal plan");
    return data as Plan;
  }, []);

  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      setPlanId(p.planId);
      loadPlan(p.planId)
        .then((data) => {
          if (!cancelled) setPlan(data);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [params, loadPlan]);

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const startEdit = (section: GrocerySection, item: GroceryItem, sectionLabel: string, sectionIndex?: number) => {
    if (viewMode === "compact" && sectionIndex != null) {
      setViewMode("structured");
      setStoredViewMode("structured");
      setExpandedSections((prev) => new Set([...prev, sectionIndex]));
    }
    const key = stableItemKey(sectionLabel, item);
    setEditingKey(key);
    setEditDraft({
      needed: item.needed ?? "",
      buy: item.buy ?? "",
      cost: item.estimatedPriceGBP != null ? String(item.estimatedPriceGBP) : "",
    });
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setSaveError(null);
  };

  const saveEdit = useCallback(async () => {
    if (!planId || !plan || !editingKey) return;
    const content = plan.content_json as { grocerySections?: GrocerySection[] };
    const sections = content.grocerySections ?? [];

    const costNum = editDraft.cost.trim() ? parseCost(editDraft.cost) : undefined;
    const updatedSections = sections.map((sec) => {
      const label = sec.label ?? "";
      return {
        ...sec,
        items: (sec.items ?? []).map((it) => {
          if (stableItemKey(label, it) !== editingKey) return it;
          return {
            ...it,
            needed: editDraft.needed.trim() || undefined,
            buy: editDraft.buy.trim() || undefined,
            estimatedPriceGBP: costNum != null ? costNum : it.estimatedPriceGBP,
          };
        }),
      };
    });

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updatePlanContent(planId, {
        ...plan.content_json,
        grocerySections: updatedSections,
      });
      setPlan((p) => (p ? { ...p, content_json: updated.content_json as Record<string, unknown> } : null));
      setEditingKey(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [planId, plan, editingKey, editDraft]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setStoredViewMode(mode);
  }, []);

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <p className="text-sm text-neutral-500">Loading…</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="p-4">
        <p className="text-red-600 text-sm">{error || "Plan not found"}</p>
        <Link href="/pt/app/plans" className="text-blue-600 text-sm mt-2 inline-block">
          ← Back to Plans
        </Link>
      </div>
    );
  }

  const content = plan.content_json as {
    grocerySections?: GrocerySection[];
    groceryTotals?: GroceryTotals;
    meta?: { mealInputs?: { budgetTier?: string } };
    mealInputs?: { budgetTier?: string };
  };
  const grocerySections = content.grocerySections ?? [];
  const groceryTotals = content.groceryTotals ?? {};
  const totalCost = groceryTotals.totalPriceGBP ?? groceryTotals.estimatedTotalWeek ?? 0;
  const breakdownGBP = groceryTotals.breakdownGBP ?? {};
  const budgetTier =
    (content.meta as { mealInputs?: { budgetTier?: string } } | undefined)?.mealInputs?.budgetTier ??
    content.mealInputs?.budgetTier ??
    null;
  const strategyBullets = getStrategyBullets(plan.content_json, groceryTotals, budgetTier ?? undefined);
  const clientLabel = plan.client_name ?? "Client";
  const meta = (content.meta as { weekCommencing?: string } | undefined);
  const weekCommencingIso = meta?.weekCommencing ?? plan.created_at;
  const mealPlanTitle = `Meal Plan – ${new Date(weekCommencingIso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  const days = (content as { days?: unknown[] }).days ?? [];
  const mealCount = Array.isArray(days) ? days.length : 0;
  const totalItems = grocerySections.reduce((sum, s) => sum + (s.items ?? []).length, 0);

  const getSectionSubtotal = (sectionLabel: string): number | null => {
    const v = breakdownGBP[sectionLabel];
    if (typeof v === "number" && v > 0) return v;
    const upper = (sectionLabel ?? "").toUpperCase();
    for (const [k, val] of Object.entries(breakdownGBP)) {
      if (k.toUpperCase() === upper && typeof val === "number") return val;
    }
    return null;
  };

  return (
    <div className="max-w-xl mx-auto pb-24 md:pb-8">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/pt/app/clients" },
          { label: clientLabel, href: `/pt/app/clients/${plan.client_id}` },
          { label: "Meal Plan", href: `/pt/app/plans/${plan.id}` },
          { label: "Shopping" },
        ]}
      />

      <div className="sticky top-0 z-20 -mx-0 mb-4 bg-white border-b border-neutral-200 shadow-sm rounded-b-lg">
        <PlanContextualBar
          clientId={plan.client_id}
          clientName={clientLabel}
          planId={plan.id}
          planType="meal"
          planTitle={mealPlanTitle}
          editMode={false}
          onEditClick={() => {}}
          shareStatus={shareStatus}
          onShareClick={handleShareLink}
          exportOpen={exportOpen}
          onExportToggle={() => setExportOpen((o) => !o)}
          onExportPdf={handleExportPdf}
          showExportOptions
        />
        <PlanTabs
          planId={plan.id}
          activeTab="shopping"
          mealCount={mealCount}
          shoppingSectionCount={grocerySections.length}
        />
      </div>

      <div className="px-4 py-4">
        {grocerySections.length === 0 ? (
          <p className="text-sm text-neutral-500">No grocery data for this plan.</p>
        ) : (
          <>
            <ShoppingOverviewBar
              totalCost={totalCost}
              sectionCount={grocerySections.length}
              itemCount={totalItems}
              sections={grocerySections}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />

            {viewMode === "compact" ? (
              <div className="space-y-1">
                {grocerySections.map((section, sIdx) => {
                  const sectionLabel = section.label ?? "Other";
                  const items = section.items ?? [];
                  return (
                    <div key={sIdx}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mt-3 mb-1.5 first:mt-0">
                        {formatSectionTitle(sectionLabel)}
                      </p>
                      {items.map((item, i) => {
                        const name = item.name ?? item.buy ?? item.foodId?.replace(/_/g, " ") ?? "—";
                        const need = item.needed ? `Need ${item.needed}` : "";
                        const buy = item.buy ? `Buy ${item.buy}` : "";
                        const est =
                          item.estimatedPriceGBP != null && item.estimatedPriceGBP > 0
                            ? `£${item.estimatedPriceGBP.toFixed(2)}`
                            : "";
                        const parts = [name, need, buy, est].filter(Boolean);
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 py-2 border-b border-neutral-100 text-sm"
                          >
                            <span className="text-neutral-800 min-w-0 truncate">{parts.join(" — ")}</span>
                            <button
                              type="button"
                              onClick={() => startEdit(section, item, sectionLabel, sIdx)}
                              className="shrink-0 p-1 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                              aria-label="Edit"
                            >
                              <span className="text-xs">✎</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {grocerySections.map((section, sIdx) => {
                  const items = section.items ?? [];
                  const count = items.length;
                  const isExpanded = expandedSections.has(sIdx);
                  const sectionLabel = section.label ?? "Other";
                  const subtotal = getSectionSubtotal(sectionLabel);

                  return (
                    <section
                      key={sIdx}
                      className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(sIdx)}
                        className="sticky top-0 z-10 w-full px-4 py-3 flex items-center justify-between gap-2 text-left bg-gradient-to-r from-neutral-50 to-white hover:from-neutral-100 hover:to-neutral-50 border-b border-neutral-100 transition-colors"
                      >
                        <span className="text-sm font-semibold text-neutral-800">
                          {formatSectionTitle(sectionLabel)}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {subtotal != null && (
                            <span className="text-xs font-medium text-neutral-600">
                              £{subtotal.toFixed(2)}
                            </span>
                          )}
                          <span className="text-xs text-neutral-500">({count})</span>
                          <span className="text-neutral-400" aria-hidden>
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {items.map((item, i) => {
                            const key = stableItemKey(sectionLabel, item);
                            const isEditing = editingKey === key;
                            const tags = getSmartTags(item);
                            const displayName = item.name ?? item.buy ?? item.foodId?.replace(/_/g, " ") ?? "—";

                            return (
                              <div
                                key={i}
                                className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm relative"
                              >
                                {!isEditing ? (
                                  <>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-bold text-neutral-900 text-sm">{displayName}</p>
                                      <button
                                        type="button"
                                        onClick={() => startEdit(section, item, sectionLabel, sIdx)}
                                        className="shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                                        aria-label="Edit item"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </button>
                                    </div>
                                    {tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {tags.map((tag) => (
                                          <span
                                            key={tag}
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColorClass(tag)}`}
                                          >
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 mt-2 text-xs">
                                      <div>
                                        <span className="text-neutral-500">Need</span>
                                        <p className="font-medium text-neutral-800 truncate">{item.needed ?? "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-neutral-500">Buy</span>
                                        <p className="font-medium text-neutral-800 truncate">{item.buy ?? "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-neutral-500">Est.</span>
                                        <p className="font-medium text-neutral-800 tabular-nums">
                                          {item.estimatedPriceGBP != null && item.estimatedPriceGBP > 0
                                            ? `£${item.estimatedPriceGBP.toFixed(2)}`
                                            : "—"}
                                        </p>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="font-bold text-neutral-900 text-sm">{displayName}</p>
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">Need</label>
                                      <input
                                        type="text"
                                        value={editDraft.needed}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, needed: e.target.value }))}
                                        className="w-full min-h-[36px] rounded-lg border border-neutral-300 px-3 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">Buy</label>
                                      <input
                                        type="text"
                                        value={editDraft.buy}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, buy: e.target.value }))}
                                        className="w-full min-h-[36px] rounded-lg border border-neutral-300 px-3 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-500 mb-0.5">Est. (£)</label>
                                      <input
                                        type="text"
                                        value={editDraft.cost}
                                        onChange={(e) => setEditDraft((d) => ({ ...d, cost: e.target.value }))}
                                        placeholder="7.20"
                                        className="w-full min-h-[36px] rounded-lg border border-neutral-300 px-3 text-sm"
                                      />
                                    </div>
                                    {saveError && <p className="text-sm text-red-600">{saveError}</p>}
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={saveEdit}
                                        disabled={saving}
                                        className="min-h-[36px] rounded-lg bg-neutral-800 text-white px-4 text-sm font-medium disabled:opacity-50"
                                      >
                                        {saving ? "Saving…" : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        disabled={saving}
                                        className="min-h-[36px] rounded-lg border border-neutral-300 px-4 text-sm font-medium"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            {strategyBullets.length > 0 && (
              <div className="mt-8 pt-6 border-t border-neutral-200">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                  Nutrition strategy
                </h3>
                <ul className="space-y-1.5 text-sm text-neutral-700">
                  {strategyBullets.map((bullet, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-neutral-400 shrink-0">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
