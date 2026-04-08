"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputClass = "w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400";
const labelClass = "block text-sm font-medium text-neutral-700 mb-1";
const sectionTitleClass = "text-xs font-semibold uppercase tracking-wide text-neutral-500";

function formatLabel(value: string): string {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CreateTemplatePage() {
  const router = useRouter();

  const [goal, setGoal] = useState("hypertrophy");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [equipmentType, setEquipmentType] = useState("gym");
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    try {
      setLoading(true);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session || !session.user) {
        router.push("/pt/auth/login");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pt-template-generator`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            goal,
            experience_level: experienceLevel,
            days_per_week: daysPerWeek,
            equipment_type: equipmentType,
            duration_weeks: durationWeeks
          })
        }
      );

      if (!response.ok) {
        throw new Error("Program generator failed");
      }

      const body = await response.json();
      const suggested_name = body.suggested_name;
      const blueprint_json = body.blueprint_json ?? null;
      if (!blueprint_json) throw new Error("Program generator returned no blueprint");

      const { error } = await supabase.from("pt_templates").insert([
        {
          pt_user_id: session.user.id,
          name: suggested_name,
          goal,
          experience_level: experienceLevel,
          days_per_week: daysPerWeek,
          equipment_type: equipmentType,
          duration_weeks: durationWeeks,
          blueprint_json,
        },
      ]);

      if (error) throw error;

      router.push("/templates");

    } catch (err) {
      console.error(err);
      alert("Failed to create program");
    } finally {
      setLoading(false);
    }
  };

  const summaryParts = [
    `${durationWeeks} weeks`,
    `${daysPerWeek} days/week`,
    formatLabel(goal),
    formatLabel(experienceLevel),
    formatLabel(equipmentType),
  ].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[680px] px-4 pt-8 pb-12 sm:px-6">
      <div className="mb-6">
        <Link href="/templates" className="text-sm text-neutral-600 hover:text-neutral-900">
          ← Back to Programs
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900 sm:text-2xl">New Program</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Define a reusable program blueprint you can assign to clients.
          </p>
        </header>

        {/* Section A: Program Identity */}
        <section className="mb-8">
          <h2 className={sectionTitleClass}>Program Identity</h2>
          <div className="mt-3">
            <label htmlFor="duration" className={labelClass}>Duration (weeks)</label>
            <input
              id="duration"
              type="number"
              min={4}
              max={16}
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        </section>

        <div className="border-t border-neutral-200" />

        {/* Section B: Training Structure */}
        <section className="mb-8 pt-6">
          <h2 className={sectionTitleClass}>Training Structure</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="days" className={labelClass}>Days per week</label>
              <input
                id="days"
                type="number"
                min={1}
                max={7}
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="goal" className={labelClass}>Goal</label>
              <select
                id="goal"
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

        {/* Section C: Designed For */}
        <section className="mb-8 pt-6">
          <h2 className={sectionTitleClass}>Designed For</h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="experience" className={labelClass}>Experience level</label>
              <select
                id="experience"
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
              <label htmlFor="equipment" className={labelClass}>Equipment type</label>
              <select
                id="equipment"
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

        {/* Blueprint Summary */}
        <section className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 mb-8">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Blueprint Summary</p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            {summaryParts.join(" • ")}
          </p>
        </section>

        {/* Actions */}
        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/templates"
            className="order-2 min-h-[44px] inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-6 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 sm:order-1"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="order-1 min-h-[44px] rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:order-2"
          >
            {loading ? "Saving…" : "Save program"}
          </button>
        </div>
      </div>
    </div>
  );
}
