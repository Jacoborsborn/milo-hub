"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/browser";
import { createMealTemplate } from "@/lib/services/meal-templates";

const inputClass =
  "w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400";
const labelClass = "block text-sm font-medium text-neutral-700 mb-1";
const sectionTitleClass = "text-xs font-semibold uppercase tracking-wide text-neutral-500";

function formatLabel(value: string): string {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type ProgramType = "workout" | "meal";

type CreateProgramModalProps = {
  open: boolean;
  defaultType: ProgramType;
  onClose: () => void;
  onWorkoutCreated: () => void;
  onMealCreated: () => void;
};

export default function CreateProgramModal({
  open,
  defaultType,
  onClose,
  onWorkoutCreated,
  onMealCreated,
}: CreateProgramModalProps) {
  const [programType, setProgramType] = useState<ProgramType>(defaultType);

  // Workout form state
  const [workoutName, setWorkoutName] = useState("");
  const [goal, setGoal] = useState("hypertrophy");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [equipmentType, setEquipmentType] = useState("gym");
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [workoutLoading, setWorkoutLoading] = useState(false);

  // Meal form state
  const [mealName, setMealName] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("balanced");
  const [mealsPerDay, setMealsPerDay] = useState(4);
  const [days, setDays] = useState(7);
  const [dietGoal, setDietGoal] = useState("maintain");
  const [mealLoading, setMealLoading] = useState(false);

  useEffect(() => {
    setProgramType(defaultType);
  }, [defaultType, open]);

  const handleWorkoutCreate = async () => {
    try {
      setWorkoutLoading(true);
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        window.location.href = "/pt/auth/login";
        return;
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pt-template-generator`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            goal,
            experience_level: experienceLevel,
            days_per_week: daysPerWeek,
            equipment_type: equipmentType,
            duration_weeks: durationWeeks,
          }),
        }
      );
      if (!response.ok) throw new Error("Program generator failed");
      const body = await response.json();
      const suggested_name = body.suggested_name;
      const blueprint_json = body.blueprint_json ?? null;
      if (!blueprint_json) throw new Error("Program generator returned no blueprint");
      const { error } = await supabase.from("pt_templates").insert([
        {
          pt_user_id: session.user.id,
          name: workoutName.trim() || suggested_name,
          goal,
          experience_level: experienceLevel,
          days_per_week: daysPerWeek,
          equipment_type: equipmentType,
          duration_weeks: durationWeeks,
          blueprint_json,
        },
      ]);
      if (error) throw error;
      onWorkoutCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to create program");
    } finally {
      setWorkoutLoading(false);
    }
  };

  const programDefaultsPayload = () => ({
    dietaryPreference,
    mealsPerDay,
    days,
    dietGoal,
    caloriesTargetPerDay: 2000,
    budgetTier: "medium",
    allergies: [] as string[],
    restrictions: [] as string[],
  });

  const handleMealCreate = async () => {
    try {
      setMealLoading(true);
      await createMealTemplate({
        name: mealName.trim() || "Meal program",
        defaults: programDefaultsPayload(),
      });
      onMealCreated();
      onClose();
      setMealName("");
      setDietaryPreference("balanced");
      setMealsPerDay(4);
      setDays(7);
      setDietGoal("maintain");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save program");
    } finally {
      setMealLoading(false);
    }
  };

  if (!open) return null;

  const summaryParts =
    programType === "workout"
      ? [
          `${durationWeeks} weeks`,
          `${daysPerWeek} days/week`,
          formatLabel(goal),
          formatLabel(experienceLevel),
          formatLabel(equipmentType),
        ].filter(Boolean)
      : [];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className="mx-auto w-full max-w-[680px] rounded-2xl border border-neutral-200 bg-white shadow-xl sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="mb-6">
            <h1 className="text-xl font-semibold text-neutral-900 sm:text-2xl">New Program</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Define a reusable program blueprint you can assign to clients.
            </p>
          </header>

          {/* Program type toggle */}
          <div className="mb-6 flex gap-1 rounded-lg bg-neutral-100 p-1">
            <button
              type="button"
              onClick={() => setProgramType("workout")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${
                programType === "workout"
                  ? "bg-white text-neutral-900 shadow"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Workout
            </button>
            <button
              type="button"
              onClick={() => setProgramType("meal")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium ${
                programType === "meal"
                  ? "bg-white text-neutral-900 shadow"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              Meal
            </button>
          </div>

          {programType === "workout" && (
            <>
              <section className="mb-8">
                <h2 className={sectionTitleClass}>Program Identity</h2>
                <div className="mt-3 space-y-4">
                  <div>
                    <label htmlFor="modal-workout-name" className={labelClass}>
                      Name
                    </label>
                    <input
                      id="modal-workout-name"
                      type="text"
                      value={workoutName}
                      onChange={(e) => setWorkoutName(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 4-day Hypertrophy Block"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      Leave blank to use an auto-generated name.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="modal-duration" className={labelClass}>
                      Duration (weeks)
                    </label>
                    <input
                      id="modal-duration"
                      type="number"
                      min={4}
                      max={16}
                      value={durationWeeks}
                      onChange={(e) => setDurationWeeks(Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>
              <div className="border-t border-neutral-200" />
              <section className="mb-8 pt-6">
                <h2 className={sectionTitleClass}>Training Structure</h2>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="modal-days" className={labelClass}>
                      Days per week
                    </label>
                    <input
                      id="modal-days"
                      type="number"
                      min={1}
                      max={7}
                      value={daysPerWeek}
                      onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-goal" className={labelClass}>
                      Goal
                    </label>
                    <select
                      id="modal-goal"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      className={inputClass}
                    >
                      <option value="fat_loss">Fat Loss</option>
                      <option value="hypertrophy">Hypertrophy</option>
                      <option value="strength">Strength</option>
                      <option value="recomposition">Recomposition</option>
                    </select>
                  </div>
                </div>
              </section>
              <div className="border-t border-neutral-200" />
              <section className="mb-8 pt-6">
                <h2 className={sectionTitleClass}>Designed For</h2>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="modal-experience" className={labelClass}>
                      Experience level
                    </label>
                    <select
                      id="modal-experience"
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                      className={inputClass}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="modal-equipment" className={labelClass}>
                      Equipment type
                    </label>
                    <select
                      id="modal-equipment"
                      value={equipmentType}
                      onChange={(e) => setEquipmentType(e.target.value)}
                      className={inputClass}
                    >
                      <option value="gym">Gym</option>
                      <option value="home">Home</option>
                      <option value="minimal">Minimal</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                </div>
              </section>
              <section className="mb-8 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Blueprint Summary
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-800">
                  {summaryParts.join(" • ")}
                </p>
              </section>
            </>
          )}

          {programType === "meal" && (
            <>
              <p className="mb-4 text-xs text-neutral-500">
                Calories, budget, and restrictions come from the client profile when you generate a
                draft.
              </p>
              <section className="mb-6">
                <label htmlFor="modal-meal-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="modal-meal-name"
                  type="text"
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Standard 7-day"
                />
              </section>
              <section className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modal-diet" className={labelClass}>
                    Diet
                  </label>
                  <select
                    id="modal-diet"
                    value={dietaryPreference}
                    onChange={(e) => setDietaryPreference(e.target.value)}
                    className={inputClass}
                  >
                    <option value="balanced">Balanced</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="pescatarian">Pescatarian</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="modal-meals-per-day" className={labelClass}>
                    Meals/day
                  </label>
                  <select
                    id="modal-meals-per-day"
                    value={mealsPerDay}
                    onChange={(e) => setMealsPerDay(Number(e.target.value))}
                    className={inputClass}
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="modal-days" className={labelClass}>
                    Days
                  </label>
                  <select
                    id="modal-days-meal"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className={inputClass}
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={7}>7</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="modal-goal-meal" className={labelClass}>
                    Goal
                  </label>
                  <select
                    id="modal-goal-meal"
                    value={dietGoal}
                    onChange={(e) => setDietGoal(e.target.value)}
                    className={inputClass}
                  >
                    <option value="maintain">Maintain</option>
                    <option value="lose">Lose</option>
                    <option value="gain">Gain</option>
                  </select>
                </div>
              </section>
            </>
          )}

          <div className="flex flex-col gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="order-2 min-h-[44px] inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-6 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 sm:order-1"
            >
              Cancel
            </button>
            {programType === "workout" ? (
              <button
                type="button"
                onClick={handleWorkoutCreate}
                disabled={workoutLoading}
                className="order-1 min-h-[44px] rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:order-2"
              >
                {workoutLoading ? "Saving…" : "Save program"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleMealCreate}
                disabled={mealLoading}
                className="order-1 min-h-[44px] rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:order-2"
              >
                {mealLoading ? "Saving…" : "Save program"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
