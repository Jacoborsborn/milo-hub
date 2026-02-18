"use client";

import { useState, useCallback } from "react";
import {
  createMealTemplate,
  listMealTemplates,
  type MealTemplateRow,
} from "@/lib/services/mealTemplates";

export default function MealTemplatesTestPage() {
  const [templates, setTemplates] = useState<MealTemplateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"idle" | "insert" | "refresh">("idle");

  const loadList = useCallback(async () => {
    setError(null);
    setLoading("refresh");
    try {
      const list = await listMealTemplates();
      setTemplates(list);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : String(e);
      const full =
        e && typeof e === "object" && "details" in e
          ? JSON.stringify(e, null, 2)
          : msg;
      setError(full);
    } finally {
      setLoading("idle");
    }
  }, []);

  const handleInsert = async () => {
    setError(null);
    setLoading("insert");
    try {
      const name = "Test Template " + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const defaults = {
        dietaryPreference: "balanced",
        caloriesTargetPerDay: 2200,
        budgetTier: "medium",
      };
      await createMealTemplate(name, defaults);
      await loadList();
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; code?: string };
      const msg = err?.message ?? String(e);
      const parts = [msg];
      if (err?.code) parts.push(`code: ${err.code}`);
      if (err?.details) parts.push(`details: ${err.details}`);
      setError(parts.join(" — ") || JSON.stringify(e, null, 2));
    } finally {
      setLoading("idle");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">pt_meal_templates RLS test (dev)</h1>
      <p className="text-sm text-neutral-600">
        Insert and list as signed-in PT user. If RLS blocks, the exact Supabase error appears below.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleInsert}
          disabled={loading !== "idle"}
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading === "insert" ? "Inserting…" : "Insert Test Template"}
        </button>
        <button
          type="button"
          onClick={loadList}
          disabled={loading !== "idle"}
          className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {loading === "refresh" ? "Loading…" : "Refresh List"}
        </button>
      </div>

      {error && (
        <div
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          <strong>Error</strong>
          <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs">
            {error}
          </pre>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Templates ({templates.length})</h2>
        {templates.length === 0 && !error && (
          <p className="text-sm text-neutral-500">No templates yet. Click Insert or Refresh.</p>
        )}
        <ul className="list-inside list-disc space-y-1 text-sm">
          {templates.map((t) => (
            <li key={t.id}>
              <span className="font-medium">{t.name}</span>{" "}
              <span className="text-neutral-500">
                {new Date(t.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
