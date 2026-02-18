"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import TemplatesMealsContent from "./meals/TemplatesMealsContent";
import { builtInWorkoutTemplates, getWorkoutDefaultsForApi } from "@/lib/constants/builtInWorkoutTemplates";
import { createWorkoutTemplate } from "@/lib/services/workoutTemplates";

type TemplateRow = {
  id: string;
  name: string;
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_type: string;
  duration_weeks: number;
  usage_count: number;
  created_at: string;
};

function formatChip(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TemplatesPage() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") === "meals" ? "meals" : "workouts") as "workouts" | "meals";

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingBuiltInName, setAddingBuiltInName] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [addAllMessage, setAddAllMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/pt/auth/login";
      return;
    }
    const { data, err } = await supabase
      .from("pt_templates")
      .select("id,name,goal,experience_level,days_per_week,equipment_type,duration_weeks,usage_count,created_at")
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setTemplates([]);
    } else {
      setTemplates((data ?? []) as TemplateRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab !== "workouts") return;
    loadWorkouts();
  }, [tab, loadWorkouts]);

  const handleAddBuiltInWorkout = async (name: string, defaults: WorkoutTemplateDefaults) => {
    setAddingBuiltInName(name);
    setError(null);
    setAddAllMessage(null);
    try {
      await createWorkoutTemplate(name, defaults);
      await loadWorkouts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add program");
    } finally {
      setAddingBuiltInName(null);
    }
  };

  const handleAddAllBuiltInWorkouts = async () => {
    const names = new Set(templates.map((t) => t.name.trim()));
    const toAdd = builtInWorkoutTemplates.filter((b) => !names.has(b.name.trim()));
    if (toAdd.length === 0) {
      setAddAllMessage("All built-in programs are already in your library.");
      return;
    }
    setAddingAll(true);
    setError(null);
    setAddAllMessage(null);
    let added = 0;
    try {
      for (const builtIn of toAdd) {
        try {
          await createWorkoutTemplate(builtIn.name.trim(), getWorkoutDefaultsForApi(builtIn));
          added++;
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          break;
        }
      }
      await loadWorkouts();
      if (added > 0) setAddAllMessage(`Added ${added} program${added === 1 ? "" : "s"}.`);
    } finally {
      setAddingAll(false);
    }
  };

  const workoutNames = new Set(templates.map((t) => t.name.trim()));

  const handleDeleteWorkoutConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("pt_templates").delete().eq("id", deleteConfirmId);
      if (error) throw error;
      setDeleteConfirmId(null);
      await loadWorkouts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Programs</h1>

      <div className="flex gap-1 p-1 rounded-lg bg-neutral-100" role="tablist">
        <Link
          href="/templates?tab=workouts"
          className={`px-4 py-2 rounded-md text-sm font-medium ${tab === "workouts" ? "bg-white shadow text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}
        >
          Workouts
        </Link>
        <Link
          href="/templates?tab=meals"
          className={`px-4 py-2 rounded-md text-sm font-medium ${tab === "meals" ? "bg-white shadow text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}
        >
          Meals
        </Link>
      </div>

      {tab === "workouts" && (
        <>
          {/* My programs */}
          <section>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">My programs</h2>
              <Link href="/templates/create" className="rounded-lg bg-neutral-800 text-white px-4 py-2 text-sm font-medium">
                New Program
              </Link>
            </div>
            {loading && <p className="text-neutral-500">Loading...</p>}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            {!loading && !error && templates.length === 0 && (
              <p className="text-neutral-500">No programs yet. Create a reusable program blueprint, then assign it to clients.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <div key={t.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="font-medium">{t.name}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {formatChip(t.goal)} • {formatChip(t.experience_level)} • {t.days_per_week}d/wk • {formatChip(t.equipment_type)} • {t.duration_weeks}w
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/templates/${t.id}/assign`} className="rounded-lg bg-neutral-800 text-white px-3 py-1.5 text-sm">
                      Assign
                    </Link>
                    <Link href={`/templates/${t.id}/edit`} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">
                      Edit
                    </Link>
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
                    onClick={handleDeleteWorkoutConfirm}
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

          {/* Built-in programs */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-lg font-semibold">Built-in programs</h2>
              <button
                type="button"
                onClick={handleAddAllBuiltInWorkouts}
                disabled={addingAll || builtInWorkoutTemplates.every((b) => workoutNames.has(b.name))}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingAll ? "Adding…" : "Add all built-ins"}
              </button>
            </div>
            {addAllMessage && <p className="text-sm text-green-700 mb-2">{addAllMessage}</p>}
            <p className="text-sm text-neutral-600 mb-4">
              Add any program to your library. Duplicates by name are skipped.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {builtInWorkoutTemplates.map((builtIn) => {
                const defaults = getWorkoutDefaultsForApi(builtIn);
                const alreadyAdded = workoutNames.has(builtIn.name.trim());
                const isAdding = addingBuiltInName === builtIn.name;
                return (
                  <div
                    key={builtIn.name}
                    className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4"
                  >
                    <div className="font-medium text-neutral-900">{builtIn.name}</div>
                    {builtIn.description && (
                      <div className="mt-1 text-xs text-neutral-500">{builtIn.description}</div>
                    )}
                    <div className="mt-1 text-xs text-neutral-400">
                      {formatChip(defaults.goal)} • {formatChip(defaults.experience_level)} • {defaults.days_per_week}d/wk • {formatChip(defaults.equipment_type)} • {defaults.duration_weeks}w
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddBuiltInWorkout(builtIn.name.trim(), defaults)}
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
        </>
      )}

      {tab === "meals" && <TemplatesMealsContent />}
    </div>
  );
}
