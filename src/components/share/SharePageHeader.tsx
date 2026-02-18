"use client";

/**
 * Header strip for public share pages: PT logo (left), "Powered by Milo Hub" (right).
 * Logo height 24–28px, mobile friendly.
 */
export default function SharePageHeader({ brandLogoUrl }: { brandLogoUrl: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-neutral-100 min-h-[52px] flex-wrap">
      <img
        src={brandLogoUrl}
        alt=""
        className="h-7 w-auto max-w-[140px] object-contain object-left shrink-0"
      />
      <span className="text-xs text-neutral-400 shrink-0">Powered by Milo Hub</span>
    </div>
  );
}
