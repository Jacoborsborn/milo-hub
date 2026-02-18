/**
 * Pack selection for grocery pricing: choose packs that cover needed_g
 * Objective (order): minimize total cost, then overbuy (waste_g), then pack count.
 * Any single pack that covers need is allowed (no waste cap).
 * is_preferred packs can win if within +£0.20 of cheapest.
 */

export interface PackOption {
  pack_id: string;
  pack_g: number;
  price_gbp: number;
  store?: string;
  tier?: string;
  is_preferred?: boolean;
}

export interface ChosenPack {
  pack_id: string;
  pack_g: number;
  price_gbp: number;
  qty: number;
}

export interface PackSelectionResult {
  chosenPacks: ChosenPack[];
  total_pack_g: number;
  total_price_gbp: number;
  waste_g: number;
}

const PREFERRED_BONUS_GBP = 0.2;

/**
 * Select packs to cover needed_g.
 * Objective: (1) minimize total_price_gbp, (2) minimize waste_g, (3) minimize pack count.
 * Single pack that covers need is always considered (no max-waste filter).
 */
export function selectPacks(
  needed_g: number,
  packs: PackOption[],
  options?: { preferTier?: string; preferredBonusGBP?: number }
): PackSelectionResult | null {
  if (!packs?.length || needed_g <= 0) return null;

  const tier = options?.preferTier?.toLowerCase();
  const bonus = options?.preferredBonusGBP ?? PREFERRED_BONUS_GBP;
  const filtered = tier
    ? packs.filter((p) => !p.tier || p.tier === tier)
    : packs;
  const list = filtered.length ? filtered : packs;

  let best: PackSelectionResult | null = null;

  // Single pack: any pack that covers need (pack_g >= needed_g)
  for (const p of list) {
    if (p.pack_g < needed_g) continue;
    const waste = p.pack_g - needed_g;
    const total_price_gbp = p.price_gbp;
    const candidate: PackSelectionResult = {
      chosenPacks: [{ pack_id: p.pack_id, pack_g: p.pack_g, price_gbp: p.price_gbp, qty: 1 }],
      total_pack_g: p.pack_g,
      total_price_gbp,
      waste_g: waste,
    };
    if (!best || compare(best, candidate) > 0) best = candidate;
  }

  // Two packs (same or different) when no single pack covers or we can do cheaper
  for (let i = 0; i < list.length; i++) {
    for (let j = i; j < list.length; j++) {
      const p1 = list[i];
      const p2 = list[j];
      const total_g = p1.pack_g + p2.pack_g;
      if (total_g < needed_g) continue;
      const waste = total_g - needed_g;
      const total_price_gbp = p1.price_gbp + p2.price_gbp;
      const chosenPacks: ChosenPack[] = i === j
        ? [{ pack_id: p1.pack_id, pack_g: p1.pack_g, price_gbp: p1.price_gbp, qty: 2 }]
        : [
            { pack_id: p1.pack_id, pack_g: p1.pack_g, price_gbp: p1.price_gbp, qty: 1 },
            { pack_id: p2.pack_id, pack_g: p2.pack_g, price_gbp: p2.price_gbp, qty: 1 },
          ];
      const candidate: PackSelectionResult = {
        chosenPacks,
        total_pack_g: total_g,
        total_price_gbp,
        waste_g: waste,
      };
      if (!best || compare(best, candidate) > 0) best = candidate;
    }
  }

  if (!best) return null;

  // Prefer solution that uses is_preferred pack if within +bonus of best price
  let withPreferred: PackSelectionResult | null = null;
  for (const p of list) {
    if (!p.is_preferred) continue;
    if (p.pack_g >= needed_g && p.price_gbp <= best.total_price_gbp + bonus) {
      const candidate: PackSelectionResult = {
        chosenPacks: [{ pack_id: p.pack_id, pack_g: p.pack_g, price_gbp: p.price_gbp, qty: 1 }],
        total_pack_g: p.pack_g,
        total_price_gbp: p.price_gbp,
        waste_g: p.pack_g - needed_g,
      };
      if (!withPreferred || compare(withPreferred, candidate) > 0) withPreferred = candidate;
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i; j < list.length; j++) {
      const p1 = list[i];
      const p2 = list[j];
      if (!p1.is_preferred && !p2.is_preferred) continue;
      const total_g = p1.pack_g + p2.pack_g;
      if (total_g < needed_g) continue;
      const total_price_gbp = p1.price_gbp + p2.price_gbp;
      if (total_price_gbp > best.total_price_gbp + bonus) continue;
      const waste = total_g - needed_g;
      const chosenPacks: ChosenPack[] = i === j
        ? [{ pack_id: p1.pack_id, pack_g: p1.pack_g, price_gbp: p1.price_gbp, qty: 2 }]
        : [
            { pack_id: p1.pack_id, pack_g: p1.pack_g, price_gbp: p1.price_gbp, qty: 1 },
            { pack_id: p2.pack_id, pack_g: p2.pack_g, price_gbp: p2.price_gbp, qty: 1 },
          ];
      const candidate: PackSelectionResult = {
        chosenPacks,
        total_pack_g: total_g,
        total_price_gbp,
        waste_g: waste,
      };
      if (!withPreferred || compare(withPreferred, candidate) > 0) withPreferred = candidate;
    }
  }
  if (withPreferred && withPreferred.total_price_gbp <= best.total_price_gbp + bonus) {
    return withPreferred;
  }
  return best;
}

/** Compare: lower cost wins, then lower waste, then fewer packs */
function compare(a: PackSelectionResult, b: PackSelectionResult): number {
  if (a.total_price_gbp !== b.total_price_gbp) return a.total_price_gbp - b.total_price_gbp;
  if (a.waste_g !== b.waste_g) return a.waste_g - b.waste_g;
  const countA = a.chosenPacks.reduce((s, c) => s + c.qty, 0);
  const countB = b.chosenPacks.reduce((s, c) => s + c.qty, 0);
  return countA - countB;
}
