"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const inputClass =
  "w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400";
const labelClass = "block text-sm font-medium text-neutral-700 mb-1";
const sectionTitleClass = "text-xs font-semibold uppercase tracking-wide text-neutral-500";

function formatLabel(value: string): string {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type TemplateRow = {
  id: string;
  name: string;
  goal: string;
  experience_level: string;
  days_per_week: number;
  equipment_type: string;
  duration_weeks: number;
};

export default function EditTemplatePage() {
  const params = useParams<{ templateId: string }>();
  const router = useRouter();
  const templateId = params?.templateId as string;

  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("hypertrophy");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [equipmentType, setEquipmentType] = useState("gym");
  const [durationWeeks, setDurationWeeks] = useState(8);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/pt/auth/login");
        return;
      }
      const { data, error: fetchError } = await supabase
        .from("pt_templates")
        .select("id,name,goal,experience_level,days_per_week,equipment_type,duration_weeks")
        .eq("id", templateId)
        .single();
      if (cancelled) return;
      if (fetchError || !data) {
        setError(fetchError?.message ?? "Program not found");
        setTemplate(null);
      } else {
        const row = data as TemplateRow;
        setTemplate(row);
        setName(row.name ?? "");
        setGoal(row.goal ?? "hypertrophy");
        setExperienceLevel(row.experience_level ?? "beginner");
        setDaysPerWeek(row.days_per_week ?? 4);
        setEquipmentType(row.equipment_type ?? "gym");
        setDurationWeeks(row.duration_weeks ?? 8);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, router]);

  const handleSave = async () => {
    if (!templateId || !template) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("pt_templates")
        .update({
          name: name.trim() || template.name,
          goal,
          experience_level: experienceLevel,
          days_per_week: daysPerWeek,
          equipment_type: equipmentType,
          duration_weeks: durationWeeks,
        })
        .eq("id", templateId);
      if (updateError) throw updateError;
      router.push("/templates");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const summaryParts = [
    `${durationWeeks} weeks`,
    `${daysPerWeek} days/week`,
    formatLabel(goal),
    formatLabel(experienceLevel),
    formatLabel(equipmentType),
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <Link href="/templates" className="text-sm text-neutral-600 hover:text-neutral-900">
            ← Back to Programs
          </Link>
        </div>
        <p className="text-neutral-500">Loading program…</p>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <Link href="/templates" className="text-sm text-neutral-600 hover:text-neutral-900">
            ← Back to Programs
          </Link>
        </div>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[680px] px-4 pt-8 pb-12 sm:px-6">
      <div className="mb-6">
        <Link href="/templates" className="text-sm text-neutral-600 hover:text-neutral-900">
          ← Back to Programs
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900 sm:text-2xl">Edit Program Blueprint</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Update this program. Existing plans using it are unchanged.
          </p>
        </header>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {/* Section A: Program Identity */}
        <section className="mb-8">
          <h2 className={sectionTitleClass}>Program Identity</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label htmlFor="name" className={labelClass}>Program name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Hypertrophy 4-day"
              />
            </div>
            <div>
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
            onClick={handleSave}
            disabled={saving}
            className="order-1 min-h-[44px] rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:order-2"
          >
            {saving ? "Saving…" : "Save program"}
          </button>
        </div>
      </div>
    </div>
  );
}
