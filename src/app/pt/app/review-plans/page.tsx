// src/app/pt/app/review-plans/page.tsx
// Review Plans: real data from public.plans (review_status ready/sent), client names from clients.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPlansForReview } from "@/lib/services/plans";

type ReviewItem = {
  id: string;
  clientName: string;
  planName: string;
  planType: "workout" | "meal";
  createdAt: string; // ISO
  generatedAt?: string; // ISO
  status: "ready" | "sent" | "archived";
  flags: {
    needsCheckCalories?: boolean;
    needsCheckEquipment?: boolean;
    needsCheckAllergies?: boolean;
    needsCheckVolume?: boolean;
  };
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pillClass(kind: "workout" | "meal") {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";
  return kind === "workout"
    ? `${base} border-sky-300/40 bg-sky-500/10`
    : `${base} border-emerald-300/40 bg-emerald-500/10`;
}

function statusPill(status: ReviewItem["status"]) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";
  if (status === "ready") return `${base} border-amber-300/40 bg-amber-500/10`;
  if (status === "sent") return `${base} border-emerald-300/40 bg-emerald-500/10`;
  return `${base} border-border bg-muted/30`;
}

function countFlags(item: ReviewItem) {
  const f = item.flags;
  return (
    (f.needsCheckCalories ? 1 : 0) +
    (f.needsCheckEquipment ? 1 : 0) +
    (f.needsCheckAllergies ? 1 : 0) +
    (f.needsCheckVolume ? 1 : 0)
  );
}

function mapRowToReviewItem(row: Awaited<ReturnType<typeof listPlansForReview>>[number]): ReviewItem {
  return {
    id: row.id,
    clientName: row.clientName,
    planName: row.planName,
    planType: row.plan_type,
    createdAt: row.created_at,
    generatedAt: row.review_ready_at ?? undefined,
    status: row.review_status === "sent" ? "sent" : "ready",
    flags: {},
  };
}

export default function ReviewPlansPage() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadQueue = () => {
    setLoading(true);
    setError(null);
    listPlansForReview()
      .then((rows) => setQueue(rows.map(mapRowToReviewItem)))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load plans"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleReviewAndSend = async (planId: string) => {
    setSendingId(planId);
    setError(null);
    setToast(null);
    try {
      const res = await fetch("/api/plans/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to send plan");
        return;
      }
      setToast("Plan sent to client");
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send plan");
    } finally {
      setSendingId(null);
    }
  };

  const ready = queue.filter((p) => p.status === "ready");
  const sent = queue.filter((p) => p.status === "sent");
  const flagged = ready.filter((p) => countFlags(p) > 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Review Plans</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your “inbox” for completed generations. Review fast, send faster.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/pt/app/clients"
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Go to Clients
            </Link>
            <Link
              href="/pt/app/programs"
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Go to Programs
            </Link>
          </div>
        </div>
      </header>

      {toast && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Productivity strip */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Ready to review</p>
          <p className="mt-2 text-3xl font-semibold">{ready.length}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Clear these to keep momentum.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Flagged items</p>
          <p className="mt-2 text-3xl font-semibold">{flagged.length}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            These need a quick check before sending.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs text-muted-foreground">Sent recently</p>
          <p className="mt-2 text-3xl font-semibold">{sent.length}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Proof you’re moving. Keep it going.
          </p>
        </div>
      </section>

      {/* Queue */}
      <section className="mt-8 rounded-2xl border bg-card">
        <div className="flex flex-col gap-2 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Review Queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Do a 30-second scan → send → done.
            </p>
          </div>

          {/* This will later become filters */}
          <div className="flex gap-2">
            <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs">
              All
            </span>
            <span className="inline-flex items-center rounded-full border bg-muted/30 px-3 py-1 text-xs">
              Ready
            </span>
            <span className="inline-flex items-center rounded-full border bg-muted/30 px-3 py-1 text-xs">
              Sent
            </span>
          </div>
        </div>

        <div className="divide-y">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            queue.map((item) => {
            const flagsCount = countFlags(item);
            return (
              <div key={item.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={pillClass(item.planType)}>
                        {item.planType === "workout" ? "Workout" : "Meal"}
                      </span>
                      <span className={statusPill(item.status)}>
                        {item.status === "ready"
                          ? "Ready"
                          : item.status === "sent"
                          ? "Sent"
                          : "Archived"}
                      </span>
                      {flagsCount > 0 && item.status === "ready" && (
                        <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium">
                          {flagsCount} check{flagsCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 truncate text-base font-semibold">
                      {item.planName}
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {item.clientName}
                      </span>{" "}
                      · Created {formatDate(item.createdAt)}
                      {item.generatedAt ? ` · Generated ${formatDate(item.generatedAt)}` : ""}
                    </p>

                    {/* Review checklist (psychological “done”) */}
                    {item.status === "ready" && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <ChecklistItem
                          label="Structure makes sense"
                          hint="Split, days, and flow"
                        />
                        <ChecklistItem
                          label="Constraints respected"
                          hint="Equipment / allergies / restrictions"
                        />
                        <ChecklistItem
                          label="Progression looks sane"
                          hint="Volume, intensity, overload"
                        />
                        <ChecklistItem
                          label="Client-ready language"
                          hint="Clear, not robotic"
                        />
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex shrink-0 flex-col gap-2 sm:w-[220px]">
                    <Link
                      href={`/pt/app/plans/${item.id}`}
                      className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                    >
                      Open & Review
                    </Link>

                    {item.status === "ready" ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
                          onClick={() => handleReviewAndSend(item.id)}
                          disabled={sendingId === item.id}
                        >
                          {sendingId === item.id ? "Sending…" : "✓ Review & Send"}
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                          onClick={() => {
                            alert("TODO: Archive flow");
                          }}
                        >
                          Archive
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
                        onClick={() => alert("TODO: View send history / resend")}
                      >
                        Resend
                      </button>
                    )}
                  </div>
                </div>

                {/* Flag summary */}
                {item.status === "ready" && countFlags(item) > 0 && (
                  <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm">
                    <p className="font-medium">Quick checks needed</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                      {item.flags.needsCheckCalories && (
                        <li>Calories/macros sanity check</li>
                      )}
                      {item.flags.needsCheckAllergies && (
                        <li>Allergy/restriction compliance</li>
                      )}
                      {item.flags.needsCheckEquipment && (
                        <li>Equipment matches client setup</li>
                      )}
                      {item.flags.needsCheckVolume && (
                        <li>Weekly volume/progression is sensible</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
          )}
        </div>
      </section>

      {/* Bottom guidance */}
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="text-base font-semibold">How this page should work (v1)</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Generations run in the background (basket icon). When complete, they appear here as <span className="font-medium text-foreground">Ready</span>.
          </li>
          <li>
            You open a plan, scan it quickly, make edits if needed.
          </li>
          <li>
            Hit <span className="font-medium text-foreground">✓ Review & Send</span> to deliver to the client and mark it as sent.
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Next: replace mock data with a real query and wire “Review & Send” to your email/share flow.
        </p>
      </section>
    </main>
  );
}

function ChecklistItem({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <div className="mt-0.5 h-5 w-5 rounded-md border bg-muted/30" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
