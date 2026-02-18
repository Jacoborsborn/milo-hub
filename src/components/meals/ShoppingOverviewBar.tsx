"use client";

import { useState, useCallback } from "react";
import type { GrocerySection } from "@/lib/shopping-utils";

const STORAGE_KEY_VIEW_MODE = "mealShoppingViewMode";

export type ViewMode = "structured" | "compact";

export type ShoppingOverviewBarProps = {
  totalCost: number;
  sectionCount: number;
  itemCount: number;
  sections: GrocerySection[];
  onCopyList?: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

function buildPlainList(sections: GrocerySection[]): string {
  return sections
    .map((sec) => {
      const label = sec.label ?? "Other";
      const items = (sec.items ?? [])
        .map((it) => it.name ?? it.buy ?? it.foodId?.replace(/_/g, " ") ?? "—")
        .join("\n");
      return `${label}\n${items}`;
    })
    .join("\n\n");
}

function buildCsv(sections: GrocerySection[]): string {
  const rows: string[] = ["Section,Item,Needed,Buy,Est. (£)"];
  for (const sec of sections) {
    const label = sec.label ?? "Other";
    for (const it of sec.items ?? []) {
      const name = (it.name ?? it.buy ?? it.foodId ?? "—").replace(/"/g, '""');
      const needed = (it.needed ?? "").replace(/"/g, '""');
      const buy = (it.buy ?? "").replace(/"/g, '""');
      const est = it.estimatedPriceGBP != null ? String(it.estimatedPriceGBP) : "";
      rows.push(`"${label}","${name}","${needed}","${buy}","${est}"`);
    }
  }
  return rows.join("\n");
}

export function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "structured";
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
    if (raw === "compact" || raw === "structured") return raw;
  } catch {
    // ignore
  }
  return "structured";
}

export function setStoredViewMode(mode: ViewMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
  } catch {
    // ignore
  }
}

export default function ShoppingOverviewBar({
  totalCost,
  sectionCount,
  itemCount,
  sections,
  onCopyList,
  viewMode,
  onViewModeChange,
}: ShoppingOverviewBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = buildPlainList(sections);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    onCopyList?.();
  }, [sections, onCopyList]);

  const handleExportCsv = useCallback(() => {
    const csv = buildCsv(sections);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shopping-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [sections]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm mb-4">
      <div className="px-5 py-4 bg-gradient-to-br from-neutral-50 to-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-neutral-900 tabular-nums">
              £{typeof totalCost === "number" ? totalCost.toFixed(2) : "0.00"}
            </p>
            <p className="text-xs font-medium text-neutral-500 mt-0.5">
              {sectionCount} sections · {itemCount} items
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              {copied ? "Copied" : "Copy list"}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => {
              onViewModeChange("structured");
              setStoredViewMode("structured");
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "structured"
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Structured
          </button>
          <button
            type="button"
            onClick={() => {
              onViewModeChange("compact");
              setStoredViewMode("compact");
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "compact"
                ? "bg-neutral-800 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Compact
          </button>
        </div>
      </div>
    </div>
  );
}
