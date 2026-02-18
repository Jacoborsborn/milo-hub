"use client";

import { useState } from "react";
import type { ClientPresets, MealPreset, WorkoutPreset } from "@/types/presets";

const inputClass =
  "w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400";
const labelClass = "block text-sm font-medium text-neutral-700 mb-1";

type Props = {
  value: ClientPresets;
  onChange: (presets: ClientPresets) => void;
};

export default function ClientPresetsFormFields({ value, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<"meals" | "workouts">("meals");

  const meal = value.meal;
  const workout = value.workout;

  const updateMeal = (next: Partial<MealPreset>) => {
    onChange({ ...value, meal: { ...value.meal, ...next } });
  };
  const updateWorkout = (next: Partial<WorkoutPreset>) => {
    onChange({ ...value, workout: { ...value.workout, ...next } });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50">
        <h3 className="text-sm font-semibold text-neutral-800 uppercase tracking-wide mb-1">Client Defaults</h3>
        <p className="text-xs text-neutral-500">Constraints only. Structure comes from the assigned Program.</p>
        <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 w-fit mt-2">
          <button
            type="button"
            onClick={() => setActiveTab("meals")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === "meals" ? "bg-white shadow text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}
          >
            Meals
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workouts")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${activeTab === "workouts" ? "bg-white shadow text-neutral-900" : "text-neutral-600 hover:text-neutral-900"}`}
          >
            Workouts
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === "meals" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Calories target (per day)</label>
              <input
                type="number"
                min={1200}
                max={4000}
                value={meal.caloriesTargetPerDay}
                onChange={(e) => updateMeal({ caloriesTargetPerDay: Number(e.target.value) || 2200 })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Budget tier</label>
              <select
                value={meal.budgetTier}
                onChange={(e) => updateMeal({ budgetTier: e.target.value as MealPreset["budgetTier"] })}
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
                value={meal.allergies.join(", ")}
                onChange={(e) => {
                  const parts = e.target.value.split(",");
                  const completed = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
                  const current = parts.length > 0 ? parts[parts.length - 1] : "";
                  updateMeal({ allergies: current.length > 0 ? [...completed, current] : completed });
                }}
                onBlur={(e) => {
                  const cleaned = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                  updateMeal({ allergies: cleaned });
                }}
                className={inputClass}
                placeholder="e.g. dairy, gluten"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Restrictions</label>
              <input
                type="text"
                value={meal.restrictions.join(", ")}
                onChange={(e) => {
                  const parts = e.target.value.split(",");
                  const completed = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
                  const current = parts.length > 0 ? parts[parts.length - 1] : "";
                  updateMeal({ restrictions: current.length > 0 ? [...completed, current] : completed });
                }}
                onBlur={(e) => {
                  const cleaned = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                  updateMeal({ restrictions: cleaned });
                }}
                className={inputClass}
                placeholder="e.g. no spicy"
              />
            </div>
          </div>
        )}

        {activeTab === "workouts" && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">
              Days, goal, split, and session length come from the assigned Program. You can set the client’s equipment constraint here.
            </p>
            <div>
              <label className={labelClass}>Equipment</label>
              <select
                value={workout.equipmentType}
                onChange={(e) => updateWorkout({ equipmentType: e.target.value as WorkoutPreset["equipmentType"] })}
                className={inputClass}
              >
                <option value="none">None</option>
                <option value="basic">Basic</option>
                <option value="gym">Gym</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
