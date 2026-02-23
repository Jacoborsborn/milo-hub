"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import ExpandableImage from "@/components/ui/ExpandableImage";
import {
  getAutomationContext,
  createAutomationAssignment,
  updateProgramAssignment,
  deleteProgramAssignment,
} from "@/lib/services/program-assignments";
import {
  addToAutomationQueue,
  getAutomationQueue,
  removeFromAutomationQueue,
} from "@/lib/offline/automationQueue";

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type AssignmentRow = {
  id: string;
  client_id: string;
  program_id: string | null;
  program_type: string;
  auto_generate_enabled: boolean;
  autogen_lead_days: number;
  paused: boolean;
  active: boolean;
  auto_meals_enabled: boolean;
  auto_workouts_enabled: boolean;
  workout_template_id: string | null;
  meal_template_id: string | null;
  generate_on_dow: number;
  client_name: string;
  workout_template_name: string;
  meal_template_name: string;
};

type Toast = { id: number; message: string; type: "success" | "error" };
let toastId = 0;

export default function AutomationPage() {
  const supabase = supabaseBrowser();

  const [tab, setTab] = useState<"create" | "manage">("manage");
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<{
    clients: { id: string; name: string }[];
    workoutTemplates: { id: string; name: string }[];
    mealTemplates: { id: string; name: string }[];
  } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const loadContext = useCallback(async () => {
    try {
      const data = await getAutomationContext();
      setContext(data);
    } catch {
      setContext({ clients: [], workoutTemplates: [], mealTemplates: [] });
    }
  }, []);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("program_assignments")
      .select(
        "id, client_id, program_id, program_type, auto_generate_enabled, autogen_lead_days, paused, active, auto_meals_enabled, auto_workouts_enabled, workout_template_id, meal_template_id, generate_on_dow"
      )
      .eq("program_type", "combined")
      .order("created_at", { ascending: false });

    if (error) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    const list = (rows ?? []) as Record<string, unknown>[];
    const clientIds = [...new Set(list.map((a) => a.client_id as string).filter(Boolean))];
    const workoutIds = [...new Set(list.map((a) => a.workout_template_id as string).filter(Boolean))];
    const mealIds = [...new Set(list.map((a) => a.meal_template_id as string).filter(Boolean))];
    const programIds = [...new Set(list.map((a) => a.program_id as string).filter(Boolean))];

    const nameByClientId: Record<string, string> = {};
    const nameByWorkoutId: Record<string, string> = {};
    const nameByMealId: Record<string, string> = {};

    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name")
        .in("id", clientIds);
      for (const c of clients ?? []) {
        nameByClientId[c.id] = c.name ?? "—";
      }
    }
    if (workoutIds.length > 0) {
      const { data: templates } = await supabase
        .from("pt_templates")
        .select("id, name")
        .in("id", workoutIds);
      for (const t of templates ?? []) {
        nameByWorkoutId[t.id] = t.name ?? "—";
      }
    }
    if (mealIds.length > 0) {
      const { data: templates } = await supabase
        .from("pt_meal_templates")
        .select("id, name")
        .in("id", mealIds);
      for (const t of templates ?? []) {
        nameByMealId[t.id] = t.name ?? "—";
      }
    }
    for (const id of programIds) {
      if (!nameByWorkoutId[id] && !nameByMealId[id]) {
        const { data: w } = await supabase.from("pt_templates").select("id, name").eq("id", id).maybeSingle();
        const { data: m } = await supabase.from("pt_meal_templates").select("id, name").eq("id", id).maybeSingle();
        if (w) nameByWorkoutId[id] = w.name ?? "—";
        if (m) nameByMealId[m.id] = m.name ?? "—";
      }
    }

    const formatted: AssignmentRow[] = list.map((a) => {
      const workoutId = (a.workout_template_id as string) ?? (a.program_type === "workout" ? (a.program_id as string) : null);
      const mealId = (a.meal_template_id as string) ?? (a.program_type === "meal" ? (a.program_id as string) : null);
      return {
        id: a.id as string,
        client_id: a.client_id as string,
        program_id: (a.program_id as string) ?? null,
        program_type: a.program_type as string,
        auto_generate_enabled: Boolean(a.auto_generate_enabled),
        autogen_lead_days: Number(a.autogen_lead_days),
        paused: Boolean(a.paused),
        active: Boolean(a.active),
        auto_meals_enabled: Boolean(a.auto_meals_enabled ?? true),
        auto_workouts_enabled: Boolean(a.auto_workouts_enabled ?? false),
        workout_template_id: workoutId,
        meal_template_id: mealId,
        generate_on_dow: Number(a.generate_on_dow ?? 6),
        client_name: nameByClientId[a.client_id as string] ?? "—",
        workout_template_name: workoutId ? (nameByWorkoutId[workoutId] ?? "—") : "—",
        meal_template_name: mealId ? (nameByMealId[mealId] ?? "—") : "—",
      };
    });
    setAssignments(formatted);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Flush offline automation queue on load and when coming back online
  const flushAutomationQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const items = await getAutomationQueue();
      for (const item of items) {
        try {
          await createAutomationAssignment(item.payload);
          await removeFromAutomationQueue(item.id);
        } catch (e) {
          addToast(
            e instanceof Error ? e.message : "Failed to save queued automation.",
            "error"
          );
        }
      }
      if (items.length > 0) {
        loadAssignments();
      }
    } catch {
      // IndexedDB not available or get failed
    }
  }, [loadAssignments]);

  useEffect(() => {
    flushAutomationQueue();
    const handleOnline = () => flushAutomationQueue();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushAutomationQueue]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Automation</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Automatically generate weekly draft plans before they begin. Nothing is sent without your approval.
        </p>
      </header>

      <section className="bg-white border border-neutral-200 rounded-xl shadow-sm p-6 space-y-6">
        <h2 className="text-xl font-semibold text-neutral-900">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <ExpandableImage
              src="/automation/automation-step-1.png"
              alt="Create Automation step"
              containerClassName="relative w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
              imageWrapperClassName="relative h-32 w-full cursor-pointer"
            />
            <h3 className="font-medium text-neutral-900">1. Create Automation</h3>
            <p className="text-sm text-neutral-500">
              Pick a client, turn on Auto-generate Meals and/or Workouts, choose templates for each, and the day to run. One combined automation per client.
            </p>
          </div>
          <div className="space-y-3">
            <ExpandableImage
              src="/automation/automation-step-2.png"
              alt="Draft created on your chosen day"
              containerClassName="relative w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
              imageWrapperClassName="relative h-32 w-full cursor-pointer"
            />
            <h3 className="font-medium text-neutral-900">2. Draft created on your chosen day</h3>
            <p className="text-sm text-neutral-500">
              On that day the system creates next week&apos;s meal and/or workout drafts. You&apos;ll see them on the dashboard; nothing is sent without approval.
            </p>
          </div>
          <div className="space-y-3">
            <ExpandableImage
              src="/automation/automation-step-3.png"
              alt="Review and send"
              containerClassName="relative w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100"
              imageWrapperClassName="relative h-32 w-full cursor-pointer"
            />
            <h3 className="font-medium text-neutral-900">3. Review & Approve</h3>
            <p className="text-sm text-neutral-500">
              Edit if needed, then approve and send. Automation never sends automatically.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${
              tab === "create"
                ? "bg-neutral-900 text-white"
                : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            Create Automation
          </button>
          <button
            type="button"
            onClick={() => setTab("manage")}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
              tab === "manage"
                ? "bg-neutral-900 text-white"
                : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            Manage Automations
          </button>
        </div>

        {tab === "create" && (
          context == null ? (
            <p className="text-neutral-500 py-4">Loading form…</p>
          ) : (
          <CreateAutomationForm
            context={context}
            onScheduled={(clientName) => {
              addToast(`Automation scheduled for ${clientName}`, "success");
              loadAssignments();
              setTab("manage");
            }}
            onError={(msg) => addToast(msg, "error")}
            onOfflineQueued={() =>
              addToast("You're offline — this will be saved when you reconnect.", "success")
            }
          />
          )
        )}

        {tab === "manage" && (
          <ManageAutomations
            assignments={assignments}
            loading={loading}
            context={context}
            onRefresh={loadAssignments}
            deleteConfirmId={deleteConfirmId}
            onDeleteConfirm={setDeleteConfirmId}
            addToast={addToast}
          />
        )}
      </section>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border px-4 py-2 text-sm shadow-lg ${
                t.type === "success"
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateAutomationForm({
  context,
  onScheduled,
  onError,
  onOfflineQueued,
}: {
  context: { clients: { id: string; name: string }[]; workoutTemplates: { id: string; name: string }[]; mealTemplates: { id: string; name: string }[] } | null;
  onScheduled: (clientName: string) => void;
  onError: (message: string) => void;
  onOfflineQueued?: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [autoMealsEnabled, setAutoMealsEnabled] = useState(true);
  const [autoWorkoutsEnabled, setAutoWorkoutsEnabled] = useState(false);
  const [workoutTemplateId, setWorkoutTemplateId] = useState("");
  const [mealTemplateId, setMealTemplateId] = useState("");
  const [generateOnDow, setGenerateOnDow] = useState(6);
  const [submitting, setSubmitting] = useState(false);

  const handleSchedule = async () => {
    if (!clientId) {
      onError("Please select a client.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        client_id: clientId,
        workout_template_id: autoWorkoutsEnabled ? (workoutTemplateId || null) : null,
        meal_template_id: autoMealsEnabled ? (mealTemplateId || null) : null,
        generate_on_dow: generateOnDow,
        auto_meals_enabled: autoMealsEnabled,
        auto_workouts_enabled: autoWorkoutsEnabled,
      };
      if (!navigator.onLine) {
        await addToAutomationQueue(payload);
        onOfflineQueued?.();
        setSubmitting(false);
        return;
      }
      await createAutomationAssignment(payload);
      const clientName = context?.clients.find((c) => c.id === clientId)?.name ?? "Client";
      onScheduled(clientName);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to schedule automation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-neutral-200 rounded-xl bg-neutral-50/80 p-6">
      <h3 className="text-lg font-semibold text-neutral-900 mb-4">Create Automation</h3>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm"
          >
            <option value="">Select client</option>
            {(context?.clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="create-auto-meals"
            checked={autoMealsEnabled}
            onChange={(e) => setAutoMealsEnabled(e.target.checked)}
            className="rounded border-neutral-300"
          />
          <label htmlFor="create-auto-meals" className="text-sm font-medium text-neutral-700">Auto-generate Meals</label>
        </div>
        <div className={!autoMealsEnabled ? "opacity-60" : ""}>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Meal template</label>
          <select
            value={mealTemplateId}
            onChange={(e) => setMealTemplateId(e.target.value)}
            disabled={!autoMealsEnabled}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm disabled:bg-neutral-100"
          >
            <option value="">Select template</option>
            {(context?.mealTemplates ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="create-auto-workouts"
            checked={autoWorkoutsEnabled}
            onChange={(e) => setAutoWorkoutsEnabled(e.target.checked)}
            className="rounded border-neutral-300"
          />
          <label htmlFor="create-auto-workouts" className="text-sm font-medium text-neutral-700">Auto-generate Workouts</label>
        </div>
        <div className={!autoWorkoutsEnabled ? "opacity-60" : ""}>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Workout template</label>
          <select
            value={workoutTemplateId}
            onChange={(e) => setWorkoutTemplateId(e.target.value)}
            disabled={!autoWorkoutsEnabled}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm disabled:bg-neutral-100"
          >
            <option value="">Select template</option>
            {(context?.workoutTemplates ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Generate day</label>
          <select
            value={generateOnDow}
            onChange={(e) => setGenerateOnDow(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm"
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-neutral-500">
          Creates a draft on your chosen day. Nothing is sent without approval.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSchedule}
            disabled={submitting}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {submitting ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageAutomations({
  assignments,
  loading,
  context,
  onRefresh,
  deleteConfirmId,
  onDeleteConfirm,
  addToast,
}: {
  assignments: AssignmentRow[];
  loading: boolean;
  context: { clients: { id: string; name: string }[]; workoutTemplates: { id: string; name: string }[]; mealTemplates: { id: string; name: string }[] } | null;
  onRefresh: () => void;
  deleteConfirmId: string | null;
  onDeleteConfirm: (id: string | null) => void;
  addToast: (message: string, type: "success" | "error") => void;
}) {
  const handleToggleOnOff = async (id: string, value: boolean) => {
    try {
      await updateProgramAssignment(id, { auto_generate_enabled: value });
      onRefresh();
      addToast(value ? "Automation turned on." : "Automation turned off.", "success");
    } catch {
      addToast("Failed to update.", "error");
    }
  };

  const handlePauseResume = async (id: string, value: boolean) => {
    try {
      await updateProgramAssignment(id, { paused: value });
      onRefresh();
      addToast(value ? "Automation paused." : "Automation resumed.", "success");
    } catch {
      addToast("Failed to update.", "error");
    }
  };

  const handleDayChange = async (id: string, generate_on_dow: number) => {
    try {
      await updateProgramAssignment(id, { generate_on_dow });
      onRefresh();
      addToast("Generate day updated.", "success");
    } catch {
      addToast("Failed to update.", "error");
    }
  };

  const handleTemplatesChange = async (
    id: string,
    workout_template_id: string | null,
    meal_template_id: string | null
  ) => {
    try {
      await updateProgramAssignment(id, { workout_template_id, meal_template_id });
      onRefresh();
      addToast("Templates updated.", "success");
    } catch {
      addToast("Failed to update.", "error");
    }
  };

  const handleAutoMealsChange = async (id: string, value: boolean) => {
    try {
      await updateProgramAssignment(id, { auto_meals_enabled: value });
      onRefresh();
      addToast(value ? "Auto-generate Meals on." : "Auto-generate Meals off.", "success");
    } catch {
      addToast("Failed to update.", "error");
    }
  };

  const handleAutoWorkoutsChange = async (id: string, value: boolean) => {
    try {
      await updateProgramAssignment(id, { auto_workouts_enabled: value });
      onRefresh();
      addToast(value ? "Auto-generate Workouts on." : "Auto-generate Workouts off.", "success");
    } catch {
      addToast("Failed to update.", "error");
    }
  };

  const handleDelete = async (id: string, clientName: string) => {
    try {
      await deleteProgramAssignment(id);
      onDeleteConfirm(null);
      onRefresh();
      addToast("Automation deleted.", "success");
    } catch {
      addToast("Failed to delete.", "error");
    }
  };

  if (loading) {
    return <p className="text-neutral-500">Loading automations…</p>;
  }

  if (assignments.length === 0) {
    return (
      <p className="text-neutral-500 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 py-8 px-4 text-center">
        No automations yet. Create one to start generating weekly drafts automatically.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {assignments.map((a) => (
        <div
          key={a.id}
          className="border border-neutral-200 rounded-lg p-4 flex flex-col gap-4 bg-neutral-50/50"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <p className="font-medium text-neutral-900">{a.client_name}</p>
              <p className="text-sm text-neutral-500">
                Meals: {a.auto_meals_enabled ? a.meal_template_name : "Off"} · Workouts: {a.auto_workouts_enabled ? a.workout_template_name : "Off"} · {DAYS[a.generate_on_dow]?.label ?? "Saturday"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill
                auto_generate_enabled={a.auto_generate_enabled}
                paused={a.paused}
                active={a.active}
              />
              <Link
                href={`/pt/app/clients/${a.client_id}`}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                View Client
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleToggleOnOff(a.id, !a.auto_generate_enabled)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                a.auto_generate_enabled
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
              }`}
            >
              {a.auto_generate_enabled ? "On" : "Off"}
            </button>
            <button
              type="button"
              onClick={() => handlePauseResume(a.id, !a.paused)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium bg-amber-100 text-amber-900 hover:bg-amber-200"
            >
              {a.paused ? "Resume" : "Pause"}
            </button>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={a.auto_meals_enabled}
                onChange={(e) => handleAutoMealsChange(a.id, e.target.checked)}
                className="rounded border-neutral-300"
              />
              <span>Meals</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={a.auto_workouts_enabled}
                onChange={(e) => handleAutoWorkoutsChange(a.id, e.target.checked)}
                className="rounded border-neutral-300"
              />
              <span>Workouts</span>
            </label>
            <select
              value={a.generate_on_dow}
              onChange={(e) => handleDayChange(a.id, Number(e.target.value))}
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
            >
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <select
              value={a.workout_template_id ?? ""}
              onChange={(e) => handleTemplatesChange(a.id, e.target.value || null, a.meal_template_id)}
              disabled={!a.auto_workouts_enabled}
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 max-w-[180px] disabled:bg-neutral-100 disabled:opacity-70"
            >
              <option value="">No workout</option>
              {(context?.workoutTemplates ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={a.meal_template_id ?? ""}
              onChange={(e) => handleTemplatesChange(a.id, a.workout_template_id, e.target.value || null)}
              disabled={!a.auto_meals_enabled}
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 max-w-[180px] disabled:bg-neutral-100 disabled:opacity-70"
            >
              <option value="">No meal</option>
              {(context?.mealTemplates ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {deleteConfirmId === a.id ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-amber-700">Delete automation for {a.client_name}? This stops future drafts but will not delete existing plans.</span>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.client_name)}
                  className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteConfirm(null)}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onDeleteConfirm(a.id)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({
  auto_generate_enabled,
  paused,
  active,
}: {
  auto_generate_enabled: boolean;
  paused: boolean;
  active: boolean;
}) {
  let label = "Off";
  let className = "bg-neutral-200 text-neutral-700";
  if (active && auto_generate_enabled && !paused) {
    label = "Active";
    className = "bg-green-100 text-green-800";
  } else if (paused) {
    label = "Paused";
    className = "bg-amber-100 text-amber-800";
  } else if (!auto_generate_enabled) {
    label = "Off";
    className = "bg-neutral-200 text-neutral-600";
  } else if (!active) {
    label = "Off";
    className = "bg-neutral-200 text-neutral-600";
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
