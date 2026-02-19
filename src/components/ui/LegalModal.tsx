"use client";

import { useEffect, useCallback, useRef } from "react";
import { TermsContent } from "@/components/legal/TermsContent";
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export type LegalModalVariant = "terms" | "privacy";

const TITLES: Record<LegalModalVariant, string> = {
  terms: "Terms & Conditions",
  privacy: "Privacy Policy",
};

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: LegalModalVariant;
}

export function LegalModal({ isOpen, onClose, variant }: LegalModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleEscape]);

  // When opening Terms from signup, scroll to #subscription (billing/trial section) if present
  useEffect(() => {
    if (!isOpen || variant !== "terms" || !contentRef.current) return;
    const el = contentRef.current.querySelector("#subscription");
    if (el) {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [isOpen, variant]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div
        ref={contentRef}
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="legal-modal-title" className="text-xl font-semibold text-slate-900">
            {TITLES[variant]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6">
          {variant === "terms" ? <TermsContent /> : <PrivacyContent />}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
