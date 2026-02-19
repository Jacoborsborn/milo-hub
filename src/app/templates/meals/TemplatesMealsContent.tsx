"use client";

import { useEffect, useState } from "react";
import { listMealTemplates, createMealTemplate, updateMealTemplate, deleteMealTemplate } from "@/lib/services/meal-templates";
import { createMealTemplate as addMealTemplateToLibrary } from "@/lib/services/mealTemplates";
import { listClients } from "@/lib/services/clients";
import { builtInMealTemplates, getMealDefaultsForApi } from "@/lib/constants/builtInMealTemplates";
import type { MealTemplate } from "@/types/database";
import type { Client } from "@/types/database";

type Props = { mealRefreshKey?: number };

export default function TemplatesMealsContent({ mealRefreshKey = 0 }: Props) {
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createDefaults, setCreateDefaults] = useState({
    dietaryPreference: "balanced",
    mealsPerDay: 4,
    days: 7,
    dietGoal: "maintain",
  });
  const [creating, setCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MealTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState<string | null>(null);
  const [assignClientId, setAssignClientId] = useState("");
  const [assignOverrides, setAssignOverrides] = useState<Record<string, unknown>>({});
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [addingBuiltInName, setAddingBuiltInName] = useState<string | null>(null);
  const [addingAllMeals, setAddingAllMeals] = useState(false);
  const [addAllMealsMessage, setAddAllMealsMessage] = useState<string | null>(null);

  const defaultFormState = () => ({
    dietaryPreference: "balanced",
    mealsPerDay: 4,
    days: 7,
    dietGoal: "maintain",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c] = await Promise.all([listMealTemplates(), listClients()]);
      setTemplates(t);
      setClients(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (mealRefreshKey > 0) load();
  }, [mealRefreshKey]);

  const defaultsToFormState = (d: Record<string, unknown> | undefined) => {
    if (!d || typeof d !== "object") return defaultFormState();
    return {
      dietaryPreference: String(d.dietaryPreference ?? "balanced"),
      mealsPerDay: Number(d.mealsPerDay) || 4,
      days: Number(d.days) || 7,
      dietGoal: String(d.dietGoal ?? "maintain"),
    };
  };

  /** Safe defaults for client-specific fields; not collected in UI, applied when saving. */
  const programDefaultsPayload = (programOnly: typeof createDefaults) => ({
    ...programOnly,
    caloriesTargetPerDay: 2000,
    budgetTier: "medium",
    allergies: [] as string[],
    restrictions: [] as string[],
  });

  const handleSaveCreateOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const defaultsPayload = programDefaultsPayload(createDefaults);
      if (editingTemplate) {
        await updateMealTemplate(editingTemplate.id, {
          name: createName.trim() || editingTemplate.name,
          defaults: defaultsPayload,
        });
        setEditingTemplate(null);
      } else {
        await createMealTemplate({
          name: createName.trim() || "Meal program",
          defaults: defaultsPayload,
        });
      }
      setCreateName("");
      setCreateDefaults(defaultFormState());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (t: MealTemplate) => {
    setEditingTemplate(t);
    setCreateName(t.name);
    setCreateDefaults(defaultsToFormState(t.defaults as Record<string, unknown>));
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await deleteMealTemplate(deleteConfirmId);
      setDeleteConfirmId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const openAssign = (templateId: string) => {
    setAssignTemplateId(templateId);
    setAssignClientId("");
    setAssignOverrides({});
    setAssignError(null);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTemplateId || !assignClientId) return;
    setAssignError(null);
    setAssigning(true);
    const client = clients.find((c) => c.id === assignClientId);
    try {
      const createRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: assignClientId,
          job_type: "meal",
          payload: {
            meal_template_id: assignTemplateId,
            client_name: client?.name ?? "Client",
          },
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create job");
      }
      const { jobId } = await createRes.json();
      setAssignTemplateId(null);
      fetch(`/api/jobs/${jobId}/process`, { method: "POST" });
      window.dispatchEvent(new CustomEvent("openGenerationCenter"));
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to queue");
    } finally {
      setAssigning(false);
    }
  };

  const dbTemplateNames = new Set(templates.map((t) => t.name.trim()));
  const handleAddBuiltIn = async (name: string, defaults: Record<string, unknown>) => {
    setAddingBuiltInName(name);
    setError(null);
    setAddAllMealsMessage(null);
    try {
      await addMealTemplateToLibrary(name, defaults);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add program");
    } finally {
      setAddingBuiltInName(null);
    }
  };

  const handleAddAllBuiltInMeals = async () => {
    const toAdd = builtInMealTemplates.filter((b) => !dbTemplateNames.has(b.name.trim()));
    if (toAdd.length === 0) {
      setAddAllMealsMessage("All built-in meal programs are already in your library.");
      return;
    }
    setAddingAllMeals(true);
    setError(null);
    setAddAllMealsMessage(null);
    let added = 0;
    try {
      for (const builtIn of toAdd) {
        try {
          await addMealTemplateToLibrary(builtIn.name.trim(), getMealDefaultsForApi(builtIn));
          added++;
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          break;
        }
      }
      await load();
      if (added > 0) setAddAllMealsMessage(`Added ${added} meal program${added === 1 ? "" : "s"}.`);
    } finally {
      setAddingAllMeals(false);
    }
  };

  const inputClass = "w-full min-h-[40px] rounded border border-neutral-300 px-2 text-sm";

  function formatChip(value: string): string {
    return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="space-y-8">
      {/* Program Library */}
      <section>
        <div className="mb-2">
          <h2 className="text-lg font-semibold">Program Library</h2>
        </div>

        {editingTemplate && (
          <form onSubmit={handleSaveCreateOrEdit} className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
            <h3 className="font-medium">{editingTemplate ? "Edit meal program" : "New meal program"}</h3>
            <p className="text-xs text-neutral-500">
              Calories, budget, and restrictions come from the client profile when you generate a draft.
            </p>
            <div>
              <label className="block text-sm text-neutral-600 mb-1">Name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Standard 7-day"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Diet</label>
                <select
                  value={createDefaults.dietaryPreference}
                  onChange={(e) => setCreateDefaults((d) => ({ ...d, dietaryPreference: e.target.value }))}
                  className={inputClass}
                >
                  <option value="balanced">Balanced</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="pescatarian">Pescatarian</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Meals/day</label>
                <select
                  value={createDefaults.mealsPerDay}
                  onChange={(e) => setCreateDefaults((d) => ({ ...d, mealsPerDay: Number(e.target.value) }))}
                  className={inputClass}
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Days</label>
                <select
                  value={createDefaults.days}
                  onChange={(e) => setCreateDefaults((d) => ({ ...d, days: Number(e.target.value) }))}
                  className={inputClass}
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={7}>7</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Goal</label>
                <select
                  value={createDefaults.dietGoal}
                  onChange={(e) => setCreateDefaults((d) => ({ ...d, dietGoal: e.target.value }))}
                  className={inputClass}
                >
                  <option value="maintain">Maintain</option>
                  <option value="lose">Lose</option>
                  <option value="gain">Gain</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="rounded-lg bg-neutral-800 text-white px-4 py-2 text-sm disabled:opacity-50">
                {creating ? "Saving…" : editingTemplate ? "Save changes" : "Save to library"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingTemplate(null);
                  setCreateName("");
                  setCreateDefaults(defaultFormState());
                }}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

      {loading && <p className="text-neutral-500">Loading…</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && templates.length === 0 && !editingTemplate && (
        <p className="text-neutral-500">No programs yet. Create a reusable program blueprint, then assign it to clients.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="font-medium text-neutral-900">{t.name}</div>
            <div className="mt-1 text-xs text-neutral-500">
              {formatChip(String((t.defaults as Record<string, unknown>)?.dietaryPreference ?? "—"))} • {String((t.defaults as Record<string, unknown>)?.mealsPerDay ?? "—")} meals/day • {String((t.defaults as Record<string, unknown>)?.days ?? "—")} days
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => openAssign(t.id)}
                className="rounded-lg bg-neutral-800 text-white px-3 py-1.5 text-sm"
              >
                Assign
              </button>
              <button
                type="button"
                onClick={() => openEdit(t)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(t.id)}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                title="Delete program"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      </section>

      {/* Built-in meal programs */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-lg font-semibold">Built-in meal programs</h2>
          <button
            type="button"
            onClick={handleAddAllBuiltInMeals}
            disabled={addingAllMeals || builtInMealTemplates.every((b) => dbTemplateNames.has(b.name.trim()))}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingAllMeals ? "Adding…" : "Add all built-ins"}
          </button>
        </div>
        {addAllMealsMessage && <p className="text-sm text-green-700 mb-2">{addAllMealsMessage}</p>}
        <p className="text-sm text-neutral-600 mb-4">
          Add any meal program to your library to use it with clients. Duplicates by name are skipped.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {builtInMealTemplates.map((builtIn) => {
            const defaults = getMealDefaultsForApi(builtIn);
            const alreadyAdded = dbTemplateNames.has(builtIn.name.trim());
            const isAdding = addingBuiltInName === builtIn.name;
            return (
              <div key={builtIn.name} className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
                <div className="font-medium text-neutral-900">{builtIn.name}</div>
                {builtIn.description && (
                  <div className="mt-1 text-xs text-neutral-500">{builtIn.description}</div>
                )}
                <div className="mt-1 text-xs text-neutral-400">
                  {formatChip(defaults.dietaryPreference)} • {defaults.mealsPerDay} meals/day • {defaults.days} days • {formatChip(defaults.dietGoal)}
                </div>
                <button
                  type="button"
                  onClick={() => handleAddBuiltIn(builtIn.name.trim(), defaults)}
                  disabled={alreadyAdded || isAdding}
                  className="mt-3 rounded-lg bg-neutral-800 text-white px-3 py-1.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {alreadyAdded ? "Added" : isAdding ? "Adding…" : "Add to my library"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-sm w-full rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-lg mb-2">Delete program?</h3>
            <p className="text-sm text-neutral-600 mb-4">
              This won&apos;t delete existing plans created from it.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {assignTemplateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md w-full rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-lg mb-4">Assign meal program to client</h3>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Client</label>
                <select
                  value={assignClientId}
                  onChange={(e) => setAssignClientId(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-neutral-500">
                Merged inputs: program defaults ← client presets ← overrides below (optional).
              </p>
              {assignError && <p className="text-red-600 text-sm">{assignError}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={!assignClientId || assigning} className="rounded-lg bg-neutral-800 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                  {assigning ? "Queuing…" : "Generate & save plan"}
                </button>
                <button type="button" onClick={() => setAssignTemplateId(null)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
