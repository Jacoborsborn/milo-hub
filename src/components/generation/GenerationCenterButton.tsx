"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

type JobStatus = "queued" | "running" | "succeeded" | "failed";
type JobType = "meal" | "workout" | "both";

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

const POLL_MS = 15000; // when no active jobs, poll every 15s
const POLL_MS_ACTIVE = 2000;

function statusLabel(s: JobStatus): string {
  switch (s) {
    case "queued": return "Queued";
    case "running": return "Generating";
    case "succeeded": return "Done";
    case "failed": return "Failed";
    default: return s;
  }
}

function typeLabel(t: JobType): string {
  switch (t) {
    case "meal": return "Meal";
    case "workout": return "Workout";
    case "both": return "Meal + Workout";
    default: return t;
  }
}

export default function GenerationCenterButton() {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<PlanJobRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : []);
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[Generation Center] Failed to fetch jobs:", err);
        setJobs([]);
      }
    } catch (e) {
      console.error(e);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchJobs();
  }, [open, fetchJobs]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("openGenerationCenter", onOpen);
    return () => window.removeEventListener("openGenerationCenter", onOpen);
  }, []);

  const activeCount = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
  const pollMs = activeCount > 0 ? POLL_MS_ACTIVE : POLL_MS;
  useEffect(() => {
    if (!open) return;
    const id = setInterval(fetchJobs, pollMs);
    return () => clearInterval(id);
  }, [open, fetchJobs, pollMs]);

  // Only show active jobs so the list doesn't build up when plans are done
  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const sorted = [...activeJobs].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800 text-white shadow-lg hover:bg-neutral-700 transition-colors"
        title="Generation center (jobs)"
        aria-label="Open generation center"
      >
        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-medium text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-200 p-4">
              <h2 className="text-lg font-semibold text-neutral-900">Generation center</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && jobs.length === 0 ? (
                <p className="text-sm text-neutral-500">Loading…</p>
              ) : sorted.length === 0 ? (
                <p className="text-sm text-neutral-500">No jobs. Use Generate to create plans.</p>
              ) : (
                sorted.map((job) => {
                  const clientName = (job.payload?.client_name as string) ?? job.client_id.slice(0, 8);
                  return (
                    <div
                      key={job.id}
                      className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-medium text-neutral-900 truncate">{clientName}</p>
                        <span
                          className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${
                            job.status === "succeeded"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : job.status === "failed"
                              ? "bg-red-50 text-red-800 border-red-200"
                              : job.status === "running"
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-neutral-100 text-neutral-700 border-neutral-200"
                          }`}
                        >
                          {statusLabel(job.status)}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">{typeLabel(job.job_type)}</p>
                      <p className="text-xs text-neutral-400">
                        {new Date(job.created_at).toLocaleString()}
                      </p>
                      {job.status === "failed" && job.error && (
                        <p className="text-sm text-red-600">{job.error}</p>
                      )}
                      {(job.status === "queued" || job.status === "running") && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/jobs/${job.id}/cancel`, {
                              method: "POST",
                              credentials: "include",
                            });
                            if (res.ok) fetchJobs();
                          }}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                      {job.status === "succeeded" && job.result_plan_ids?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {job.result_plan_ids.map((planId) => (
                            <Link
                              key={planId}
                              href={`/pt/app/plans/${planId}`}
                              className="text-sm font-medium text-blue-600 hover:underline"
                            >
                              View result
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
