"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { parseWorkoutPreset, workoutPresetToGeneratorInputs } from "@/types/presets";

type ClientOption = {
  id: string;
  name: string;
  assigned_workout_program_id: string | null;
  assigned_meal_program_id: string | null;
  presets_json?: { workout?: unknown } | null;
};
type TemplateOption = { id: string; name: string };
type JobType = "workout" | "meal" | "both";
type JobStatus = "queued" | "running" | "succeeded" | "failed";

interface PlanJobRow {
  id: string;
  client_id: string;
  job_type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  result_plan_ids: string[] | null;
  error: string | null;
  created_at: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_IDLE_MS = 20000; // when no queued/running jobs, poll less often
const TOAST_DURATION_MS = 4000;

export default function GenerateDrawer({
  open,
  onClose,
  initialClientId,
}: {
  open: boolean;
  onClose: () => void;
  initialClientId?: string;
}) {
  const pathname = usePathname() ?? "";
  const [tab, setTab] = useState<"single" | "batch" | "queue">("single");
  const [context, setContext] = useState<{
    clients: ClientOption[];
    workoutTemplates: TemplateOption[];
    mealTemplates: TemplateOption[];
  } | null>(null);
  const [jobs, setJobs] = useState<PlanJobRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Single tab state
  const clientIdFromPath = pathname.match(/^\/pt\/app\/clients\/([^/]+)$/)?.[1] ?? null;
  const [singleClientId, setSingleClientId] = useState<string>("");
  const [singleWorkoutId, setSingleWorkoutId] = useState<string>("");
  const [singleMealId, setSingleMealId] = useState<string>("");
  const [singleJobType, setSingleJobType] = useState<JobType>("workout");
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [pendingSingleJobId, setPendingSingleJobId] = useState<string | null>(null);

  // Batch tab state
  const [batchSearch, setBatchSearch] = useState("");
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [batchOverrideWorkoutId, setBatchOverrideWorkoutId] = useState<string>("");
  const [batchOverrideMealId, setBatchOverrideMealId] = useState<string>("");
  const [batchJobType, setBatchJobType] = useState<JobType>("workout");
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [pendingBatchJobIds, setPendingBatchJobIds] = useState<string[]>([]);

  const fetchContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const res = await fetch("/api/generate-context");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setContext({
        clients: data.clients ?? [],
        workoutTemplates: data.workoutTemplates ?? [],
        mealTemplates: data.mealTemplates ?? [],
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingContext(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) return;
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchContext();
      fetchJobs();
    }
  }, [open, fetchContext, fetchJobs]);

  const hasActiveJobs = jobs.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!open) return;
    const interval = hasActiveJobs ? POLL_INTERVAL_MS : POLL_IDLE_MS;
    const t = setInterval(fetchJobs, interval);
    return () => clearInterval(t);
  }, [open, fetchJobs, hasActiveJobs]);

  // Pre-fill single client when opened from client page or ?client= query
  const preferredClientId = clientIdFromPath || initialClientId;
  useEffect(() => {
    if (open && context && preferredClientId && context.clients.some((c) => c.id === preferredClientId)) {
      setSingleClientId(preferredClientId);
      const client = context.clients.find((c) => c.id === preferredClientId);
      if (client) {
        if (client.assigned_workout_program_id) setSingleWorkoutId(client.assigned_workout_program_id);
        if (client.assigned_meal_program_id) setSingleMealId(client.assigned_meal_program_id);
      }
    }
  }, [open, context, preferredClientId]);

  // Toast when jobs complete
  const prevJobsRef = useState<PlanJobRow[]>([])[0];
  useEffect(() => {
    if (jobs.length === 0) return;
    const prevSucceeded = new Set((prevJobsRef as PlanJobRow[]).filter((j) => j.status === "succeeded").map((j) => j.id));
    const justSucceeded = jobs.filter((j) => j.status === "succeeded" && !prevSucceeded.has(j.id));
    if (justSucceeded.length > 0) {
      setToast(`${justSucceeded.length} plan(s) ready`);
      setTimeout(() => setToast(null), TOAST_DURATION_MS);
    }
    prevJobsRef.length = 0;
    prevJobsRef.push(...jobs);
  }, [jobs]);

  // Drive single "Generating..." from job status so the button doesn't get stuck
  useEffect(() => {
    if (!pendingSingleJobId || jobs.length === 0) return;
    const job = jobs.find((j) => j.id === pendingSingleJobId);
    if (job && (job.status === "succeeded" || job.status === "failed")) {
      setPendingSingleJobId(null);
      setSingleSubmitting(false);
    }
  }, [jobs, pendingSingleJobId]);

  // Drive batch "Queuing…" / submitting from job status
  useEffect(() => {
    if (pendingBatchJobIds.length === 0) return;
    const allTerminal = pendingBatchJobIds.every((id) => {
      const job = jobs.find((j) => j.id === id);
      return job && (job.status === "succeeded" || job.status === "failed");
    });
    if (allTerminal) {
      setPendingBatchJobIds([]);
      setBatchSubmitting(false);
    }
  }, [jobs, pendingBatchJobIds]);

  const runSingle = async () => {
    if (!singleClientId || singleSubmitting) return;
    const client = context?.clients.find((c) => c.id === singleClientId);
    const workoutId = singleWorkoutId || (client?.assigned_workout_program_id ?? "");
    const mealId = singleMealId || (client?.assigned_meal_program_id ?? "");
    // Workout: use AI generator when client has workout presets; otherwise require template (pt-plan-generator).
    const hasWorkoutPresets = client?.presets_json?.workout != null;
    if ((singleJobType === "workout" || singleJobType === "both") && !hasWorkoutPresets && !workoutId) {
      setToast("Assign a workout program or set client workout presets first.");
      return;
    }
    if ((singleJobType === "meal" || singleJobType === "both") && !mealId) {
      setToast("Assign a meal program first.");
      return;
    }
    setSingleSubmitting(true);
    setPendingSingleJobId(null);
    try {
      const payload: Record<string, unknown> = { client_name: client?.name };
      if (singleJobType === "workout" || singleJobType === "both") {
        if (hasWorkoutPresets) {
          const preset = parseWorkoutPreset(client!.presets_json!.workout);
          payload.workoutInputs = workoutPresetToGeneratorInputs(preset);
        } else if (workoutId) {
          payload.workout_template_id = workoutId;
        }
      }
      if (mealId) payload.meal_template_id = mealId;
      const createRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: singleClientId,
          job_type: singleJobType,
          payload,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create job");
      }
      const { jobId } = await createRes.json();
      setPendingSingleJobId(jobId);
      fetchJobs();
      setTab("queue");
      fetch(`/api/jobs/${jobId}/process`, { method: "POST", credentials: "include" });
      setToast("Job queued. Check Queue for status.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed");
      setSingleSubmitting(false);
    }
  };

  const runBatch = async () => {
    const ids = Array.from(batchSelectedIds);
    if (ids.length === 0 || batchSubmitting) return;
    const useOverrideWorkout = !!batchOverrideWorkoutId;
    const useOverrideMeal = !!batchOverrideMealId;
    setBatchSubmitting(true);
    try {
      const jobSpecs = ids.map((client_id) => {
        const client = context?.clients.find((c) => c.id === client_id);
        const payload: Record<string, unknown> = { client_name: client?.name };
        if (batchJobType === "workout" || batchJobType === "both") {
          const hasWorkoutPresets = client?.presets_json?.workout != null;
          if (hasWorkoutPresets) {
            const preset = parseWorkoutPreset(client!.presets_json!.workout);
            payload.workoutInputs = workoutPresetToGeneratorInputs(preset);
          } else if (useOverrideWorkout) {
            payload.workout_template_id = batchOverrideWorkoutId;
          } else if (client?.assigned_workout_program_id) {
            payload.workout_template_id = client.assigned_workout_program_id;
          }
        }
        if (useOverrideMeal) payload.meal_template_id = batchOverrideMealId;
        else if (client?.assigned_meal_program_id) payload.meal_template_id = client.assigned_meal_program_id;
        return { client_id, job_type: batchJobType, payload };
      });
      const createRes = await fetch("/api/jobs/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: jobSpecs }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create jobs");
      }
      const { jobIds } = await createRes.json();
      setPendingBatchJobIds(jobIds ?? []);
      fetchJobs();
      setTab("queue");
      (jobIds ?? []).forEach((jobId: string) => {
        fetch(`/api/jobs/${jobId}/process`, { method: "POST", credentials: "include" });
      });
      setToast(`Queued ${jobIds.length} job(s). Check Queue for status.`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed");
      setBatchSubmitting(false);
    }
  };

  const retryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/process`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Retry failed");
      fetchJobs();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Retry failed");
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Cancel failed");
      fetchJobs();
      setToast("Job cancelled");
      setTimeout(() => setToast(null), TOAST_DURATION_MS);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  if (!open) return null;

  const filteredBatchClients =
    context?.clients.filter(
      (c) => !batchSearch.trim() || c.name.toLowerCase().includes(batchSearch.trim().toLowerCase())
    ) ?? [];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col"
        role="dialog"
        aria-label="Generate plans"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h2 className="text-lg font-semibold">Generate</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-neutral-100 text-neutral-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex border-b border-neutral-100">
          {(["single", "batch", "queue"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize ${
                tab === t ? "border-b-2 border-black text-black" : "text-neutral-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {toast && (
            <div className="mb-3 py-2 px-3 rounded bg-neutral-800 text-white text-sm text-center">
              {toast}
            </div>
          )}

          {loadingContext && !context && (
            <p className="text-sm text-neutral-500">Loading…</p>
          )}

          {context && tab === "single" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Client</label>
                <select
                  value={singleClientId}
                  onChange={(e) => {
                    setSingleClientId(e.target.value);
                    const c = context.clients.find((x) => x.id === e.target.value);
                    if (c) {
                      setSingleWorkoutId(c.assigned_workout_program_id ?? "");
                      setSingleMealId(c.assigned_meal_program_id ?? "");
                    }
                  }}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  {context.clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Workout program</label>
                <select
                  value={singleWorkoutId}
                  onChange={(e) => setSingleWorkoutId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {context.workoutTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Meal program</label>
                <select
                  value={singleMealId}
                  onChange={(e) => setSingleMealId(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {context.mealTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="block text-xs font-medium text-neutral-500 mb-2">Generate</span>
                <div className="flex gap-2">
                  {(["workout", "meal", "both"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSingleJobType(t)}
                      className={`px-3 py-1.5 rounded text-sm ${
                        singleJobType === t ? "bg-black text-white" : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {t === "both" ? "Both" : t === "meal" ? "Meal" : "Workout"}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={runSingle}
                disabled={singleSubmitting || !singleClientId}
                className="w-full py-2.5 rounded-lg bg-black text-white font-medium text-sm disabled:opacity-50"
              >
                {singleSubmitting ? "Generating…" : "Generate now"}
              </button>
            </div>
          )}

          {context && tab === "batch" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Search clients</label>
                <input
                  type="search"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder="Filter by name"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-neutral-500 mb-2">Select clients</span>
                <div className="max-h-48 overflow-y-auto rounded border border-neutral-200 divide-y">
                  {filteredBatchClients.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={batchSelectedIds.has(c.id)}
                        onChange={(e) => {
                          setBatchSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                      <span className="text-sm">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-xs font-medium text-neutral-500 mb-1">Override for all (optional)</span>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={batchOverrideWorkoutId}
                    onChange={(e) => setBatchOverrideWorkoutId(e.target.value)}
                    className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Workout: each client’s</option>
                    {context.workoutTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <select
                    value={batchOverrideMealId}
                    onChange={(e) => setBatchOverrideMealId(e.target.value)}
                    className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Meal: each client’s</option>
                    {context.mealTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <span className="block text-xs font-medium text-neutral-500 mb-2">Generate</span>
                <div className="flex gap-2">
                  {(["workout", "meal", "both"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBatchJobType(t)}
                      className={`px-3 py-1.5 rounded text-sm ${
                        batchJobType === t ? "bg-black text-white" : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {t === "both" ? "Both" : t === "meal" ? "Meal" : "Workout"}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={runBatch}
                disabled={batchSubmitting || batchSelectedIds.size === 0}
                className="w-full py-2.5 rounded-lg bg-black text-white font-medium text-sm disabled:opacity-50"
              >
                {batchSubmitting ? "Queuing…" : `Generate for ${batchSelectedIds.size} client(s)`}
              </button>
            </div>
          )}

          {tab === "queue" && (
            <div className="space-y-2">
              {jobs.length === 0 && <p className="text-sm text-neutral-500">No recent jobs.</p>}
              {jobs.map((job) => {
                const clientName = (job.payload?.client_name as string) ?? job.client_id.slice(0, 8);
                return (
                  <div
                    key={job.id}
                    className="rounded-lg border border-neutral-200 p-3 text-sm"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium">{clientName}</span>
                      <span
                        className={`text-xs ${
                          job.status === "succeeded"
                            ? "text-green-600"
                            : job.status === "failed"
                            ? "text-red-600"
                            : job.status === "running"
                            ? "text-blue-600"
                            : "text-neutral-500"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5 capitalize">{job.job_type}</div>
                    {job.status === "failed" && job.error && (
                      <p className="mt-2 text-xs text-red-600">{job.error}</p>
                    )}
                    {job.status === "succeeded" && job.result_plan_ids?.length && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {job.result_plan_ids.map((planId) => (
                          <Link
                            key={planId}
                            href={`/pt/app/plans/${planId}`}
                            className="text-xs text-blue-600 underline"
                          >
                            View plan
                          </Link>
                        ))}
                      </div>
                    )}
                    {(job.status === "queued" || job.status === "running") && (
                      <button
                        type="button"
                        onClick={() => cancelJob(job.id)}
                        className="mt-2 text-xs text-red-600 underline"
                      >
                        Cancel
                      </button>
                    )}
                    {job.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => retryJob(job.id)}
                        className="mt-2 text-xs text-blue-600 underline"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
