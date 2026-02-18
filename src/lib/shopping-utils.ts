/**
 * Shared utilities for meal plan shopping list (PT and public share routes).
 * No DB, no billing, no RLS.
 */

export type GroceryItem = {
  foodId?: string;
  name?: string;
  buy?: string;
  needed?: string;
  estimatedPriceGBP?: number;
  priceBand?: string;
};

export type GrocerySection = {
  label?: string;
  items?: GroceryItem[];
};

export type GroceryTotals = {
  totalPriceGBP?: number;
  estimatedTotalWeek?: number;
  breakdownGBP?: Record<string, number>;
};

/** Stable key for an item (section + name + purchase) for persistence / matching */
export function stableItemKey(
  sectionLabel: string | undefined,
  item: GroceryItem
): string {
  const section = (sectionLabel ?? "").toLowerCase().replace(/\s+/g, "_");
  const name = (item.name ?? item.buy ?? item.foodId ?? "").toLowerCase().replace(/\s+/g, "_");
  const buy = (item.buy ?? "").toLowerCase().replace(/\s+/g, "_");
  return `${section}|${name}|${buy}`;
}

/** At most 2 tags, deterministic from item name and purchase */
export function getSmartTags(item: GroceryItem): string[] {
  const tags: string[] = [];
  const name = (item.name ?? item.buy ?? item.foodId ?? "").toLowerCase();
  const buy = (item.buy ?? "").toLowerCase();

  if (/\b(chicken|turkey|beef|fish|eggs|tofu|lentils|chickpeas)\b/.test(name)) {
    tags.push("High protein");
  }
  if (/\b(oats|rice|potato|potatoes|bread|pasta)\b/.test(name)) {
    tags.push("Carb base");
  }
  if (/\b(olive oil|butter|nut butter|nuts|almonds|walnuts)\b/.test(name)) {
    tags.push("Healthy fats");
  }
  if (/x\s*\d|multi-pack|\d\s*x/i.test(buy)) {
    tags.push("Multi-pack");
  }

  return tags.slice(0, 2);
}

export function formatSectionTitle(label: string): string {
  return (label ?? "OTHER").toUpperCase().replace(/\s+/g, " ");
}

/** True if section is pantry-type (excluded from progress, optional "mark as owned") */
export function isPantrySection(sectionLabel: string | undefined): boolean {
  const raw = (sectionLabel ?? "").trim();
  const upper = raw.toUpperCase();
  if (upper === "PANTRY STAPLES") return true;
  const terms = ["PANTRY", "STAPLES", "SPICES", "CONDIMENTS", "OILS", "SEASONING"];
  return terms.some((t) => upper.includes(t));
}

/** Parse cost from "£7.20" or "7.20" to number */
export function parseCost(value: string): number | null {
  const cleaned = value.replace(/^£\s*/, "").trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function getStrategyBullets(
  content: Record<string, unknown>,
  groceryTotals: GroceryTotals,
  budgetTier: string | undefined
): string[] {
  const bullets: string[] = [];
  const days = (content.days as { totalCalories?: number }[] | undefined) ?? [];
  const hasMultipleDays = days.length >= 3;
  const totalKcal = days.reduce((sum, d) => sum + (d.totalCalories ?? 0), 0);
  const avgDaily = days.length > 0 ? Math.round(totalKcal / days.length) : 0;
  const totalCost = groceryTotals.totalPriceGBP ?? groceryTotals.estimatedTotalWeek ?? 0;

  if (hasMultipleDays && avgDaily > 0) {
    bullets.push("Calorie distribution structured across the week for consistency.");
  }
  if (totalCost > 0) {
    bullets.push("Ingredient overlap optimised to reduce waste.");
  }
  if (budgetTier && budgetTier !== "unknown" && budgetTier !== "—") {
    bullets.push(`Budget aligned to ${budgetTier} tier.`);
  }
  bullets.push("Protein and macros balanced for training and recovery.");
  return bullets.slice(0, 4);
}
