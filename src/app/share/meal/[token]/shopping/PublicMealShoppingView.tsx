"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  stableItemKey,
  getSmartTags,
  formatSectionTitle,
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
  } catch {}
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
  } catch {}
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

  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [pantryOwned, setPantryOwned] = useState(false);
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    setCompletedMap(loadCompletedMap(token));
    setPantryOwned(loadPantryOwned(token));
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") window.print();
  }, []);

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

  const totalItems = grocerySections.reduce(
    (sum, s) => sum + (isPantrySection(s.label) ? 0 : (s.items ?? []).length),
    0
  );

  const completedCount = grocerySections.reduce((sum, s) => {
    if (isPantrySection(s.label)) return sum;
    const sectionLabel = s.label ?? "Other";
    return (
      sum +
      (s.items ?? []).filter((item) => completedMap[stableItemKey(sectionLabel, item)]).length
    );
  }, 0);

  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
  const isAllDone = totalItems > 0 && completedCount >= totalItems;

  useEffect(() => {
    if (isAllDone) setJustFinished(true);
  }, [isAllDone]);

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
      {/* All done celebration */}
      {justFinished && (
        <div className="bg-green-600 text-white text-center py-3 px-4 text-sm font-semibold">
          🛒 Shop done! You're all set for the week.
        </div>
      )}

      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-white border-b border-neutral-200 shadow-sm print:static">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            {!embedded && (
              <Link
                href={`/share/meal/${token}`}
                className="shrink-0 min-h-[36px] inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 print:hidden"
              >
                ← Meals
              </Link>
            )}

            {/* Hero total */}
            {typeof totalCost === "number" && totalCost > 0 && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2 ml-auto">
                <span className="text-base">🛒</span>
                <div>
                  <p className="text-xs text-green-700 font-medium leading-tight">Est. weekly shop</p>
                  <p className="text-lg font-bold text-green-800 leading-tight">
                    ~£{totalCost.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          {!embedded && totalItems > 0 && (
            <div className="mt-3 print:hidden">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold text-neutral-700">
                  {isAllDone
                    ? "All done! 🎉"
                    : `${completedCount} of ${totalItems} items ticked off`}
                </p>
                <p className="text-sm font-bold text-neutral-500">{progressPercent}%</p>
              </div>
              <div className="h-3 w-full rounded-full bg-neutral-300 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isAllDone ? "bg-green-500" : "bg-indigo-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mt-4 px-4 pb-12">
        <div className="space-y-2">
          {grocerySections.map((section, sIdx) => {
            const items = section.items ?? [];
            const count = items.length;
            const isExpanded = expandedSections.has(sIdx);
            const sectionLabel = section.label ?? "Other";
            const isPantry = isPantrySection(section.label);

            return (
              <section
                key={sIdx}
                className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(sIdx)}
                  className="w-full px-4 py-3.5 flex items-center justify-between gap-2 text-left bg-white hover:bg-neutral-50 transition-colors"
                >
                  <span className="text-sm font-bold text-neutral-800 uppercase tracking-wider">
                    {formatSectionTitle(sectionLabel)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-400 bg-neutral-100 rounded-full px-2 py-0.5">
                      {count}
                    </span>
                    <span className="text-neutral-400 text-xs" aria-hidden>
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </span>
                </button>

                {isPantry && (
                  <div className="px-4 pb-3 flex flex-col gap-2 border-t border-neutral-100">
                    <p className="text-xs text-neutral-500 pt-2">
                      Basics you likely already have — not counted in your progress.
                    </p>
                    <button
                      type="button"
                      onClick={togglePantryOwned}
                      className="self-start min-h-[32px] rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 print:hidden"
                    >
                      {pantryOwned ? "Unmark as owned" : "I've already got these ✓"}
                    </button>
                  </div>
                )}

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-neutral-100">
                    {items.map((item, i) => {
                      const key = stableItemKey(sectionLabel, item);
                      const completed = !isPantry && completedMap[key];
                      const tags = getSmartTags(item);
                      const displayName =
                        item.name ?? item.buy ?? item.foodId?.replace(/_/g, " ") ?? "—";
                      const cleanName = displayName.replace(/\s*\(need:[^)]*\)/gi, "").trim();
                      const ownedStyle = isPantry && pantryOwned;

                      const cardContent = (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`font-semibold text-sm leading-snug ${
                                completed
                                  ? "line-through text-neutral-400"
                                  : ownedStyle
                                  ? "text-neutral-400"
                                  : "text-neutral-900"
                              }`}
                            >
                              {cleanName}
                            </p>
                            {completed && (
                              <span className="shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                                ✓
                              </span>
                            )}
                            {ownedStyle && !completed && (
                              <span className="shrink-0 text-xs text-neutral-400 font-medium">
                                Got it
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
                            <p className="text-xs text-neutral-500 mt-1">Need: {item.needed}</p>
                          )}
                          {item.buy && (
                            <p className="text-xs text-neutral-500">Buy: {item.buy}</p>
                          )}
                          {item.estimatedPriceGBP != null && item.estimatedPriceGBP > 0 && (
                            <p className="text-xs font-semibold text-neutral-600 mt-1">
                              ~£{item.estimatedPriceGBP.toFixed(2)}
                            </p>
                          )}
                        </>
                      );

                      if (isPantry) {
                        return (
                          <div
                            key={i}
                            className={`rounded-xl border p-3.5 ${
                              ownedStyle
                                ? "border-neutral-100 bg-neutral-50 opacity-70"
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
                          className={`w-full text-left rounded-xl border p-3.5 transition-all duration-200 ${
                            completed
                              ? "border-green-200 bg-green-50/60 opacity-70"
                              : "border-neutral-200 bg-white hover:border-indigo-200 hover:shadow-sm"
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

        {!hideBackLink && (
          <div className="mt-8 print:hidden">
            <Link
              href={`/share/meal/${token}`}
              className="min-h-[44px] inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 w-full"
            >
              ← Back to meals
            </Link>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) return <div className="print:bg-white">{inner}</div>;

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white max-w-xl mx-auto print:max-w-none">
      {inner}
    </div>
  );
}