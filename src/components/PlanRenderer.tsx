"use client";

import { useState, useCallback } from "react";
import { DEBUG_GENERATION } from "@/lib/debug/correlation";
import { splitNotesToBullets } from "@/lib/utils/notes";

export type Exercise = {
  name?: string;
  sets?: number;
  reps?: string;
  rest_sec?: number;
  notes?: string | string[];
  pattern?: string;
  muscleGroup?: string;
};

type Day = {
  day_index?: number;
  focus?: string;
  exercises?: Exercise[];
};

type Week = {
  week?: number;
  days?: Day[];
};

type Phase = {
  name?: string;
  week_range?: number[];
  volume_modifier?: number;
};

type PlanJson = {
  phases?: Phase[];
  weeks?: Week[];
};

function titleCase(input: string) {
  return input
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatSetsReps(sets?: number, reps?: string) {
  if (!sets && !reps) return "";
  if (sets && reps) return `${sets} × ${reps}`;
  if (sets) return `${sets} sets`;
  return `${reps}`;
}

const muscleColorMap: Record<string, string> = {
  chest: "bg-red-500/15 text-red-400 border border-red-500/30",
  pectorals: "bg-red-500/15 text-red-400 border border-red-500/30",
  push: "bg-red-500/15 text-red-400 border border-red-500/30",
  back: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  lats: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  traps: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  pull: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  shoulders: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  delts: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  biceps: "bg-green-500/15 text-green-400 border border-green-500/30",
  triceps: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  legs: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  quads: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  glutes: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  hamstrings: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  calves: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  lower: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  core: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  abs: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  upper: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  full: "bg-neutral-500/15 text-neutral-400 border border-neutral-500/30",
  general: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
};

const DEFAULT_MUSCLE_CHIP = "bg-neutral-100 text-neutral-600 border border-neutral-200";

function muscleChipClass(pattern?: string): string {
  if (!pattern || typeof pattern !== "string") return DEFAULT_MUSCLE_CHIP;
  const lower = pattern.toLowerCase().trim();
  const single = lower.replace(/\s+/g, "");
  if (muscleColorMap[single]) return muscleColorMap[single];
  for (const key of Object.keys(muscleColorMap)) {
    if (lower.includes(key)) return muscleColorMap[key];
  }
  const firstWord = lower.split(/\s+/)[0]?.replace(/[^a-z]/g, "") ?? "";
  if (firstWord && muscleColorMap[firstWord]) return muscleColorMap[firstWord];
  return DEFAULT_MUSCLE_CHIP;
}

function renderNotes(notes: unknown, className: string) {
  const bullets = splitNotesToBullets(notes);
  if (!bullets.length) return null;
  return (
    <ul className={className}>
      {bullets.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

export type OnExerciseChange = (
  weekIdx: number,
  dayIdx: number,
  exIdx: number,
  updates: Partial<Exercise>
) => void;

export type PlanRendererMode = "pt" | "client";

type PlanRendererProps = {
  plan: PlanJson | null | undefined;
  mode?: PlanRendererMode;
  editMode?: boolean;
  editedPlanJson?: PlanJson | null;
  onExerciseChange?: OnExerciseChange;
  /** Client share: set of "week_number-day_index" for completed days */
  completedDayKeys?: Set<string>;
  /** Client share: toggle completion for a day */
  onToggleDayComplete?: (week_number: number, day_index: number, completed: boolean) => void | Promise<void>;
  /** PT view: per-week completion stats (index = week index) */
  weekCompletionStats?: { totalDays: number; completedCount: number; completionPercent: number }[];
};

export default function PlanRenderer({
  plan,
  mode = "pt",
  editMode,
  editedPlanJson,
  onExerciseChange,
  completedDayKeys,
  onToggleDayComplete,
  weekCompletionStats,
}: PlanRendererProps) {
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(() => new Set([0]));
  const [closedDays, setClosedDays] = useState<Set<string>>(() => new Set());
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set());

  const toggleWeek = useCallback((wIdx: number) => {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(wIdx)) next.delete(wIdx);
      else next.add(wIdx);
      return next;
    });
  }, []);

  const toggleDay = useCallback(
    (key: string) => {
      if (mode === "client") {
        setOpenDays((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      } else {
        setClosedDays((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      }
    },
    [mode]
  );

  const source = (editMode && editedPlanJson != null ? editedPlanJson : plan) ?? null;
  if (!source) return <div className="text-sm text-neutral-500">No plan data found.</div>;

  const phases = source.phases ?? [];
  const weeks = source.weeks ?? [];
  const isClient = mode === "client";

  if (DEBUG_GENERATION) {
    const pathUsed = "source.weeks";
    const weeksLen = weeks.length;
    const weekDetails = weeks.map((w: Week, i: number) => ({
      index: i,
      keys: w ? Object.keys(w) : [],
      daysKey: "days",
      daysLength: (w?.days ?? []).length,
    }));
    console.log("[PlanRenderer] audit", {
      pathUsed,
      weeksLength: weeksLen,
      weekDetails,
      sourceTopKeys: source ? Object.keys(source) : [],
    });
  }

  const wrap = isClient ? "space-y-8" : "space-y-6";

  return (
    <div className={wrap}>
      {/* Phases */}
      {phases.length > 0 && (
        <div className={isClient ? "rounded-2xl border border-neutral-200 bg-neutral-50 p-5" : "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"}>
          <div className={isClient ? "text-base font-semibold mb-3 text-neutral-900" : "text-sm font-semibold mb-3 text-neutral-900"}>Phases</div>
          <div className={isClient ? "space-y-3" : "space-y-2"}>
            {phases.map((p, idx) => (
              <div
                key={idx}
                className={
                  isClient
                    ? "flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-neutral-800"
                    : "flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-neutral-800"
                }
              >
                <div className="font-medium">{p.name ?? `Phase ${idx + 1}`}</div>
                <div className={isClient ? "text-sm text-neutral-500" : "text-xs text-neutral-500"}>
                  {Array.isArray(p.week_range) && p.week_range.length === 2
                    ? `Weeks ${p.week_range[0]}–${p.week_range[1]}`
                    : null}
                  {typeof p.volume_modifier === "number" ? ` • Volume x${p.volume_modifier}` : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weeks */}
      {weeks.length === 0 ? (
        <div className={isClient ? "text-base text-neutral-600" : "text-sm text-neutral-500"}>No weeks found in plan.</div>
      ) : (
        <div className={isClient ? "space-y-8" : "space-y-6"}>
          {weeks.map((w, wIdx) => {
            const weekOpen = openWeeks.has(wIdx);
            const weekNum = w.week ?? wIdx + 1;
            return (
              <div
                key={wIdx}
                id={isClient ? `week-${weekNum}` : undefined}
                className={
                  isClient
                    ? "rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm scroll-mt-24"
                    : "rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm"
                }
              >
                <button
                  type="button"
                  onClick={() => toggleWeek(wIdx)}
                  className={
                    isClient
                      ? "w-full flex items-center justify-between p-5 text-left active:bg-neutral-50 transition-colors min-h-[48px] touch-manipulation"
                      : "w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 transition-colors text-neutral-900"
                  }
                >
                  <div className={isClient ? "text-lg font-semibold text-neutral-900" : "text-base font-semibold text-neutral-900"}>
                    Week {weekNum}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isClient && weekCompletionStats?.[wIdx] != null && (
                      <span className="text-xs text-neutral-500">
                        {weekCompletionStats[wIdx].completedCount} / {weekCompletionStats[wIdx].totalDays} completed
                        {" · "}
                        {weekCompletionStats[wIdx].completionPercent}%
                      </span>
                    )}
                    {isClient && (
                      <span className="text-sm text-neutral-500">
                        {(w.days?.length ?? 0)} day(s)
                      </span>
                    )}
                    {!isClient && weekCompletionStats?.[wIdx] == null && (
                      <span className="text-xs text-neutral-500">
                        {(w.days?.length ?? 0)} day(s)
                      </span>
                    )}
                    <span className={isClient ? "text-neutral-500" : "text-sm text-neutral-500"} aria-hidden>
                      {weekOpen ? "▼" : "▶"}
                    </span>
                  </div>
                </button>
                {!isClient && weekCompletionStats?.[wIdx] != null && weekCompletionStats[wIdx].totalDays > 0 && (
                  <div className="px-4 pb-2" style={{ marginTop: -4 }}>
                    <div
                      className="rounded-full overflow-hidden bg-neutral-200"
                      style={{ height: 6 }}
                      role="presentation"
                    >
                      <div
                        className="h-full bg-neutral-500 rounded-full transition-[width]"
                        style={{ width: `${weekCompletionStats[wIdx].completionPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {weekOpen && (
                  <div className={isClient ? "px-4 pb-5 space-y-4" : "px-4 pb-4 space-y-4"}>
                    {(w.days ?? []).map((d, dIdx) => {
                      const dayKey = `${wIdx}-${dIdx}`;
                      const dayOpen = isClient ? openDays.has(dayKey) : !closedDays.has(dayKey);
                      const dayIndex = d.day_index ?? dIdx + 1;
                      const completionKey = `${weekNum}-${dayIndex}`;
                      const isCompleted = completedDayKeys?.has(completionKey) ?? false;
                      const showCompleteToggle = isClient && onToggleDayComplete != null;
                      return (
                        <div
                          key={dIdx}
                          className={
                            isClient
                              ? "rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden"
                              : "rounded-xl bg-neutral-50 overflow-hidden border border-neutral-100"
                          }
                        >
                          <div className={isClient ? "flex flex-wrap items-stretch gap-0" : undefined}>
                            <button
                              type="button"
                              onClick={() => toggleDay(dayKey)}
                              className={
                                isClient
                                  ? "flex-1 min-w-0 flex flex-wrap items-center justify-between gap-2 p-4 text-left active:bg-neutral-100 transition-colors min-h-[48px] touch-manipulation"
                                  : "w-full flex flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-neutral-100 transition-colors text-neutral-900"
                              }
                            >
                              <div className={isClient ? "font-semibold text-neutral-900 text-base" : "font-semibold"}>
                                Day {dayIndex}
                                {d.focus ? ` • ${titleCase(d.focus)}` : ""}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={isClient ? "text-sm text-neutral-500" : "text-xs text-neutral-500"}>
                                  {(d.exercises?.length ?? 0)} exercise(s)
                                </span>
                                <span className={isClient ? "text-neutral-500" : "text-sm text-neutral-500"} aria-hidden>
                                  {dayOpen ? "▼" : "▶"}
                                </span>
                              </div>
                            </button>
                            {showCompleteToggle && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleDayComplete(weekNum, dayIndex, !isCompleted);
                                }}
                                className={
                                  isCompleted
                                    ? "min-h-[48px] min-w-[48px] px-4 flex items-center justify-center gap-2 bg-emerald-100 text-emerald-800 border-l border-neutral-200 active:bg-emerald-200 transition-colors touch-manipulation"
                                    : "min-h-[48px] min-w-[48px] px-4 flex items-center justify-center gap-2 bg-neutral-200 text-neutral-700 border-l border-neutral-200 active:bg-neutral-300 transition-colors touch-manipulation"
                                }
                                aria-pressed={isCompleted}
                                aria-label={isCompleted ? "Mark day incomplete" : "Mark day complete"}
                              >
                                {isCompleted ? (
                                  <span className="text-sm font-medium">✓ Done</span>
                                ) : (
                                  <span className="text-sm font-medium">Complete</span>
                                )}
                              </button>
                            )}
                          </div>

                          {dayOpen && (
                            <div className={isClient ? "px-4 pb-4 space-y-4" : "px-4 pb-4 space-y-3"}>
                              {(d.exercises ?? []).map((ex, exIdx) => (
                                <div
                                  key={exIdx}
                                  className={
                                    isClient
                                      ? "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                                      : "rounded-lg border border-neutral-200 bg-white p-4 hover:bg-neutral-50 hover:border-neutral-300 transition shadow-sm"
                                  }
                                >
                                  {isClient && !editMode ? (
                                    <>
                                      <div className="text-lg font-semibold text-neutral-900 break-words">
                                        {ex.name ?? "Exercise"}
                                      </div>
                                      <div className="mt-1 text-sm text-neutral-600">
                                        {formatSetsReps(ex.sets, ex.reps)}
                                        {typeof ex.rest_sec === "number" ? ` • Rest ${ex.rest_sec}s` : ""}
                                      </div>
                                      {renderNotes(
                                        ex.notes,
                                        "mt-2 text-sm text-neutral-600 break-words list-disc pl-5 space-y-1"
                                      )}
                                    </>
                                  ) : (
                                  <>
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    {editMode && onExerciseChange ? (
                                      <>
                                        <label className="flex flex-col gap-1 text-sm shrink-0">
                                          <span className="text-neutral-600">Name</span>
                                          <input
                                            type="text"
                                            value={ex.name ?? ""}
                                            onChange={(e) =>
                                              onExerciseChange(wIdx, dIdx, exIdx, { name: e.target.value })
                                            }
                                            className="min-w-[140px] rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-900"
                                          />
                                        </label>
                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <label className="flex items-center gap-1">
                                          <span className="text-neutral-600">Sets</span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={ex.sets ?? ""}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              onExerciseChange(wIdx, dIdx, exIdx, {
                                                sets: v === "" ? undefined : Number(v),
                                              });
                                            }}
                                            className="w-14 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-900"
                                          />
                                        </label>
                                        <label className="flex items-center gap-1">
                                          <span className="text-neutral-600">Reps</span>
                                          <input
                                            type="text"
                                            value={ex.reps ?? ""}
                                            onChange={(e) =>
                                              onExerciseChange(wIdx, dIdx, exIdx, { reps: e.target.value })
                                            }
                                            className="w-20 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-900"
                                          />
                                        </label>
                                        <label className="flex items-center gap-1">
                                          <span className="text-neutral-600">Rest (s)</span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={ex.rest_sec ?? ""}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              onExerciseChange(wIdx, dIdx, exIdx, {
                                                rest_sec: v === "" ? undefined : Number(v),
                                              });
                                            }}
                                            className="w-14 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-900"
                                          />
                                        </label>
                                        </div>
                                      </>
                                    ) : (
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-base font-semibold text-neutral-900 break-words">
                                            {ex.name ?? "Exercise"}
                                          </span>
                                          {(() => {
                                            const muscleLabel = (ex.pattern ?? ex.muscleGroup ?? d.focus ?? "General").trim();
                                            if (!muscleLabel) return null;
                                            return (
                                              <span
                                                className={`text-xs px-2 py-0.5 rounded-full ${muscleChipClass(muscleLabel)}`}
                                              >
                                                {titleCase(muscleLabel)}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                        <div className="text-sm text-neutral-500 mt-1">
                                          {formatSetsReps(ex.sets, ex.reps)}
                                          {typeof ex.rest_sec === "number" ? ` • Rest ${ex.rest_sec}s` : ""}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {editMode && onExerciseChange ? (
                                    <div className="mt-2">
                                      <label className="block text-xs text-neutral-600 mb-1">Notes</label>
                                      <textarea
                                        value={Array.isArray(ex.notes) ? ex.notes.join("\n") : ex.notes ?? ""}
                                        onChange={(e) =>
                                          onExerciseChange(wIdx, dIdx, exIdx, { notes: e.target.value })
                                        }
                                        rows={2}
                                        className="w-full rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-900 resize-y"
                                      />
                                    </div>
                                  ) : !isClient ? (
                                    renderNotes(
                                      ex.notes,
                                      "mt-2 text-sm text-neutral-600 break-words list-disc pl-4 space-y-1"
                                    )
                                  ) : null}
                                  </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
