"use client";

type MetricCardProps = {
  label: string;
  value: string | number;
  loading?: boolean;
  /** Optional subtext below value (e.g. "Across all clients", "Last 7 days") */
  subtext?: string;
};

export default function MetricCard({ label, value, loading, subtext }: MetricCardProps) {
  return (
    <div className="rounded-xl shadow-sm bg-white p-6 min-w-0">
      <p className={loading ? "h-8 w-20 animate-pulse rounded bg-neutral-100" : "text-3xl font-semibold tabular-nums text-neutral-900"}>
        {loading ? "" : value}
      </p>
      <p className="text-xs uppercase tracking-wide text-gray-500 mt-1">{label}</p>
      {!loading && subtext && (
        <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>
      )}
    </div>
  );
}
