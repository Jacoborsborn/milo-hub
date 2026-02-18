"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type PlanContextualBarProps = {
  clientId: string;
  clientName: string;
  planId: string;
  planType: "meal" | "workout";
  planTitle: string;
  editMode: boolean;
  onEditClick: () => void;
  shareStatus: "idle" | "loading" | "success" | "error";
  onShareClick: () => void;
  exportOpen: boolean;
  onExportToggle: () => void;
  onExportPdf: (path: "meals" | "shopping" | "full") => void;
  /** Only for meal plan: show export options. Workout uses single export. */
  showExportOptions?: boolean;
};

export default function PlanContextualBar({
  clientId,
  clientName,
  planId,
  planType,
  planTitle,
  editMode,
  onEditClick,
  shareStatus,
  onShareClick,
  exportOpen,
  onExportToggle,
  onExportPdf,
  showExportOptions = true,
}: PlanContextualBarProps) {
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current?.contains(e.target as Node) === false && exportOpen) onExportToggle();
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [exportOpen, onExportToggle]);

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 min-h-[52px] flex-wrap">
        {/* Left: Client name */}
        <Link
          href={`/pt/app/clients/${clientId}`}
          className="text-sm font-semibold text-neutral-900 hover:text-neutral-600 truncate min-w-0"
        >
          {clientName}
        </Link>

        {/* Center: Plan title */}
        <p className="text-sm font-medium text-neutral-700 truncate flex-1 min-w-0 text-center px-2" title={planTitle}>
          {planTitle}
        </p>

        {/* Right: Edit, Share, Export */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEditClick}
            className="min-h-[36px] rounded-lg px-3 font-medium border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 text-sm"
          >
            {editMode ? "View" : "Edit"}
          </button>

          {!editMode && (
            <>
              <button
                type="button"
                onClick={onShareClick}
                disabled={shareStatus === "loading"}
                className="min-h-[36px] rounded-lg px-3 font-medium border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 text-sm"
              >
                {shareStatus === "loading" ? "…" : shareStatus === "success" ? "Link copied!" : "Share"}
              </button>

              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={onExportToggle}
                  className="min-h-[36px] rounded-lg px-3 font-medium border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 text-sm inline-flex items-center gap-1"
                >
                  Export
                  <span aria-hidden>▾</span>
                </button>
                {exportOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[999]"
                      onClick={onExportToggle}
                      aria-hidden
                    />
                    <div className="absolute right-0 top-full mt-1 z-[1000] min-w-[200px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                      {showExportOptions && planType === "meal" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onExportPdf("meals");
                              onExportToggle();
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
                          >
                            Export Meals (PDF)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onExportPdf("shopping");
                              onExportToggle();
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
                          >
                            Export Shopping (PDF)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onExportPdf("full");
                              onExportToggle();
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
                          >
                            Export Full Plan (PDF)
                          </button>
                        </>
                      ) : (
                        <a
                          href={`/pt/app/plans/${planId}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={onExportToggle}
                          className="block w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
                        >
                          Export PDF
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
