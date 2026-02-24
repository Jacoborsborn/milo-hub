"use client";

export type Tier = "starter" | "pro" | "elite";

export type PricingTier = {
  tier: Tier;
  name: string;
  price: string;
  subtitle: string;
  bullets: string[];
  highlight?: boolean;
};

type PricingCardsProps = {
  tiers: PricingTier[];
  currentTier: string | null;
  subscriptionStatus: string;
  onSelectTier: (tier: Tier) => void;
  loadingTier: Tier | null;
};

export default function PricingCards({
  tiers,
  currentTier,
  subscriptionStatus,
  onSelectTier,
  loadingTier,
}: PricingCardsProps) {
  const isPaidActive = subscriptionStatus === "active";

  return (
    <div className="rounded-3xl border border-neutral-200/80 bg-neutral-50/80 p-6 md:p-10">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {tiers.map((t) => {
          const isCurrentPlan = (currentTier ?? "").toLowerCase() === t.tier;
          const disabled =
            isCurrentPlan ||
            isPaidActive ||
            loadingTier !== null;
          const buttonLabel = loadingTier === t.tier
            ? "Redirecting…"
            : isCurrentPlan
              ? "Current plan"
              : isPaidActive
                ? "Already Active"
                : `Start ${t.name}`;

          return (
            <div
              key={t.tier}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 text-left transition-transform md:p-8 ${
                t.highlight
                  ? "scale-[1.02] border-blue-200/60 shadow-md md:shadow-lg"
                  : "border-neutral-200 shadow-sm"
              }`}
              style={
                t.highlight
                  ? { boxShadow: "0 20px 40px rgba(37,99,235,0.12)" }
                  : undefined
              }
            >
              {t.highlight && (
                <div
                  className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-3 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                  style={{ boxShadow: "0 4px 14px rgba(29,78,216,0.25)" }}
                >
                  Most Popular
                </div>
              )}

              <h3 className="text-xl font-semibold text-neutral-900">{t.name}</h3>
              <p className="mt-2 text-sm text-neutral-500">{t.price}</p>
              <p className="mt-1 text-sm text-neutral-600">
                {t.tier === "starter" && "Up to 10 clients"}
                {t.tier === "pro" && "Up to 30 clients"}
                {t.tier === "elite" && "Up to 100 clients"}
              </p>

              <div className="my-4 h-px bg-neutral-200" />

              <ul className="space-y-2 text-sm leading-relaxed text-neutral-600">
                {t.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>

              <p className="mt-4 text-[13px] text-neutral-500">7-day free trial</p>

              <button
                type="button"
                onClick={() => onSelectTier(t.tier)}
                disabled={disabled}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-xl font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: disabled ? "#9ca3af" : "#2563eb",
                }}
              >
                {buttonLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
