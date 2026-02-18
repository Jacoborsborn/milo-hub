"use client";

import { useState } from "react";
import { updateClient } from "@/lib/services/clients";
import type { ClientPresetsJson } from "@/types/database";
import { parseMealPreset, parseWorkoutPreset, presetsToConstraintsOnly, DEFAULT_MEAL_PRESET } from "@/types/presets";
import type { MealPreset, WorkoutPreset } from "@/types/presets";

export default function ClientPresetsEditor({
  clientId,
  initialPresets,
}: {
  clientId: string;
  initialPresets: ClientPresetsJson | null | undefined;
}) {
  const mealPreset = parseMealPreset((initialPresets as { meal?: unknown })?.meal);
  const workoutPreset = parseWorkoutPreset((initialPresets as { workout?: unknown })?.workout);

  const [meal, setMeal] = useState<MealPreset>(mealPreset);
  const [workout, setWorkout] = useState<WorkoutPreset>(workoutPreset);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateClient(clientId, {
        presets_json: presetsToConstraintsOnly({ meal, workout }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save defaults");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full min-h-[40px] rounded border border-neutral-300 px-2 text-sm";
  const labelClass = "block text-sm font-medium text-neutral-700 mb-1";

  const allergiesStr = meal.allergies?.join(", ") ?? "";
  const restrictionsStr = meal.restrictions?.join(", ") ?? "";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide">Client Defaults</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Constraints only. Structure comes from the assigned Program.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-neutral-800 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save defaults"}
        </button>
      </div>
      {error && <p className="px-4 py-2 text-red-600 text-sm">{error}</p>}
      <div className="p-4">
        <h4 className="text-sm font-medium text-neutral-600 mb-2">Meal constraints</h4>
        <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
          <div>
            <label className={labelClass}>Calories target (per day)</label>
            <input
              type="number"
              min={1200}
              max={4000}
              value={meal.caloriesTargetPerDay}
              onChange={(e) => setMeal((m) => ({ ...m, caloriesTargetPerDay: Number(e.target.value) || DEFAULT_MEAL_PRESET.caloriesTargetPerDay }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Budget tier</label>
            <select
              value={meal.budgetTier}
              onChange={(e) => setMeal((m) => ({ ...m, budgetTier: e.target.value as MealPreset["budgetTier"] }))}
              className={inputClass}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Allergies</label>
            <input
              type="text"
              value={allergiesStr}
              onChange={(e) => {
                const parts = e.target.value.split(",");
                const completed = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
                const current = parts.length > 0 ? parts[parts.length - 1] : "";
                setMeal((m) => ({ ...m, allergies: current.length > 0 ? [...completed, current] : completed }));
              }}
              onBlur={(e) => {
                const cleaned = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                setMeal((m) => ({ ...m, allergies: cleaned }));
              }}
              className={inputClass}
              placeholder="e.g. dairy, gluten"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Restrictions</label>
            <input
              type="text"
              value={restrictionsStr}
              onChange={(e) => {
                const parts = e.target.value.split(",");
                const completed = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
                const current = parts.length > 0 ? parts[parts.length - 1] : "";
                setMeal((m) => ({ ...m, restrictions: current.length > 0 ? [...completed, current] : completed }));
              }}
              onBlur={(e) => {
                const cleaned = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                setMeal((m) => ({ ...m, restrictions: cleaned }));
              }}
              className={inputClass}
              placeholder="e.g. no spicy"
            />
          </div>
        </div>
        <h4 className="text-sm font-medium text-neutral-600 mb-2 mt-4">Workout constraint</h4>
        <p className="text-xs text-neutral-500 mb-2">
          Days, goal, split, and session length come from the assigned Program. Set the client’s equipment here.
        </p>
        <div className="max-w-xs">
          <label className={labelClass}>Equipment</label>
          <select
            value={workout.equipmentType}
            onChange={(e) => setWorkout((w) => ({ ...w, equipmentType: e.target.value as WorkoutPreset["equipmentType"] }))}
            className={inputClass}
          >
            <option value="none">None</option>
            <option value="basic">Basic</option>
            <option value="gym">Gym</option>
          </select>
        </div>
      </div>
    </div>
  );
}
