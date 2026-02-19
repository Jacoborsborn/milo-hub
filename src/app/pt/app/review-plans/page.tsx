// src/app/pt/app/review-plans/page.tsx
// Review Plans: Command Review Board — premium inbox with color-coded states.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPlansForReview } from "@/lib/services/plans";

type ReviewItem = {
  id: string;
  clientName: string;
  planName: string;
  planType: "workout" | "meal";
  createdAt: string;
  generatedAt?: string;
  status: "ready" | "sent" | "archived";
  flags: {
    needsCheckCalories?: boolean;
    needsCheckEquipment?: boolean;
    needsCheckAllergies?: boolean;
    needsCheckVolume?: boolean;
  };
};

type QueueFilter = "all" | "ready" | "sent";

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

function countFlags(item: ReviewItem) {
  const f = item.flags;
  return (
    (f.needsCheckCalories ? 1 : 0) +
    (f.needsCheckEquipment ? 1 : 0) +
    (f.needsCheckAllergies ? 1 : 0) +
    (f.needsCheckVolume ? 1 : 0)
  );
}

function mapRowToReviewItem(
  row: Awaited<ReturnType<typeof listPlansForReview>>[number]
): ReviewItem {
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

// ——— Momentum Strip ———
function MomentumStrip({
  readyCount,
  flaggedCount,
  sentCount,
}: {
  readyCount: number;
  flaggedCount: number;
  sentCount: number;
}) {
  return (
    <section
      className="flex flex-col gap-0 sm:flex-row"
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: "16px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
        padding: "18px",
      }}
    >
      {/* READY — ~50% */}
      <div className="relative flex min-h-[100px] flex-1 flex-col justify-center border-b border-[#E5E7EB] bg-white pl-[22px] sm:max-w-[50%] sm:border-b-0 sm:border-r sm:pr-5">
        <div
          className="absolute left-0 top-4 bottom-4 w-1.5 rounded-full"
          style={{ background: "#6366F1" }}
        />
        <p className="text-xs font-medium" style={{ color: "var(--rp-muted)" }}>
          Ready to review
        </p>
        <p
          className="mt-1 text-[48px] font-extrabold leading-none tracking-tight"
          style={{ color: "var(--rp-text)" }}
        >
          {readyCount}
        </p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--rp-muted)" }}>
          Awaiting approval
        </p>
      </div>

      {/* FLAGGED — ~25% */}
      <div className="relative flex min-h-[88px] flex-[0.5] flex-col justify-center border-b border-[#E5E7EB] bg-white pl-[22px] sm:border-b-0 sm:border-r sm:pr-4">
        <div
          className="absolute left-0 top-3 bottom-3 w-1.5 rounded-full"
          style={{ background: "#F59E0B" }}
        />
        <p className="text-xs font-medium" style={{ color: "var(--rp-muted)" }}>
          Flagged
        </p>
        <p
          className="mt-0.5 text-[32px] font-extrabold leading-none"
          style={{ color: "var(--rp-text)" }}
        >
          {flaggedCount}
        </p>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--rp-muted)" }}>
          Needs a quick check
        </p>
      </div>

      {/* SENT — ~25% */}
      <div className="relative flex min-h-[88px] flex-[0.5] flex-col justify-center bg-white pl-[22px] sm:pl-4">
        <div
          className="absolute left-0 top-3 bottom-3 w-1.5 rounded-full"
          style={{ background: "#10B981" }}
        />
        <p className="text-xs font-medium" style={{ color: "var(--rp-muted)" }}>
          Sent
        </p>
        <p
          className="mt-0.5 text-[32px] font-extrabold leading-none"
          style={{ color: "var(--rp-text)" }}
        >
          {sentCount}
        </p>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--rp-muted)" }}>
          Delivered recently
        </p>
      </div>
    </section>
  );
}

// ——— Segmented Filter ———
function SegmentedFilter({
  value,
  onChange,
}: {
  value: QueueFilter;
  onChange: (v: QueueFilter) => void;
}) {
  const options: { value: QueueFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "ready", label: "Ready" },
    { value: "sent", label: "Sent" },
  ];
  return (
    <div
      className="inline-flex rounded-full p-1"
      style={{
        background: "var(--rp-surface-2)",
        minHeight: 42,
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="min-h-[34px] rounded-full px-3 py-2 text-[13px] font-medium transition-colors"
          style={
            value === opt.value
              ? {
                  background: "var(--rp-surface)",
                  border: "1px solid var(--rp-border)",
                  boxShadow: "var(--rp-shadow-sm)",
                  color: "var(--rp-text)",
                }
              : { color: "var(--rp-muted)" }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ——— Queue Item Row (compact: chips + title + metadata + one primary button) ———
function QueueItemRow({
  item,
  sendingId,
  onOpenReview,
}: {
  item: ReviewItem;
  sendingId: string | null;
  onOpenReview: (item: ReviewItem) => void;
}) {
  const flagsCount = countFlags(item);
  const isSent = item.status === "sent";
  const isReady = item.status === "ready";

  return (
    <div
      role="button"
      tabIndex={0}
      className="queue-item-row flex min-h-[96px] cursor-pointer flex-row items-center justify-between gap-4 rounded-[var(--rp-r-md)] border p-4 transition-all"
      style={{
        background: "var(--rp-surface)",
        borderColor: "var(--rp-border)",
        borderLeftWidth: "3px",
        borderLeftColor: "#94A3B8",
      }}
      onClick={() => onOpenReview(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenReview(item);
        }
      }}
    >
      <div
        className="min-w-0 flex-1"
        style={isSent ? { opacity: 0.92 } : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-lg px-2 py-1 text-[12px] font-semibold"
            style={{ background: "#F3F4F6", color: "#374151" }}
          >
            {item.planType === "workout" ? "Workout" : "Meal"}
          </span>
          <span
            className="rounded-lg px-2 py-1 text-[12px] font-semibold"
            style={
              isReady
                ? { background: "rgba(79,70,229,0.08)", color: "#4F46E5" }
                : { background: "rgba(16,185,129,0.08)", color: "#10B981" }
            }
          >
            {isReady ? "Ready" : "Sent"}
          </span>
          {flagsCount > 0 && isReady && (
            <span
              className="rounded-lg px-2 py-1 text-[12px] font-semibold"
              style={{
                background: "rgba(245,158,11,0.10)",
                color: "#F59E0B",
              }}
            >
              {flagsCount} check{flagsCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <h3
          className="mt-1.5 truncate font-bold"
          style={{ fontSize: "17px", color: "var(--rp-text)" }}
        >
          {item.planName}
        </h3>
        <p
          className="mt-0.5 text-[13px]"
          style={{ color: "#6B7280", opacity: 0.95 }}
        >
          {item.clientName} · Created {formatDate(item.createdAt)}
          {item.generatedAt ? ` · Generated ${formatDate(item.generatedAt)}` : ""}
        </p>
      </div>

      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        {isReady ? (
          <button
            type="button"
            className="h-10 min-h-[40px] rounded-[12px] border-0 px-4 font-medium text-white transition-[filter] hover:brightness-95 disabled:opacity-60"
            style={{ background: "#111827" }}
            onClick={() => onOpenReview(item)}
            disabled={sendingId === item.id}
          >
            {sendingId === item.id ? "Sending…" : "Review & Send"}
          </button>
        ) : (
          <button
            type="button"
            className="h-10 min-h-[40px] rounded-[12px] border px-4 font-medium transition-colors hover:bg-[#F6F7F9]"
            style={{
              background: "#FFFFFF",
              borderColor: "#E5E7EB",
              color: "#0E1116",
            }}
            onClick={() => onOpenReview(item)}
          >
            Open & Review
          </button>
        )}
      </div>
    </div>
  );
}

function ChecklistItem({
  label,
  hint,
  checked,
  onToggle,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-[var(--rp-surface-2)]"
      style={{
        background: "var(--rp-surface)",
        borderColor: "var(--rp-border)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-[var(--rp-accent-ready)] focus:ring-[var(--rp-accent-ready)]"
        style={{ borderColor: "var(--rp-border)" }}
        aria-label={label}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--rp-text)" }}>
          {label}
        </p>
        <p className="text-xs" style={{ color: "var(--rp-muted)" }}>
          {hint}
        </p>
      </div>
    </label>
  );
}

const CHECKLIST_ITEMS: { label: string; hint: string }[] = [
  { label: "Structure makes sense", hint: "Split, days, and flow" },
  { label: "Constraints respected", hint: "Equipment / allergies / restrictions" },
  { label: "Progression looks sane", hint: "Volume, intensity, overload" },
  { label: "Client-ready language", hint: "Clear, not robotic" },
];

// ——— Review Panel (slide-over: checklist + actions) ———
function ReviewPanel({
  item,
  onClose,
  onReviewAndSend,
  onArchive,
  onResend,
  sendingId,
}: {
  item: ReviewItem;
  onClose: () => void;
  onReviewAndSend: (planId: string) => void;
  onArchive: () => void;
  onResend: () => void;
  sendingId: string | null;
}) {
  const [checklist, setChecklist] = useState<boolean[]>(() => CHECKLIST_ITEMS.map(() => false));
  const isReady = item.status === "ready";
  const flagsCount = countFlags(item);

  const toggleCheck = (index: number) => {
    setChecklist((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l bg-white shadow-xl"
        style={{
          borderColor: "var(--rp-border)",
          boxShadow: "0 6px 16px rgba(0,0,0,0.05)",
        }}
      >
        <div className="flex items-center justify-between border-b p-5" style={{ borderColor: "var(--rp-border)" }}>
          <h2 className="font-bold" style={{ fontSize: "18px", color: "var(--rp-text)" }}>
            {item.planName}
          </h2>
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--rp-muted)] transition-colors hover:bg-[var(--rp-surface-2)] hover:text-[var(--rp-text)]"
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-[13px]" style={{ color: "var(--rp-muted)" }}>
            {item.clientName} · Created {formatDate(item.createdAt)}
            {item.generatedAt ? ` · Generated ${formatDate(item.generatedAt)}` : ""}
          </p>

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold" style={{ color: "var(--rp-text)" }}>
              Full content
            </p>
            <Link
              href={`/pt/app/plans/${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: "var(--rp-accent-ready)" }}
            >
              Open plan in new tab
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
            </Link>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-semibold" style={{ color: "var(--rp-text)" }}>
              Review checklist
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHECKLIST_ITEMS.map((entry, index) => (
                <ChecklistItem
                  key={entry.label}
                  label={entry.label}
                  hint={entry.hint}
                  checked={checklist[index] ?? false}
                  onToggle={() => toggleCheck(index)}
                />
              ))}
            </div>
          </div>

          {isReady && flagsCount > 0 && (
            <div
              className="mt-4 rounded-xl border p-4 text-sm"
              style={{
                background: "var(--rp-surface-2)",
                borderColor: "var(--rp-border)",
              }}
            >
              <p className="font-semibold" style={{ color: "var(--rp-text)" }}>
                Quick checks needed
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5" style={{ color: "var(--rp-muted)" }}>
                {item.flags.needsCheckCalories && <li>Calories/macros sanity check</li>}
                {item.flags.needsCheckAllergies && <li>Allergy/restriction compliance</li>}
                {item.flags.needsCheckEquipment && <li>Equipment matches client setup</li>}
                {item.flags.needsCheckVolume && <li>Weekly volume/progression is sensible</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t p-5" style={{ borderColor: "var(--rp-border)" }}>
          {isReady ? (
            <>
              <button
                type="button"
                className="h-10 w-full rounded-[12px] border-0 font-medium text-white transition-[filter] hover:brightness-95 disabled:opacity-60"
                style={{ background: "#111827" }}
                onClick={() => onReviewAndSend(item.id)}
                disabled={sendingId === item.id}
              >
                {sendingId === item.id ? "Sending…" : "Review & Send"}
              </button>
              <button
                type="button"
                className="h-10 w-full rounded-[12px] border px-4 font-medium transition-colors hover:bg-[#F6F7F9]"
                style={{ borderColor: "#E5E7EB", color: "#0E1116" }}
                onClick={onArchive}
              >
                Archive
              </button>
              <button
                type="button"
                className="text-sm font-medium transition-colors hover:underline"
                style={{ color: "var(--rp-muted)" }}
                onClick={onResend}
              >
                Resend
              </button>
            </>
          ) : (
            <>
              <Link
                href={`/pt/app/plans/${item.id}`}
                className="flex h-10 w-full items-center justify-center rounded-[12px] border font-medium transition-colors hover:bg-[#F6F7F9]"
                style={{ borderColor: "#E5E7EB", color: "#0E1116" }}
              >
                Open & Review
              </Link>
              <button
                type="button"
                className="h-10 w-full rounded-[12px] border px-4 font-medium transition-colors hover:bg-[#F6F7F9]"
                style={{ borderColor: "#E5E7EB", color: "#0E1116" }}
                onClick={onArchive}
              >
                Archive
              </button>
              <button
                type="button"
                className="text-sm font-medium transition-colors hover:underline"
                style={{ color: "var(--rp-muted)" }}
                onClick={onResend}
              >
                Resend
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ——— Review Queue Card ———
function ReviewQueueCard({
  filteredQueue,
  filter,
  setFilter,
  loading,
  sendingId,
  onOpenReview,
}: {
  filteredQueue: ReviewItem[];
  filter: QueueFilter;
  setFilter: (f: QueueFilter) => void;
  loading: boolean;
  sendingId: string | null;
  onOpenReview: (item: ReviewItem) => void;
}) {
  return (
    <section
      className="overflow-visible rounded-[var(--rp-r-lg)] border"
      style={{
        background: "var(--rp-surface)",
        borderColor: "var(--rp-border)",
        boxShadow: "0 6px 16px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            className="font-semibold"
            style={{ fontSize: "17px", color: "var(--rp-text)" }}
          >
            Review Queue
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--rp-muted)" }}>
            Quick scan. One click. Delivered.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="text-[13px]"
            style={{ color: "var(--rp-muted)" }}
          >
            Avg review time: 42s
          </span>
          <SegmentedFilter value={filter} onChange={setFilter} />
        </div>
      </div>

      <div className="p-5" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {loading ? (
          <div
            className="py-8 text-center text-sm"
            style={{ color: "var(--rp-muted)" }}
          >
            Loading…
          </div>
        ) : filteredQueue.length === 0 ? (
          <div
            className="py-8 text-center text-sm"
            style={{ color: "var(--rp-muted)" }}
          >
            No plans to show.
          </div>
        ) : (
          filteredQueue.map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              sendingId={sendingId}
              onOpenReview={onOpenReview}
            />
          ))
        )}
      </div>
    </section>
  );
}

// ——— Page ———
export default function ReviewPlansPage() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const loadQueue = () => {
    setLoading(true);
    setError(null);
    listPlansForReview()
      .then((rows) => setQueue(rows.map(mapRowToReviewItem)))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load plans")
      )
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
      setSelectedPlanId(null);
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

  const filteredQueue =
    filter === "all"
      ? queue
      : filter === "ready"
        ? ready
        : sent;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="font-bold tracking-tight"
              style={{ fontSize: "30px", color: "var(--rp-text)" }}
            >
              Review Plans
            </h1>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--rp-muted)" }}
            >
              Approve. Deliver. Move on.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/pt/app/clients"
              className="inline-flex h-10 items-center justify-center rounded-[12px] border px-4 text-sm font-medium transition-colors hover:bg-[var(--rp-surface-2)]"
              style={{
                borderColor: "var(--rp-border)",
                color: "var(--rp-text)",
              }}
            >
              Go to Clients
            </Link>
            <Link
              href="/pt/app/programs"
              className="inline-flex h-10 items-center justify-center rounded-[12px] border px-4 text-sm font-medium transition-colors hover:bg-[var(--rp-surface-2)]"
              style={{
                borderColor: "var(--rp-border)",
                color: "var(--rp-text)",
              }}
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

      <MomentumStrip
        readyCount={ready.length}
        flaggedCount={flagged.length}
        sentCount={sent.length}
      />

      <div className="mt-8">
        <ReviewQueueCard
          filteredQueue={filteredQueue}
          filter={filter}
          setFilter={setFilter}
          loading={loading}
          sendingId={sendingId}
          onOpenReview={(item) => setSelectedPlanId(item.id)}
        />
      </div>

      {selectedPlanId && (() => {
        const selectedItem = queue.find((p) => p.id === selectedPlanId);
        if (!selectedItem) return null;
        return (
          <ReviewPanel
            item={selectedItem}
            onClose={() => setSelectedPlanId(null)}
            onReviewAndSend={handleReviewAndSend}
            onArchive={() => alert("TODO: Archive flow")}
            onResend={() => alert("TODO: View send history / resend")}
            sendingId={sendingId}
          />
        );
      })()}
    </main>
  );
}
