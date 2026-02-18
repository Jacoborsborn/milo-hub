"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createWorkoutPlanJob, getWorkoutJobById } from "@/lib/services/workoutGenerator";
import type { PlanJob } from "@/types/database";

const POLL_MS = 2000;

const DEFAULT_INPUTS = {
  daysPerWeek: 4,
  workoutType: "Strength",
  sessionLengthMin: 45,
  equipment: "Full Gym",
  experience: "Intermediate",
  workoutSplit: "full-body",
  goals: "hypertrophy",
};

type ClientOption = { id: string; name: string };

export default function WorkoutGeneratorTestPage() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<PlanJob | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "processing" | "polling">("idle");
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch("/api/generate-context");
      if (!res.ok) throw new Error("Failed to load clients");
      const data = await res.json();
      setClients(data.clients ?? []);
      if (data.clients?.length && !clientId) setClientId(data.clients[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [clientId]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const pollJob = useCallback(async (id: string) => {
    const j = await getWorkoutJobById(id);
    setJob(j ?? null);
    return j?.status === "succeeded" || j?.status === "failed";
  }, []);

  useEffect(() => {
    if (!jobId || status !== "polling") return;
    const done = job?.status === "succeeded" || job?.status === "failed";
    if (done) {
      setStatus("idle");
      return;
    }
    const t = setInterval(async () => {
      const done = await pollJob(jobId);
      if (done) {
        setStatus("idle");
        clearInterval(t);
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [jobId, status, job?.status, pollJob]);

  const runTest = async () => {
    if (!clientId) {
      setError("Select a client");
      return;
    }
    setError(null);
    setStatus("creating");
    try {
      const { jobId: id } = await createWorkoutPlanJob(clientId, DEFAULT_INPUTS, {
        clientName: clients.find((c) => c.id === clientId)?.name,
      });
      setJobId(id);
      setStatus("processing");
      const res = await fetch(`/api/jobs/${id}/process`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Process request failed");
      }
      setStatus("polling");
      await pollJob(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("idle");
    }
  };

  return (
    <div className="p-6 max-w-lg space-y-6">
      <h1 className="text-xl font-semibold">Workout generator (AI) – dev test</h1>
      <p className="text-sm text-neutral-600">
        Creates a plan_jobs workout job with default workoutInputs, triggers process (pt-workout-generator), then polls until done.
      </p>

      <div>
        <label className="block text-xs font-medium text-neutral-500 mb-1">Client</label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">— Select —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="text-xs text-neutral-500">
        Default inputs: {JSON.stringify(DEFAULT_INPUTS)}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runTest}
          disabled={status !== "idle" && status !== "polling"}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === "creating"
            ? "Creating job…"
            : status === "processing"
            ? "Processing…"
            : status === "polling"
            ? "Polling…"
            : "Create job & run"}
        </button>
      </div>

      {job && (
        <div className="rounded-lg border border-neutral-200 p-4 space-y-2">
          <p className="text-sm font-medium">Job: {job.id}</p>
          <p className="text-sm text-neutral-600">Status: {job.status}</p>
          {job.error && <p className="text-sm text-red-600">{job.error}</p>}
          {job.status === "succeeded" && job.result_plan_ids?.length ? (
            <div className="flex flex-wrap gap-2">
              {job.result_plan_ids.map((planId) => (
                <Link
                  key={planId}
                  href={`/pt/app/plans/${planId}`}
                  className="text-sm text-blue-600 underline"
                >
                  View plan {planId.slice(0, 8)}…
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
