/**
 * Resolve PT coach display name for "Prepared by: ..." in meal plans.
 * Use profiles.display_name if present, else full_name/name, else fallback.
 */
export function getCoachDisplayName(profile: {
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
} | null | undefined): string {
  if (!profile) return "Your coach";
  const s = (profile.display_name ?? profile.full_name ?? profile.name ?? "").trim();
  return s || "Your coach";
}
