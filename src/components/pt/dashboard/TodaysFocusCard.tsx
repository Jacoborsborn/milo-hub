"use client";

import Link from "next/link";

type TodaysFocusCardProps = {
  overdueCount: number;
  dueSoonCount: number;
  noPlanCount: number;
};

export default function TodaysFocusCard({
  overdueCount,
  dueSoonCount,
  noPlanCount,
}: TodaysFocusCardProps) {
  const allZero = overdueCount === 0 && dueSoonCount === 0 && noPlanCount === 0;

  return (
    <div className="rounded-xl shadow-sm bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">Today&apos;s focus</h2>
      {allZero ? (
        <>
          <p className="text-sm text-neutral-600 mt-2">
            You&apos;re all caught up. Consider adding a new client or updating templates.
          </p>
          <Link
            href="/pt/app/clients/new"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add client
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-700 mt-2">
            Overdue: {overdueCount} · Due soon: {dueSoonCount} · No plan: {noPlanCount}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Clear the red first. Keep clients feeling supported.
          </p>
          <a
            href="#todays-priorities"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Work through priorities
          </a>
        </>
      )}
    </div>
  );
}
