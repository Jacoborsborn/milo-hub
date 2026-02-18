"use client";

import { useState } from "react";
import { updateClient } from "@/lib/services/clients";
import type { PtTemplateRow } from "@/lib/services/ptTemplatesServer";
import type { MealTemplate } from "@/types/database";

const labelClass = "block text-sm font-medium text-neutral-700 mb-1";
const inputClass =
  "w-full min-h-[40px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400";

type Props = {
  clientId: string;
  assignedWorkoutProgramId: string | null;
  assignedMealProgramId: string | null;
  workoutPrograms: PtTemplateRow[];
  mealPrograms: MealTemplate[];
};

export default function ClientAssignedPrograms({
  clientId,
  assignedWorkoutProgramId,
  assignedMealProgramId,
  workoutPrograms,
  mealPrograms,
}: Props) {
  const [workoutId, setWorkoutId] = useState<string>(assignedWorkoutProgramId ?? "");
  const [mealId, setMealId] = useState<string>(assignedMealProgramId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateClient(clientId, {
        assigned_workout_program_id: workoutId || null,
        assigned_meal_program_id: mealId || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    (workoutId || null) !== (assignedWorkoutProgramId ?? null) ||
    (mealId || null) !== (assignedMealProgramId ?? null);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide">Assigned Programs</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Default programs for 1-click generation.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-lg bg-neutral-800 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
      {error && <p className="px-4 py-2 text-red-600 text-sm">{error}</p>}
      <div className="p-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="assigned-workout" className={labelClass}>Workout program</label>
          <select
            id="assigned-workout"
            value={workoutId}
            onChange={(e) => setWorkoutId(e.target.value)}
            className={inputClass}
          >
            <option value="">— None —</option>
            {workoutPrograms.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="assigned-meal" className={labelClass}>Meal program</label>
          <select
            id="assigned-meal"
            value={mealId}
            onChange={(e) => setMealId(e.target.value)}
            className={inputClass}
          >
            <option value="">— None —</option>
            {mealPrograms.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
