/**
 * Meta (Facebook) Pixel – client-side event tracking only.
 * Guard all calls so they only run in the browser when fbq is available.
 */

export const trackMetaEvent = (event: string, data?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: (a: string, b: string, c?: Record<string, unknown>) => void }).fbq;
  if (typeof fbq !== "function") return;
  fbq("track", event, data ?? {});
};

/**
 * GBP price per tier for Meta Purchase event only.
 * Update to match your Stripe prices if different.
 */
const TIER_PRICE_GBP: Record<string, number> = {
  starter: 19,
  pro: 39,
  elite: 99,
};

export function getTierPriceGbp(tier: string | null | undefined): number | null {
  if (!tier || typeof tier !== "string") return null;
  const price = TIER_PRICE_GBP[tier.toLowerCase()];
  return price != null ? price : null;
}
