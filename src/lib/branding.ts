/**
 * Single source of truth for PT brand logo URL.
 * Use this helper everywhere; do not duplicate fallback logic.
 */

/** Default logo when PT has no custom brand. Place MiloMetal.png in public/assets/. */
const DEFAULT_LOGO_PATH = "/assets/MiloMetal.png";
const FALLBACK_LOGO_PATH = "/brand/milo-logo.svg";

function isValidUrl(s: string | null | undefined): boolean {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type ProfileWithBrandLogo = { brand_logo_url?: string | null } | null | undefined;

/**
 * Returns the PT's brand logo URL, or the default Milo logo path.
 * Use for sidebar, share pages, and PDF export.
 */
export function getBrandLogoUrl(profile: ProfileWithBrandLogo): string {
  if (isValidUrl(profile?.brand_logo_url)) return profile!.brand_logo_url!.trim();
  return DEFAULT_LOGO_PATH;
}

/** Fallback logo if DEFAULT_LOGO_PATH image fails to load (e.g. MiloMetal.png not yet added). */
export function getFallbackLogoUrl(): string {
  return FALLBACK_LOGO_PATH;
}

/** Tier keys used for gating (must match profiles.subscription_tier and billing). */
export type SubscriptionTier = "starter" | "pro" | "elite" | null;

/**
 * Branding (logo & theme) is a Pro feature: unlocked for pro and elite, locked for starter.
 * Use for sidebar badge and branding page gate. Logic in one place.
 */
export function isBrandingUnlocked(subscriptionTier: SubscriptionTier | string | null | undefined): boolean {
  const t = subscriptionTier == null ? null : String(subscriptionTier).toLowerCase();
  return t === "pro" || t === "elite";
}
