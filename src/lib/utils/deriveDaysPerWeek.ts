/**
 * Derive days-per-week from various possible keys (camelCase, snake_case, aliases).
 * Used so template/client merge and edge validation agree on one value.
 * Returns 0 if no valid value found (caller should treat as invalid).
 */
export function deriveDaysPerWeek(input: unknown): number {
  if (input == null || typeof input !== "object") return 0;
  const o = input as Record<string, unknown>;
  const keys: (keyof typeof o)[] = [
    "daysPerWeek",
    "days_per_week",
    "days",
    "frequencyPerWeek",
    "trainingDaysPerWeek",
    "sessionsPerWeek",
  ];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && !Number.isNaN(v) && v >= 1 && v <= 7) return Math.round(v);
    if (typeof v === "string") {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 7) return n;
    }
  }
  return 0;
}
