"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function TrialSuccessBanner() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const [dismissed, setDismissed] = useState(false);

  if (!success || dismissed) return null;

  return (
    <div
      role="alert"
      className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
    >
      <span>Trial started. Let&apos;s set up your first client.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-green-600 hover:bg-green-100 hover:text-green-800"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
