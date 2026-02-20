"use client";

import { useEffect } from "react";

export default function PtHubSuccessClient() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fbq = (window as unknown as { fbq?: (a: string, b: string) => void }).fbq;
    if (typeof fbq === "function") {
      fbq("track", "CompleteRegistration");
    }
  }, []);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        🚀 Trial started — welcome in
      </h1>

      <p className="mt-4 text-base leading-relaxed text-neutral-600">
        Your Milo PT Hub trial is active and ready to go. Check your email for a link to open
        the PT Hub on your laptop or desktop.
      </p>

      <p className="mt-6 text-sm text-neutral-500">
        If you don&apos;t see it, check spam. Open the link on your computer for the best experience.
      </p>
    </div>
  );
}
