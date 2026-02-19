"use client";

import { useState, useEffect } from "react";
import { saveClientAssignmentsAndAutogen } from "@/lib/services/program-assignments";
import type { PtTemplateRow } from "@/lib/services/ptTemplatesServer";
import type { MealTemplate, ProgramAssignment } from "@/types/database";

const labelClass = "block text-sm font-medium text-neutral-700 mb-1";
const inputClass =
  "w-full min-h-[40px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400";

function nextMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const add = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

type Props = {
  clientId: string;
  assignedWorkoutProgramId: string | null;
  assignedMealProgramId: string | null;
  workoutPrograms: PtTemplateRow[];
  mealPrograms: MealTemplate[];
  assignments: ProgramAssignment[];
};

export default function ClientAssignedPrograms({
  clientId,
  assignedWorkoutProgramId,
  assignedMealProgramId,
  workoutPrograms,
  mealPrograms,
  assignments,
}: Props) {
  const workoutAssignment = assignments.find((a) => a.program_type === "workout");
  const mealAssignment = assignments.find((a) => a.program_type === "meal");

  const [workoutId, setWorkoutId] = useState(assignedWorkoutProgramId ?? "");
  const [mealId, setMealId] = useState(assignedMealProgramId ?? "");
  const [workoutStartDate, setWorkoutStartDate] = useState(
    workoutAssignment?.start_date ?? nextMonday()
  );
  const [mealStartDate, setMealStartDate] = useState(
    mealAssignment?.start_date ?? nextMonday()
  );
  const [workoutAutoGen, setWorkoutAutoGen] = useState(
    workoutAssignment?.auto_generate_enabled ?? false
  );
  const [workoutLeadDays, setWorkoutLeadDays] = useState(
    workoutAssignment?.autogen_lead_days ?? 2
  );
  const [mealAutoGen, setMealAutoGen] = useState(
    mealAssignment?.auto_generate_enabled ?? false
  );
  const [mealLeadDays, setMealLeadDays] = useState(
    mealAssignment?.autogen_lead_days ?? 2
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWorkoutId(assignedWorkoutProgramId ?? "");
    setMealId(assignedMealProgramId ?? "");
    setWorkoutStartDate(workoutAssignment?.start_date ?? nextMonday());
    setMealStartDate(mealAssignment?.start_date ?? nextMonday());
    setWorkoutAutoGen(workoutAssignment?.auto_generate_enabled ?? false);
    setWorkoutLeadDays(workoutAssignment?.autogen_lead_days ?? 2);
    setMealAutoGen(mealAssignment?.auto_generate_enabled ?? false);
    setMealLeadDays(mealAssignment?.autogen_lead_days ?? 2);
  }, [
    assignedWorkoutProgramId,
    assignedMealProgramId,
    workoutAssignment?.start_date,
    workoutAssignment?.auto_generate_enabled,
    workoutAssignment?.autogen_lead_days,
    mealAssignment?.start_date,
    mealAssignment?.auto_generate_enabled,
    mealAssignment?.autogen_lead_days,
  ]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveClientAssignmentsAndAutogen(clientId, {
        assignedWorkoutProgramId: workoutId || null,
        assignedMealProgramId: mealId || null,
        workoutStartDate: workoutId ? workoutStartDate : undefined,
        workoutAutoGen: workoutId ? workoutAutoGen : undefined,
        workoutLeadDays: workoutId ? workoutLeadDays : undefined,
        mealStartDate: mealId ? mealStartDate : undefined,
        mealAutoGen: mealId ? mealAutoGen : undefined,
        mealLeadDays: mealId ? mealLeadDays : undefined,
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
    (mealId || null) !== (assignedMealProgramId ?? null) ||
    (workoutId && (workoutAutoGen !== (workoutAssignment?.auto_generate_enabled ?? false) || workoutLeadDays !== (workoutAssignment?.autogen_lead_days ?? 2))) ||
    (mealId && (mealAutoGen !== (mealAssignment?.auto_generate_enabled ?? false) || mealLeadDays !== (mealAssignment?.autogen_lead_days ?? 2))) ||
    (workoutId && workoutStartDate !== (workoutAssignment?.start_date ?? nextMonday())) ||
    (mealId && mealStartDate !== (mealAssignment?.start_date ?? nextMonday()));

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
      <div className="p-4 space-y-4">
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
          {workoutId && (
            <div className="mt-3 pl-2 border-l-2 border-neutral-200 space-y-3">
              <div>
                <label htmlFor="workout-start" className={labelClass}>Program start date</label>
                <input
                  id="workout-start"
                  type="date"
                  value={workoutStartDate}
                  onChange={(e) => setWorkoutStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="workout-autogen"
                  type="checkbox"
                  checked={workoutAutoGen}
                  onChange={(e) => setWorkoutAutoGen(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                <label htmlFor="workout-autogen" className="text-sm font-medium text-neutral-700">
                  Auto-generate next week draft
                </label>
              </div>
              {workoutAutoGen && (
                <div>
                  <label htmlFor="workout-lead" className={labelClass}>
                    Generate draft <em>X</em> days before week start
                  </label>
                  <select
                    id="workout-lead"
                    value={workoutLeadDays}
                    onChange={(e) => setWorkoutLeadDays(Number(e.target.value))}
                    className={inputClass}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
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
          {mealId && (
            <div className="mt-3 pl-2 border-l-2 border-neutral-200 space-y-3">
              <div>
                <label htmlFor="meal-start" className={labelClass}>Program start date</label>
                <input
                  id="meal-start"
                  type="date"
                  value={mealStartDate}
                  onChange={(e) => setMealStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="meal-autogen"
                  type="checkbox"
                  checked={mealAutoGen}
                  onChange={(e) => setMealAutoGen(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                <label htmlFor="meal-autogen" className="text-sm font-medium text-neutral-700">
                  Auto-generate next week draft
                </label>
              </div>
              {mealAutoGen && (
                <div>
                  <label htmlFor="meal-lead" className={labelClass}>
                    Generate draft <em>X</em> days before week start
                  </label>
                  <select
                    id="meal-lead"
                    value={mealLeadDays}
                    onChange={(e) => setMealLeadDays(Number(e.target.value))}
                    className={inputClass}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Creates a draft automatically before the week begins. Nothing is sent without approval.
        </p>
      </div>
    </div>
  );
}
