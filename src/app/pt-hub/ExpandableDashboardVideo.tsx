"use client";

import { useState } from "react";

export default function ExpandableDashboardVideo() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100">
        <video
          src="/TutorialVideo/Howitworks.mp4"
          className="h-auto w-full object-contain"
          autoPlay
          muted
          loop
          playsInline
          aria-label="Milo PT Hub dashboard tutorial"
        />
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
          aria-label="Expand video"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Video expanded"
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="relative max-h-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src="/TutorialVideo/Howitworks.mp4"
              className="max-h-[90vh] w-full object-contain"
              autoPlay
              muted
              loop
              playsInline
              controls
            />
          </div>
        </div>
      )}
    </>
  );
}
