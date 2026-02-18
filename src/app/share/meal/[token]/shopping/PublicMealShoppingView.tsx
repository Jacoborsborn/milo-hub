"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  stableItemKey,
  getSmartTags,
  formatSectionTitle,
  getStrategyBullets,
  isPantrySection,
  type GroceryItem,
  type GrocerySection,
  type GroceryTotals,
} from "@/lib/shopping-utils";

const STORAGE_PREFIX = "mealShareShoppingCompleted:";
const PANTRY_OWNED_PREFIX = "mealShareShoppingPantryOwned:";

type Plan = {
  id: string;
  content_json: Record<string, unknown>;
};

function loadCompletedMap(token: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + token);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveCompletedMap(token: string, map: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + token, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function loadPantryOwned(token: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(PANTRY_OWNED_PREFIX + token);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

function savePantryOwned(token: string, owned: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PANTRY_OWNED_PREFIX + token, owned ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export default function PublicMealShoppingView({
  plan,
  token,
  hideBackLink,
  embedded,
}: {
  plan: Plan;
  token: string;
  hideBackLink?: boolean;
  embedded?: boolean;
}) {
  const content = plan.content_json as {
    grocerySections?: GrocerySection[];
    groceryTotals?: GroceryTotals;
    meta?: { mealInputs?: { budgetTier?: string } };
    mealInputs?: { budgetTier?: string };
  };
  const grocerySections = content.grocerySections ?? [];
  const groceryTotals = content.groceryTotals ?? {};
  const totalCost = groceryTotals.totalPriceGBP ?? groceryTotals.estimatedTotalWeek ?? 0;
  const budgetTier =
    content.meta?.mealInputs?.budgetTier ?? content.mealInputs?.budgetTier ?? null;
  const strategyBullets = getStrategyBullets(plan.content_json, groceryTotals, budgetTier ?? undefined);

  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>(() => ({}));
  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => new Set([0]));
  const [pantryOwned, setPantryOwned] = useState(false);

  useEffect(() => {
    setCompletedMap(loadCompletedMap(token));
    setPantryOwned(loadPantryOwned(token));
  }, [token]);

  const toggleItem = useCallback(
    (key: string) => {
      setCompletedMap((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        saveCompletedMap(token, next);
        return next;
      });
    },
    [token]
  );

  const togglePantryOwned = useCallback(() => {
    setPantryOwned((prev) => {
      const next = !prev;
      savePantryOwned(token, next);
      return next;
    });
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      window.print();
    }
  }, []);

  const totalItems = grocerySections.reduce(
    (sum, s) => sum + (isPantrySection(s.label) ? 0 : (s.items ?? []).length),
    0
  );
  const completedCount = grocerySections.reduce((sum, s) => {
    if (isPantrySection(s.label)) return sum;
    const sectionLabel = s.label ?? "Other";
    return sum + (s.items ?? []).filter((item) => completedMap[stableItemKey(sectionLabel, item)]).length;
  }, 0);
  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const inner = (
    <>
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-white border-b border-neutral-200 shadow-sm print:static">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          {!embedded && (
            <Link
              href={`/share/meal/${token}`}
              className="shrink-0 min-h-[40px] inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50 print:hidden"
            >
              ← Back
            </Link>
          )}
          {embedded && <span />}
          <span className="text-sm font-semibold text-neutral-900 truncate">
            Weekly Procurement List
          </span>
          <span className="shrink-0 text-sm font-medium text-neutral-700">
            £{typeof totalCost === "number" ? totalCost.toFixed(2) : "0.00"}
          </span>
        </div>
        {budgetTier != null && budgetTier !== "" && budgetTier !== "—" && (
          <div className="px-4 pb-2">
            <p className="text-xs text-neutral-500">Budget tier: {String(budgetTier)}</p>
          </div>
        )}

        {/* Progress bar (public only, not in embedded/print) */}
        {!embedded && totalItems > 0 && (
          <div className="px-4 pb-3 print:hidden">
            <p className="text-xs font-medium text-neutral-600 mb-1">
              Shopping progress: {completedCount}/{totalItems} items
            </p>
            <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <div className="mt-4 px-4 pb-8">
        <div className="space-y-2">
          {grocerySections.map((section, sIdx) => {
            const items = section.items ?? [];
            const count = items.length;
            const isExpanded = expandedSections.has(sIdx);
            const sectionLabel = section.label ?? "Other";
            const isPantry = isPantrySection(section.label);

            return (
              <section key={sIdx} className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(sIdx)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left bg-neutral-50 hover:bg-neutral-100 transition-colors"
                >
                  <span
                    className="text-sm font-semibold uppercase tracking-wider text-neutral-700"
                    style={{ letterSpacing: "0.08em" }}
                  >
                    {formatSectionTitle(sectionLabel)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">({count})</span>
                    <span className="text-neutral-400" aria-hidden>
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </span>
                </button>
                {isPantry && (
                  <div className="px-4 pb-2 flex flex-col gap-2">
                    <p className="text-xs text-neutral-500">Usually already owned — not included in progress.</p>
                    <button
                      type="button"
                      onClick={togglePantryOwned}
                      className="self-start min-h-[32px] rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 print:hidden"
                    >
                      {pantryOwned ? "Mark pantry as not owned" : "Mark pantry as owned"}
                    </button>
                  </div>
                )}
                {isExpanded && (
                  <div className="p-4 pt-0 space-y-5">
                    {items.map((item, i) => {
                      const key = stableItemKey(sectionLabel, item);
                      const completed = !isPantry && completedMap[key];
                      const tags = getSmartTags(item);
                      const displayName = item.name ?? item.buy ?? item.foodId?.replace(/_/g, " ") ?? "—";
                      const ownedStyle = isPantry && pantryOwned;

                      const cardContent = (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`font-semibold text-base ${
                                completed ? "line-through text-neutral-500" : ownedStyle ? "text-neutral-500" : "text-neutral-900"
                              }`}
                            >
                              {displayName}
                            </p>
                            {completed && (
                              <span className="shrink-0 text-emerald-600" aria-hidden>
                                ✓
                              </span>
                            )}
                            {ownedStyle && (
                              <span className="shrink-0 text-neutral-400 text-sm" aria-hidden>
                                Owned
                              </span>
                            )}
                          </div>
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {item.needed && (
                            <p className="text-sm text-neutral-600 mt-1">Required: {item.needed}</p>
                          )}
                          {item.buy && (
                            <p className="text-sm text-neutral-600">Purchase: {item.buy}</p>
                          )}
                          {item.estimatedPriceGBP != null && item.estimatedPriceGBP > 0 && (
                            <p className="text-sm font-medium text-neutral-700 mt-1">
                              Cost estimate: £{item.estimatedPriceGBP.toFixed(2)}
                            </p>
                          )}
                        </>
                      );

                      if (isPantry) {
                        return (
                          <div
                            key={i}
                            className={`w-full rounded-lg border p-4 shadow-sm ${
                              ownedStyle
                                ? "border-neutral-200 bg-neutral-50/80 opacity-90"
                                : "border-neutral-100 bg-white"
                            }`}
                          >
                            {cardContent}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleItem(key)}
                          className={`w-full text-left rounded-lg border p-4 shadow-sm transition-all ${
                            completed
                              ? "border-emerald-300 bg-emerald-50/50 opacity-75"
                              : "border-neutral-100 hover:border-neutral-200"
                          }`}
                        >
                          {cardContent}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {strategyBullets.length > 0 && (
          <div className="mt-10 pt-8 border-t border-neutral-200 print:border-neutral-300">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-600 mb-3">
              Nutrition strategy summary
            </h3>
            <ul className="space-y-2 text-sm text-neutral-700">
              {strategyBullets.map((bullet, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-neutral-400 shrink-0">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hideBackLink && (
          <div className="mt-8 print:hidden">
            <Link
              href={`/share/meal/${token}`}
              className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 w-full md:w-auto"
            >
              ← Back to Meals
            </Link>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) return <div className="print:bg-white">{inner}</div>;

  return (
    <div className="min-h-screen bg-white print:bg-white max-w-xl mx-auto print:max-w-none">
      {inner}
    </div>
  );
}
