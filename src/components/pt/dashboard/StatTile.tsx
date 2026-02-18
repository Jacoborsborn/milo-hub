"use client";

type StatTileProps = {
  label: string;
  value: string | number | null;
  skeleton?: boolean;
  /** Micro narrative under value (e.g. "Stable this month") */
  subtext?: string;
  /** Hero variant: larger, accent strip + tint */
  hero?: boolean;
  /** Hero-only: helper under number */
  heroHelper?: string;
  /** Hero-only: e.g. "≈ 2 coaching sessions" (45 min/session) */
  heroSessions?: number | null;
};

export default function StatTile({
  label,
  value,
  skeleton,
  subtext,
  hero,
  heroHelper,
  heroSessions,
}: StatTileProps) {
  if (hero) {
    return (
      <div
        className="relative rounded-xl border border-neutral-200 overflow-hidden shadow-sm min-w-0 col-span-2 md:col-span-2"
        style={{ backgroundColor: "rgba(37, 99, 235, 0.08)" }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" aria-hidden />
        <div className="px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700/90 truncate">
            {label}
          </p>
          {skeleton ? (
            <div className="h-10 w-24 mt-1 rounded bg-blue-200/50 animate-pulse" aria-hidden />
          ) : (
            <p className="mt-1 text-2xl md:text-3xl font-bold tabular-nums text-neutral-900 truncate">
              {value ?? "—"}
            </p>
          )}
          {!skeleton && heroHelper && (
            <p className="text-xs text-neutral-500 mt-0.5">{heroHelper}</p>
          )}
          {!skeleton && heroSessions != null && heroSessions > 0 && (
            <p className="text-xs font-medium text-blue-700/90 mt-0.5">≈ {heroSessions} coaching session{heroSessions !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-sm min-w-0 flex-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 truncate">
        {label}
      </p>
      {skeleton ? (
        <div className="h-8 w-16 mt-1 rounded bg-neutral-200 animate-pulse" aria-hidden />
      ) : (
        <>
          <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900 truncate">
            {value ?? "—"}
          </p>
          {subtext && <p className="text-[11px] text-neutral-500 mt-0.5">{subtext}</p>}
        </>
      )}
    </div>
  );
}
