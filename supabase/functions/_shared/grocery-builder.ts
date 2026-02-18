// supabase/functions/_shared/grocery-builder.ts
// Deterministic grocery list builder using grocery_rules_uk.json (1:1 map from FOOD_MAP_PACKS_AND_PRICES.txt)
// No AI calls - pure code-based calculation
// Pack catalog (pack_catalog.json) used when available for multi-pack pricing.
//
// PACK SELECTION AUDIT (v1 behavior)
// - Grocery rules (grocery_rules_uk.json) currently define a single pack per item via `pack`,
//   but this builder also supports v2-style entries with `packs[]` (it will take ONLY the first entry).
// - For items without a packCatalog entry, packs are computed using simple rounding:
//   - weight/volume packs: packsNeeded = ceil(purchaseGrams / packSize)
//   - multi-pack count items: itemsNeeded = purchaseGrams / (packSize / packCount), then
//     packsNeeded = ceil(itemsNeeded / packCount)
//   - per-item count items: packsNeeded = ceil(purchaseGrams / packSize)
// - When a packCatalog entry exists (weight/volume only), selection is delegated to `selectPacks`,
//   which chooses 1–2 catalogue packs to cover the need, minimizing waste first and then price.
// - No extra rounding (e.g. to nearest 10g) is applied before pack math: purchaseGrams is either
//   the aggregated cooked grams or that value multiplied by cookedToDryFactor, and display rounding
//   happens only when formatting strings.

import groceryRulesData from "./grocery_rules_uk.json" with { type: "json" };
import packCatalogImport from "./pack_catalog.json" with { type: "json" };
import { type Food, FOODS_DATA } from "./food-map";
import { FOODS_BY_ID_LEAN, resolveToLeanId } from "./food-map.lean";
import { selectPacks } from "./pack-selector";

const UNIT_CONVERSION_AUDIT = Deno.env.get("UNIT_CONVERSION_AUDIT") === "true";
const COOKED_DRY_AUDIT = Deno.env.get("COOKED_DRY_AUDIT") === "true";
const COOKED_DRY_LOOKUP_FALLBACK = Deno.env.get("COOKED_DRY_LOOKUP_FALLBACK") === "true";
const PACK_AUDIT_ENABLED = Deno.env.get("GROCERY_PACK_AUDIT") === "true";
const GROCERY_UNIT_DEBUG = Deno.env.get("GROCERY_UNIT_DEBUG") === "true";

// --- Unit normalization helpers (safe, no density-based conversions) ---
function normalizePlanAmount(
  amount: number,
  unit: string | undefined
): { value: number; family: "g" | "ml" | "count" | "unknown"; reason?: string } {
  const u = (unit ?? "").trim().toLowerCase();
  const val = Number(amount);
  const safeVal = typeof val === "number" && !Number.isNaN(val) ? val : 0;

  if (["unit", "units", "each", "piece", "pieces", "pcs", "count"].includes(u)) {
    return { value: safeVal, family: "count" };
  }
  if (["g", "gram", "grams"].includes(u)) return { value: safeVal, family: "g" };
  if (["kg", "kilogram", "kilograms"].includes(u)) return { value: safeVal * 1000, family: "g" };
  if (["ml", "millilitre", "millilitres"].includes(u)) return { value: safeVal, family: "ml" };
  if (["l", "litre", "litres"].includes(u)) return { value: safeVal * 1000, family: "ml" };
  if (u === "tbsp") return { value: safeVal * 15, family: "ml" };
  if (u === "tsp") return { value: safeVal * 5, family: "ml" };

  if (u === "" || u === undefined) return { value: safeVal, family: "g" }; // default
  return { value: safeVal, family: "unknown", reason: `unsupported_unit:${u}` };
}

function normalizeRulePack(pack: any): {
  packSize: number;
  family: "g" | "ml" | "count" | "unknown";
  meta?: { estimatedWeightG?: number; multipackCount?: number };
  reason?: string;
} {
  if (!pack || typeof pack !== "object") {
    return { packSize: 1, family: "unknown", reason: "pack_missing" };
  }
  if (typeof pack.sizeG === "number" && !Number.isNaN(pack.sizeG) && pack.sizeG > 0) {
    return {
      packSize: pack.sizeG,
      family: "g",
      meta: {
        estimatedWeightG: typeof pack.estimatedWeightG === "number" ? pack.estimatedWeightG : undefined,
        multipackCount: typeof pack.multipackCount === "number" ? pack.multipackCount : pack.count,
      },
    };
  }
  if (typeof pack.sizeML === "number" && !Number.isNaN(pack.sizeML) && pack.sizeML > 0) {
    return {
      packSize: pack.sizeML,
      family: "ml",
      meta: {
        estimatedWeightG: typeof pack.estimatedWeightG === "number" ? pack.estimatedWeightG : undefined,
        multipackCount: typeof pack.multipackCount === "number" ? pack.multipackCount : pack.count,
      },
    };
  }
  const packUnit = (pack.unit ?? "").toString().toLowerCase();
  if (packUnit === "count") {
    const multipack = typeof pack.multipackCount === "number" ? pack.multipackCount : pack.count;
    if (typeof multipack === "number" && !Number.isNaN(multipack) && multipack > 0) {
      return {
        packSize: multipack,
        family: "count",
        meta: { estimatedWeightG: typeof pack.estimatedWeightG === "number" ? pack.estimatedWeightG : undefined, multipackCount: multipack },
      };
    }
    return { packSize: 1, family: "unknown", reason: "count_pack_missing_count" };
  }
  if (packUnit === "pack") {
    return { packSize: 1, family: "count", meta: undefined };
  }
  return { packSize: 1, family: "unknown", reason: "pack_missing_size" };
}

/** Display-only: format "(need: …)" as "X units ~Yg" for whitelisted produce. Does not change pack or normalization. */
function formatNeedForDisplay(params: {
  id: string;
  neededValue: number;
  neededFamily: "g" | "ml" | "count";
  rule: any;
  groceryRulesInput: any;
}): string {
  const { id, neededValue, neededFamily, rule, groceryRulesInput } = params;
  if (neededFamily !== "g") return "";
  const metaWeights = groceryRulesInput?.meta?.unitWeightG as Record<string, number> | undefined;
  let unitWeightG: number | undefined = metaWeights?.[id];
  if (unitWeightG == null && typeof rule?.pack?.sizeG === "number" && rule.pack.sizeG > 0) {
    unitWeightG = rule.pack.sizeG;
  }
  if (unitWeightG == null || unitWeightG <= 0 || !Number.isFinite(neededValue)) return "";
  const WHITELIST = ["banana", "apple", "avocado", "pear", "orange", "kiwi", "lemon", "onion_plain", "red_onion"];
  if (!WHITELIST.includes(id)) return "";
  const units = Math.max(1, Math.round(neededValue / unitWeightG));
  return `${units} units ~${Math.round(neededValue)}g`;
}

/** Map lean food IDs (meal/macros) to grocery rule IDs when they differ. Fixes "Unmapped" for quinoa, almond milk, etc. */
const LEAN_TO_GROCERY_RULE_ID: Record<string, string> = {
  quinoa_cooked: "quinoa",
  couscous_cooked: "couscous",
  sweet_potato_raw: "sweet_potato",
  brown_rice_cooked: "brown_rice",
  almond_milk: "almond_milk_unsweetened",
  chickpeas_cooked: "chickpeas",
  lentils_cooked: "lentils",
  turkey_mince_5: "turkey_mince_5_fat",
  beef_mince_5: "beef_mince_5_fat",
  white_rice_cooked: "white_rice",
  basmati_rice_cooked: "basmati_rice",
  oat_milk: "oat_milk_unsweetened",
  soy_milk: "soy_milk_unsweetened",
  tuna_can: "tuna_can",
  mince: "ground_beef",
  beef: "beef_lean",
  bread: "white_bread",
  dragonfruit: "dragon_fruit",
  peanut: "peanuts",
  rocket: "rocket_arugula",
  sourdough: "sourdough_bread",
  mackerel_smoked: "smoked_mackerel",
  greek_yogurt_0: "greek_yogurt_0_fat",
  greek_yogurt_5: "greek_yogurt_5_fat",
  greek_yogurt_honey: "greek_yogurt_with_honey",
  onion_plain: "onion",
  jasmine_rice_cooked: "jasmine_rice",
  black_beans_cooked: "black_beans",
  kidney_beans_cooked: "kidney_beans",
  pea_milk: "pea_milk_unsweetened",
  rice_milk: "rice_milk_unsweetened",
  turkey_slice: "turkey_slices_deli",
  udon_noodles_cooked: "udon_noodles",
  sardines_canned: "sardines_canned_in_water",
  beef_mince_10: "beef_mince_10_fat",
  cocoa_powder: "cocoa_powder_unsweetened",
  coconut_milk_plain: "coconut_milk",
  herbs: "dried_mixed_herbs",
  focaccia: "focaccia_bread",
  honeydew: "honeydew_melon",
  edamame: "edamame_soy_beans",
  pita_white: "pita_bread_white",
  tamari: "tamari_gluten_free_soy_sauce",
  vegan_cheese: "vegan_cheese_coconut_oil_base",
  pickles: "pickled_cucumbers",
};

/** Food IDs that appear on the grocery list only when budget tier is "high". Omitted for low/medium. */
const HIGH_ONLY_BUDGET_FOOD_IDS = new Set<string>(["maple_syrup"]);

/**
 * UNIT / FORM CONVERSION OVERVIEW
 *
 * - Macros path converts units/slices/wraps → grams/ml in the app layer
 *   (see `src/utils/ingredientNormalizer.js` and `docs/UNIT_AND_DRY_TO_COOKED_CONVERSION.md`).
 * - This grocery builder aggregates ingredient amounts in grams (or ml for liquids)
 *   into `ingredientTotals`, then maps them to `grocery_rules_uk.json` packs.
 * - Count / "each" items (eggs, bananas, avocados, etc.) are handled by converting counts
 *   to grams using grocery rule pack metadata (packSize/packCount), `meta.unitWeightG`,
 *   and any per-piece grams stored on foods/JSON; `packUnit === "count"` controls pack math.
 * - Liquids are treated in ml whenever `packUnit === "ml"`; otherwise they are treated as grams.
 *   This module does not apply any generic ml↔g density conversion helper.
 * - Cooked↔dry purchase conversion is applied only via `rule.cookedToDryFactor` in this file;
 *   the frontend hint UI additionally checks `purchase.form === "dry"` when showing dry estimates.
 */

type PackCatalogEntry = { pack_id: string; pack_g: number; price_gbp: number; store: string; tier: string; is_preferred: boolean }[];
const packCatalog: Record<string, PackCatalogEntry> = (typeof packCatalogImport === "object" && packCatalogImport !== null ? packCatalogImport : {}) as Record<string, PackCatalogEntry>;

// v2 pack (one entry per pack line in TXT)
interface GroceryV2Pack {
  sizeG?: number;
  sizeML?: number;
  count?: number;
  estimatedWeightG?: number;
  displayLabel?: string;
  priceGBP: number;
  notes?: string;
}

interface GroceryRuleItem {
  id: string;
  displayName: string;
  category: string;
  purchase?: {
    form: string;
    cookedToDryFactor: number;
    uiNote?: string;
  };
  pack?: {
    sizeG?: number;
    sizeML?: number;
    unit?: string;
    count?: number;
    estimatedWeightG?: number;
    multipackCount?: number;
    displayLabel?: string;
    priceGBP: number;
  };
  packs?: GroceryV2Pack[]; // v2: one entry per pack line
  forceWeeklyPacks?: number;
  maxPacksPerWeek?: number;
  isHouseholdStaple?: boolean;
}

interface GroceryRulesData {
  meta?: {
    version?: string;
    notes?: string[];
  };
  items: GroceryRuleItem[];
}

interface GroceryRule {
  category: string;
  packSize: number;
  packUnit: string;
  packDisplayLabel?: string; // For count packs: e.g., "3 pack", "1 bulb"
  packCount?: number; // Number of items per pack (for multi-packs: 6 for 6-pack, 1 for per-item)
  priceGBP: number;
  maxPacksPerWeek: number;
  isPantry: boolean;
  cookedToDryFactor?: number; // For cooked items purchased as dry
  forceWeeklyPacks?: number; // Optional: force a specific number of packs per week
}

interface GroceryItem {
  foodId: string; // Food ID for ID-based matching (no reverse lookup needed)
  name: string;
  buy: string;
  needed: string;
  estimatedPriceGBP: number;
  priceBand: string;
}

interface GrocerySection {
  label: string;
  items: GroceryItem[];
}

interface GroceryList {
  grocerySections: GrocerySection[];
  groceryTotals: {
    totalPriceGBP: number;
    breakdownGBP: Record<string, number>;
    estimatedTotalWeek: number;
  };
}

/** Debug explain line per grocery item (when options.debugExplain is true) */
export interface GroceryExplainLine {
  nameRequested: string;
  resolvedFoodId: string;
  resolvedDisplayName: string;
  category: string;
  needed: { value: number; unit: string };
  normalizedNeededGramsOrMl: number;
  candidatePacks: Array<{ packId: string; size: { value: number; unit: string }; normalizedSize: number; price: number; store?: string; notes?: string }>;
  chosenPacks: Array<{ packId: string; count: number }>;
  totals: { boughtNormalized: number; overbuyNormalized: number; cost: number };
  mappingStatus: "mapped" | "unmapped";
  reasonIfUnmapped?: string;
}

/**
 * Pluralize a word based on count
 */
function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  
  const lower = word.toLowerCase();
  
  // Special cases
  if (lower === 'broccoli') return 'Broccoli heads';
  if (lower === 'tomatoes') return 'Tomatoes'; // Already plural
  if (lower === 'spring onions' || lower === 'spring_onions') return 'Spring onions'; // Already plural
  
  // Standard rules
  if (lower.endsWith('y') && !lower.endsWith('ay') && !lower.endsWith('ey') && !lower.endsWith('oy') && !lower.endsWith('uy')) {
    return word.slice(0, -1) + 'ies';
  }
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z')) {
    return word + 'es';
  }
  if (lower.endsWith('ch') || lower.endsWith('sh')) {
    return word + 'es';
  }
  if (lower.endsWith('f') && !lower.endsWith('ff')) {
    return word.slice(0, -1) + 'ves';
  }
  if (lower.endsWith('fe')) {
    return word.slice(0, -2) + 'ves';
  }
  return word + 's';
}

/**
 * Build grocery list from meal plan days
 * @param planDays - Array of day objects with meals and ingredients
 * @param foodsMap - Food map (FOODS_BY_ID_LEAN)
 * @param groceryRulesData - Grocery rules JSON
 * @param budgetTier - Budget tier (low/medium/high) - affects priceBand only
 * @returns Grocery list object
 */
export function buildGroceryListFromPlan(
  planDays: any[],
  foodsMap: Record<string, Food>,
  groceryRulesInput: any,
  budgetTier: string = 'low',
  options?: { debugExplain?: boolean }
): GroceryList & { groceryExplain?: GroceryExplainLine[] } {
  const startTime = Date.now();
  const debugExplain = options?.debugExplain ?? (typeof Deno !== "undefined" && Deno.env.get("DEBUG_GROCERY_EXPLAIN") === "true");
  const explainLines: GroceryExplainLine[] = [];

  // Extract unitWeightG from meta for count-based calculations
  const unitWeightG: Record<string, number> = (groceryRulesInput.meta?.unitWeightG || {}) as Record<string, number>;

   // Raw grocery items map (used only for audits / metadata inspection)
   const rawGroceryItemsById: Record<string, any> = {};

  // Convert new structure (items array) to lookup map by foodId
  const groceryRulesData: Record<string, GroceryRule> = {};
  
  // Check if it's the new structure (has items array) or old structure (flat object)
  if (groceryRulesInput.items && Array.isArray(groceryRulesInput.items)) {
    // New structure: convert items array to lookup map
    (groceryRulesInput as GroceryRulesData).items.forEach((item: GroceryRuleItem) => {
      rawGroceryItemsById[item.id] = item;

      // v2 format has packs[]; use first pack as the effective pack for rule lookup
      let pack = item.pack;
      if (!pack && item.packs && item.packs.length > 0) {
        const p = item.packs[0];
        pack = {
          sizeG: p.sizeG,
          sizeML: p.sizeML,
          count: p.count,
          estimatedWeightG: p.estimatedWeightG,
          multipackCount: p.count,
          displayLabel: p.displayLabel,
          priceGBP: p.priceGBP,
          unit: p.count != null ? 'count' : (p.sizeML != null ? 'ml' : (p.sizeG != null ? 'g' : 'pack')),
        };
      }
      if (!pack) return;

      // Determine pack size and unit
      let packSize = 0;
      let packUnit = 'g';
      
      let packDisplayLabel: string | undefined = undefined;
      
      // Extract pack count from multipackCount field or parse from unit string
      let packCount = 1; // Default for per-item
      
      if (pack.multipackCount) {
        packCount = pack.multipackCount;
      } else if (pack.unit && typeof pack.unit === 'string' && pack.unit.includes('-pack')) {
        const match = pack.unit.match(/(\d+)-pack/);
        packCount = match ? parseInt(match[1], 10) : 1;
      } else if (pack.count) {
        packCount = pack.count;
      }
      
      if (pack.sizeG !== undefined) {
        packSize = pack.sizeG;
        packUnit = 'g';
      } else if (pack.sizeML !== undefined) {
        packSize = pack.sizeML;
        packUnit = 'ml';
      } else if (pack.unit === 'pack' || (pack.count === 1 && pack.sizeG == null && pack.sizeML == null)) {
        // Pack-based items (seasonings, herbs, etc.) - always 1 pack when present
        packUnit = 'pack';
        packCount = 1;
        packSize = 1;
        packDisplayLabel = pack.displayLabel || '1 pack';
      } else if (pack.unit === 'count' || pack.unit === 'per-item' || (pack.unit && typeof pack.unit === 'string' && pack.unit.includes('-pack')) || pack.count != null) {
        if (pack.unit === 'per-item' && pack.estimatedWeightG) {
          packSize = pack.estimatedWeightG;
          packUnit = 'count';
          packCount = 1;
        } else if (packCount > 1) {
          const itemWeight = pack.estimatedWeightG || unitWeightG[item.id] || 100;
          packSize = itemWeight * packCount;
          packUnit = 'count';
        } else {
          packSize = pack.estimatedWeightG || pack.count || 1;
          packUnit = 'count';
        }
        packDisplayLabel = pack.displayLabel;
        if (!packDisplayLabel && packCount > 1) {
          packDisplayLabel = `${packCount}-pack`;
        } else if (!packDisplayLabel && packCount === 1) {
          packDisplayLabel = undefined;
        }
      } else {
        packSize = 500;
        packUnit = 'g';
      }
      
      const hasForceWeeklyPacks = item.forceWeeklyPacks !== undefined && item.forceWeeklyPacks !== null;
      
      if (!item.category) {
        console.warn(`⚠️ [Grocery Builder] GroceryMap.json item "${item.id}" missing category field - this should not happen`);
      }
      
      groceryRulesData[item.id] = {
        category: item.category || 'Pantry / Staples',
        packSize,
        packUnit,
        packDisplayLabel,
        packCount,
        priceGBP: pack.priceGBP,
        maxPacksPerWeek: item.maxPacksPerWeek || item.forceWeeklyPacks || 999, // Use maxPacksPerWeek if set, else forceWeeklyPacks, else default 999 (no cap)
        forceWeeklyPacks: hasForceWeeklyPacks ? item.forceWeeklyPacks : undefined, // Store separately for logic check
        isPantry: item.isHouseholdStaple || false,
        cookedToDryFactor: item.purchase?.cookedToDryFactor
      };
      
      // Log category assignment for verification (first 5 items only)
      if (Object.keys(groceryRulesData).length <= 5) {
        console.log(`   📋 [Grocery Builder] Loaded rule for ${item.id}: category="${item.category}" from GroceryMap.json`);
      }
    });
  } else {
    // Old structure: already a flat object, convert to new format
    for (const [foodId, rule] of Object.entries(groceryRulesInput as Record<string, any>)) {
      const oldRule = rule as any;
      rawGroceryItemsById[foodId] = oldRule;
      const packSize = oldRule.defaultPack?.size || oldRule.pack?.sizeG || oldRule.pack?.sizeML || 500;
      const packUnit = oldRule.defaultPack?.unit || oldRule.pack?.unit || (oldRule.pack?.sizeML ? 'ml' : 'g');
      
      groceryRulesData[foodId] = {
        category: oldRule.category || 'Other',
        packSize,
        packUnit,
        priceGBP: oldRule.priceGBP || 0,
        maxPacksPerWeek: oldRule.maxPacksPerWeek || 20,
        isPantry: oldRule.pantryStaple || oldRule.pantry || oldRule.isHouseholdStaple || false,
        cookedToDryFactor: oldRule.cookedToDryFactor || oldRule.purchase?.cookedToDryFactor
      };
    }
  }
  
  // Optional dev-only audit: ensure every FOODS_DATA id has a grocery rule
  if (Deno.env.get("GROCERY_ID_AUDIT") === "true") {
    try {
      const groceryRuleIds = new Set(Object.keys(groceryRulesData));
      const missingFromGrocery: string[] = [];

      for (const food of FOODS_DATA) {
        if (!groceryRuleIds.has(food.id)) {
          missingFromGrocery.push(food.id);
        }
      }

      missingFromGrocery.sort();
      console.log(
        `🧾 [GROCERY_ID_AUDIT] Missing grocery rules for ${missingFromGrocery.length} FOODS_DATA ids`,
      );
      if (missingFromGrocery.length > 0) {
        console.log(
          "[GROCERY_ID_AUDIT] Missing ids:",
          JSON.stringify(missingFromGrocery, null, 2),
        );
      }
    } catch (err) {
      console.error("[GROCERY_ID_AUDIT] Audit failed:", err);
    }
  }

  // Dev-only audit A: UNIT_CONVERSION_AUDIT
  if (UNIT_CONVERSION_AUDIT) {
    try {
      const totalFoods = FOODS_DATA.length;
      let gramsBasedCount = 0;
      let eachBasedCount = 0;
      let mlBasedCount = 0;
      const missingUnitG: string[] = [];
      const missingMlHandling: string[] = [];

      // Optional extra per-unit grams from grocery rules JSON (v2 supports defaultUnit.grams per id)
      const defaultUnitGramsFromRules: Record<string, number> = {};
      for (const [id, raw] of Object.entries(rawGroceryItemsById)) {
        const du = (raw as any).defaultUnit;
        if (du && typeof du.grams === "number" && du.grams > 0) {
          defaultUnitGramsFromRules[id] = du.grams;
        }
      }

      for (const food of FOODS_DATA) {
        const id = food.id;
        const defaultUnit = (food as any).defaultUnit;
        const rule = groceryRulesData[id];
        const packUnit = rule?.packUnit;

        let isEachBased = false;
        let isMlBased = false;

        // ml-based: liquids in food map or grocery rules
        if (defaultUnit === "ml" || packUnit === "ml") {
          isMlBased = true;
        }

        // each-based: unit-style foods or count-based packs
        const isEachByUnit =
          defaultUnit === "units" ||
          defaultUnit === "unit" ||
          defaultUnit === "count" ||
          packUnit === "count" ||
          packUnit === "eggs" ||
          packUnit === "bulb";

        if (isEachByUnit) {
          isEachBased = true;
        }

        const hasPerPieceMeta =
          typeof (food as any).perPieceGrams === "number" && (food as any).perPieceGrams > 0;

        const hasRuleDefaultUnitGrams =
          typeof defaultUnitGramsFromRules[id] === "number" && defaultUnitGramsFromRules[id] > 0;

        const eachCandidate = isEachByUnit || hasPerPieceMeta || hasRuleDefaultUnitGrams;

        if (isMlBased) {
          mlBasedCount += 1;

          // For ml-based foods we expect grocery rules to keep them as ml;
          // if packUnit is not ml we currently have no ml↔g density helper here.
          const hasConsistentMlHandling = packUnit === "ml";
          if (!hasConsistentMlHandling) {
            missingMlHandling.push(id);
          }
        }

        if (isEachBased) {
          eachBasedCount += 1;
        }

        if (eachCandidate) {
          // "unitG" coverage: any grams-per-piece metadata we can find
          const perPieceFromFood = (food as any).perPieceGrams;
          const idWithoutUnderscores = id.replace(/_/g, "");
          let perUnitFromMeta = unitWeightG[id];
          if (!perUnitFromMeta && unitWeightG[idWithoutUnderscores]) {
            perUnitFromMeta = unitWeightG[idWithoutUnderscores];
            console.log(
              `   ⚠️ [UNIT_CONVERSION_AUDIT] underscore-normalized unitWeightG hit: ${id} -> ${idWithoutUnderscores}`,
            );
          }
          const perUnitFromRules = defaultUnitGramsFromRules[id];

          const hasUnitG =
            (typeof perPieceFromFood === "number" && perPieceFromFood > 0) ||
            (typeof perUnitFromMeta === "number" && perUnitFromMeta > 0) ||
            (typeof perUnitFromRules === "number" && perUnitFromRules > 0);

          if (!hasUnitG) {
            missingUnitG.push(id);
          }
        }

        if (!isEachBased && !isMlBased) {
          gramsBasedCount += 1;
        }
      }

      console.log(
        `🧮 [UNIT_CONVERSION_AUDIT] totalFoods=${totalFoods}, gramsBased=${gramsBasedCount}, eachBased=${eachBasedCount}, mlBased=${mlBasedCount}`,
      );

      if (missingUnitG.length > 0) {
        console.log(
          `[UNIT_CONVERSION_AUDIT] MISSING_unitG count=${missingUnitG.length}, first50=${JSON.stringify(
            missingUnitG.slice(0, 50),
          )}`,
        );
      }

      if (missingMlHandling.length > 0) {
        console.log(
          `[UNIT_CONVERSION_AUDIT] MISSING_ml_handling count=${missingMlHandling.length}, first50=${JSON.stringify(
            missingMlHandling.slice(0, 50),
          )}`,
        );
      }
    } catch (err) {
      console.error("[UNIT_CONVERSION_AUDIT] Audit failed:", err);
    }
  }

  // Dev-only audit B: COOKED_DRY_AUDIT
  if (COOKED_DRY_AUDIT) {
    try {
      const cookedIds = FOODS_DATA.filter((f) => f.id.endsWith("_cooked")).map((f) => f.id);
      const okExact: string[] = [];
      const okStripped: string[] = [];
      const missingRule: string[] = [];
      const missingFactor: string[] = [];
      const suspiciousFactor: string[] = [];

      for (const cookedId of cookedIds) {
        const exactRule = groceryRulesData[cookedId];
        const baseId = cookedId.replace(/_cooked$/, "");
        const strippedRule = groceryRulesData[baseId];

        let ruleKey: "exact" | "stripped" | "none" = "none";
        let ruleForAudit: GroceryRule | undefined = undefined;

        if (exactRule) {
          ruleKey = "exact";
          ruleForAudit = exactRule;
          okExact.push(cookedId);
        } else if (strippedRule) {
          ruleKey = "stripped";
          ruleForAudit = strippedRule;
          okStripped.push(cookedId);
        } else {
          missingRule.push(cookedId);
        }

        if (ruleForAudit) {
          const rawKey = ruleKey === "stripped" ? baseId : cookedId;
          const raw = rawGroceryItemsById[rawKey] as any | undefined;
          const purchase = raw?.purchase;

          const hasDryForm = purchase?.form === "dry";
          const hasFactor =
            (typeof purchase?.cookedToDryFactor === "number" && purchase.cookedToDryFactor > 0) ||
            (typeof ruleForAudit.cookedToDryFactor === "number" && ruleForAudit.cookedToDryFactor > 0);

          if (hasDryForm && !hasFactor) {
            missingFactor.push(`${cookedId} (ruleKey=${rawKey})`);
          }

          if (!hasDryForm && hasFactor) {
            suspiciousFactor.push(`${cookedId} (ruleKey=${rawKey})`);
          }
        }
      }

      console.log(
        `🥘 [COOKED_DRY_AUDIT] cookedIds=${cookedIds.length}, OK_exact=${okExact.length}, OK_stripped=${okStripped.length}, MISSING_rule=${missingRule.length}, MISSING_factor=${missingFactor.length}, SUSPICIOUS_factor=${suspiciousFactor.length}`,
      );

      if (missingRule.length > 0) {
        console.log(
          `[COOKED_DRY_AUDIT] MISSING_rule ids (first 50): ${JSON.stringify(missingRule.slice(0, 50))}`,
        );
      }

      if (missingFactor.length > 0) {
        console.log(
          `[COOKED_DRY_AUDIT] MISSING_factor ids (first 50): ${JSON.stringify(
            missingFactor.slice(0, 50),
          )}`,
        );
      }

      if (suspiciousFactor.length > 0) {
        console.log(
          `[COOKED_DRY_AUDIT] SUSPICIOUS_factor ids (first 50): ${JSON.stringify(
            suspiciousFactor.slice(0, 50),
          )}`,
        );
      }
    } catch (err) {
      console.error("[COOKED_DRY_AUDIT] Audit failed:", err);
    }
  }

  // Dev-only audit C: PACK_AUDIT (rule/schema coverage)
  if (PACK_AUDIT_ENABLED) {
    try {
      const multiPackDetails: { id: string; packs: Array<{ sizeG: number | null; sizeML: number | null; count: number | null; priceGBP: number }> }[] = [];
      const multiPackIds: string[] = [];

      for (const [id, raw] of Object.entries(rawGroceryItemsById)) {
        const packs = (raw as any).packs;
        if (Array.isArray(packs) && packs.length > 1) {
          multiPackIds.push(id);
          if (multiPackDetails.length < 50) {
            multiPackDetails.push({
              id,
              packs: packs.map((p: any) => ({
                sizeG: typeof p.sizeG === "number" ? p.sizeG : null,
                sizeML: typeof p.sizeML === "number" ? p.sizeML : null,
                count: typeof p.count === "number" ? p.count : null,
                priceGBP: p.priceGBP,
              })),
            });
          }
        }
      }

      const catalogEntries = Object.entries(packCatalog);
      const catalogIds = catalogEntries.map(([id]) => id);
      const catalogSummary = catalogEntries.slice(0, 50).map(([id, packs]) => ({
        id,
        packs: packs.map((p) => ({
          pack_g: p.pack_g,
          price_gbp: p.price_gbp,
        })),
      }));

      const catalogIdSet = new Set(catalogIds);
      const bothIds: string[] = [];
      for (const id of multiPackIds) {
        if (catalogIdSet.has(id)) {
          bothIds.push(id);
        }
      }

      console.log(
        `[PACK_AUDIT:rules] multiPackRules=${multiPackIds.length}, first50=${JSON.stringify(
          multiPackDetails,
        )}`,
      );
      console.log(
        `[PACK_AUDIT:rules] packCatalogIds=${catalogIds.length}, first50=${JSON.stringify(
          catalogSummary,
        )}`,
      );
      console.log(
        `[PACK_AUDIT:rules] multiPackAndCatalog=${bothIds.length}, first50=${JSON.stringify(
          bothIds.slice(0, 50),
        )}`,
      );
    } catch (err) {
      console.error("[PACK_AUDIT:rules] Rule/schema coverage audit failed:", err);
    }
  }

  console.log(`📦 [Grocery Builder] Loaded ${Object.keys(groceryRulesData).length} grocery rules`);

  // Step 1: Aggregate weekly ingredient totals by foodId
  // CRITICAL: This step SUMS all occurrences of the same ingredient BEFORE rounding to packs
  // Example: If yogurt appears as 100g in meal 1 and 100g in meal 2, we sum to 200g first,
  // then round to 1 pack (not round each to 1 pack = 2 packs)
  const ingredientTotals = new Map<string, number>(); // foodId -> total grams (SUMMED across all meals)
  const ingredientOccurrences = new Map<string, number>(); // foodId -> count of times it appears (for logging)
  const countConvertedIds = new Set<string>(); // for DEBUG: ids that had count->grams conversion

  planDays.forEach((day: any) => {
    if (!day.meals || !Array.isArray(day.meals)) return;

    day.meals.forEach((meal: any) => {
      if (!meal.ingredientsPerPortion || !Array.isArray(meal.ingredientsPerPortion)) return;

      meal.ingredientsPerPortion.forEach((ing: any) => {
        // CRITICAL: foodId is the ONLY canonical key
        const foodId = ing.foodId || ing.id;
        
        // DEV-ONLY error: foodId must exist
        if (!foodId) {
          const errorMsg = `❌ [Grocery Builder] CRITICAL: Ingredient missing foodId. Ingredient data: ${JSON.stringify(ing)}. This should never happen - all ingredients must have foodId.`;
          if (Deno.env.get("DENO_ENV") === "development" || Deno.env.get("NODE_ENV") === "development") {
            throw new Error(errorMsg);
          } else {
            console.error(errorMsg);
            return; // Skip in production to prevent crashes
          }
        }

        // Resolve food ID (handles variations/aliases)
        const resolvedId = resolveToLeanId(foodId);
        if (!resolvedId) {
          // DEV-ONLY error: foodId must resolve to lean list
          const errorMsg = `❌ [Grocery Builder] CRITICAL: Could not resolve foodId "${foodId}" using resolveToLeanId. This should never happen - foodId must exist in canonical food database.`;
          if (Deno.env.get("DENO_ENV") === "development" || Deno.env.get("NODE_ENV") === "development") {
            throw new Error(errorMsg);
          } else {
            console.error(errorMsg);
            return; // Skip in production to prevent crashes
          }
        }

        const rawAmount = ing.amount || 0;
        const ingUnit = ing.unit || "g";
        const rule = groceryRulesData[resolvedId];
        const planNorm = normalizePlanAmount(rawAmount, ingUnit);

        let amount: number;
        if (planNorm.family === "unknown") {
          amount = (rule?.packSize != null && rule.packSize > 0) ? rule.packSize : 500;
        } else if (planNorm.family === "count") {
          const rawItem = rawGroceryItemsById[resolvedId];
          const packNorm = normalizeRulePack(rawItem?.pack);
          const itemWeightG =
            (typeof packNorm.meta?.estimatedWeightG === "number" ? packNorm.meta.estimatedWeightG : undefined) ??
            unitWeightG[resolvedId] ??
            unitWeightG[resolvedId.replace(/_/g, "")];
          if (typeof itemWeightG === "number" && itemWeightG >= 10 && itemWeightG <= 500) {
            const convertedGrams = planNorm.value * itemWeightG;
            amount = convertedGrams > 0 && convertedGrams < 10000 ? convertedGrams : (rule?.packSize ?? 500);
            countConvertedIds.add(resolvedId);
          } else {
            amount = (rule?.packSize != null && rule.packSize > 0) ? rule.packSize : 500;
          }
        } else if (planNorm.family === "g" || planNorm.family === "ml") {
          amount = planNorm.value;
        } else {
          amount = (rule?.packSize != null && rule.packSize > 0) ? rule.packSize : 500;
        }

        // Legacy path: plan unit was not count-like but rule is count-based and amount looks like count (small int in g)
        if (planNorm.family === "g" && amount > 0 && amount <= 20 && Number.isInteger(amount)) {
          const isCountBased = rule && (rule.packUnit === "count" || rule.packUnit === "eggs" || rule.packUnit === "bulb");
          const alwaysWholeUnitIds = ["egg", "eggs", "banana", "bananas", "apple", "apples", "orange", "oranges", "pear", "pears", "avocado", "avocados"];
          if (isCountBased && alwaysWholeUnitIds.includes(resolvedId)) {
            let itemWeight: number | undefined = rule.packCount && rule.packCount > 1 ? rule.packSize / rule.packCount : rule.packSize;
            if (!itemWeight || itemWeight < 10 || itemWeight > 500) itemWeight = unitWeightG[resolvedId] ?? unitWeightG[resolvedId.replace(/_/g, "")];
            if (typeof itemWeight === "number" && itemWeight >= 10 && itemWeight <= 500) {
              const convertedGrams = amount * itemWeight;
              if (convertedGrams < 10000) {
                amount = convertedGrams;
                countConvertedIds.add(resolvedId);
              }
            }
          }
        }

        if (amount > 0) {
          // STEP 1: SUM all amounts for the same foodId (aggregation before rounding)
          const current = ingredientTotals.get(resolvedId) || 0;
          ingredientTotals.set(resolvedId, current + amount);
          
          // Track occurrences for logging
          const occurrences = ingredientOccurrences.get(resolvedId) || 0;
          ingredientOccurrences.set(resolvedId, occurrences + 1);
        }
      });
    });
  });

  // Log aggregated ingredients for verification
  console.log(`📊 [Grocery Builder] Aggregated ${ingredientTotals.size} unique ingredients from meal plan`);
  
  // FILTER: Remove "mixed_vegetables" if present - we only want "frozen_mixed_vegetables"
  // If both exist, merge "mixed_vegetables" into "frozen_mixed_vegetables"
  if (ingredientTotals.has('mixed_vegetables')) {
    const mixedVegGrams = ingredientTotals.get('mixed_vegetables') || 0;
    console.log(`⚠️ [Grocery Builder] Found "mixed_vegetables" (${mixedVegGrams}g) - merging into frozen_mixed_vegetables`);
    
    // Merge into frozen_mixed_vegetables
    const frozenMixedVegGrams = ingredientTotals.get('frozen_mixed_vegetables') || 0;
    ingredientTotals.set('frozen_mixed_vegetables', frozenMixedVegGrams + mixedVegGrams);
    
    // Remove mixed_vegetables
    ingredientTotals.delete('mixed_vegetables');
  }
  
  // Log examples of aggregated ingredients for debugging
  ingredientTotals.forEach((totalGrams: number, foodId: string) => {
    // Diagnostic logging - can be enabled for specific items if needed
  });


  // Step 2: Convert total grams → pack counts using grocery_rules_uk.json
  const groceryItems = new Map<string, {
    name: string;
    originalGrams: number; // Original cooked amount (for display)
    purchaseGrams: number; // Converted dry amount (for pack calculation)
    packs: number;
    packSize: number;
    packUnit: string;
    buyString: string; // Pre-generated buy string (uses displayLabel for count packs)
    priceGBP: number;
    category: string;
    pantry: boolean;
  }>();

  // Step 2: Convert total grams → pack counts using grocery_rules_uk.json
  // CRITICAL: This happens AFTER aggregation - we round the SUMMED total, not individual occurrences
  const unmappedItems: Array<{ foodId: string; displayName: string; totalGrams: number }> = [];

  const logPackAuditItem = (params: {
    foodId: string;
    packUnit: string;
    purchaseGrams: number;
    totalGrams: number;
    pathUsed: "rule" | "catalog";
    totalPrice: number;
    packsSummary: string[];
    totalGramsFromPacks: number;
    leftoverGrams: number;
    ruleLookupKey: string;
    mapItem?: GroceryRuleItem;
  }) => {
    if (!PACK_AUDIT_ENABLED) return;
    try {
      const rulePacksSummary =
        params.mapItem && Array.isArray(params.mapItem.packs)
          ? params.mapItem.packs.map((p) => ({
              sizeG: typeof p.sizeG === "number" ? p.sizeG : null,
              sizeML: typeof p.sizeML === "number" ? p.sizeML : null,
              count: typeof p.count === "number" ? p.count : null,
              priceGBP: p.priceGBP,
            }))
          : [];

      const catalogEntry = packCatalog[params.ruleLookupKey] || [];
      const catalogCount = Array.isArray(catalogEntry) ? catalogEntry.length : 0;

      console.log(
        `[PACK_AUDIT:item] id=${params.foodId}, unit=${params.packUnit}, purchaseGrams=${params.purchaseGrams.toFixed(
          1,
        )}, pathUsed=${params.pathUsed}, rulePacks=${JSON.stringify(
          rulePacksSummary,
        )}, catalogCount=${catalogCount}, chosen=${JSON.stringify(
          params.packsSummary,
        )}, totalGrams=${params.totalGramsFromPacks.toFixed(
          1,
        )}, leftover=${params.leftoverGrams.toFixed(
          1,
        )}, totalCost=${params.totalPrice.toFixed(2)}`,
      );
    } catch (err) {
      console.error("[PACK_AUDIT:item] Logging failed:", err);
    }
  };
  
  ingredientTotals.forEach((totalGrams: number, foodId: string) => {
    // CRITICAL: foodId is the ONLY canonical key inside this builder (after resolveToLeanId upstream)
    // Primary lookup uses the exact id; then lean→grocery alias; optional cooked/dry fallback when enabled
    let ruleLookupKey = foodId;
    let rule: GroceryRule | undefined = groceryRulesData[foodId];
    let ruleKeyUsed: "exact" | "stripped" | "none" = rule ? "exact" : "none";

    if (!rule && LEAN_TO_GROCERY_RULE_ID[foodId]) {
      ruleLookupKey = LEAN_TO_GROCERY_RULE_ID[foodId];
      rule = groceryRulesData[ruleLookupKey];
      if (rule) ruleKeyUsed = "exact";
    }
    if (!rule && COOKED_DRY_LOOKUP_FALLBACK && foodId.endsWith("_cooked")) {
      const baseId = foodId.replace(/_cooked$/, "");
      const fallbackRule = groceryRulesData[baseId];
      if (fallbackRule) {
        rule = fallbackRule;
        ruleLookupKey = baseId;
        ruleKeyUsed = "stripped";
        if (COOKED_DRY_AUDIT) {
          console.log(
            `   ♻️ [COOKED_DRY_LOOKUP_FALLBACK] Using base rule "${baseId}" for cooked id "${foodId}"`,
          );
        }
      }
    }

    // Get food name from foodsMap for display (UI-only, never used for lookup)
    const food = foodsMap[foodId];
    if (!food) {
      // DEV-ONLY error: foodId must exist in foodsMap
      const errorMsg = `❌ [Grocery Builder] CRITICAL: foodId "${foodId}" not found in foodsMap. This should never happen - ingredient is missing from food database.`;
      if (Deno.env.get("DENO_ENV") === "development" || Deno.env.get("NODE_ENV") === "development") {
        throw new Error(errorMsg);
      } else {
        console.error(errorMsg);
        return; // Skip in production to prevent crashes
      }
    }
    const foodName = food.displayName || foodId;

    // Skip items that are high-budget-only when tier is low or medium
    const tier = (budgetTier || "low").toLowerCase();
    if (HIGH_ONLY_BUDGET_FOOD_IDS.has(ruleLookupKey) && tier !== "high") {
      if (debugExplain) {
        explainLines.push({
          nameRequested: foodName,
          resolvedFoodId: foodId,
          resolvedDisplayName: foodName,
          category: "Pantry / Staples",
          needed: { value: totalGrams, unit: "g" },
          normalizedNeededGramsOrMl: totalGrams,
          candidatePacks: [],
          chosenPacks: [],
          totals: { boughtNormalized: 0, overbuyNormalized: 0, cost: 0 },
          mappingStatus: "unmapped",
          reasonIfUnmapped: "High-budget only; excluded for low/medium budget",
        });
      }
      return;
    }

    // If no rule exists, include ingredient anyway with £0 price and "Unmapped" category
    if (!rule) {
      console.warn(`⚠️ [VERIFY] ${foodName} (${foodId}): ${totalGrams.toFixed(0)}g - NO RULE in grocery map, adding to Unmapped category`);
      unmappedItems.push({ foodId, displayName: foodName, totalGrams });
      
      // Calculate packs needed using a default pack size (500g or 1 count)
      const defaultPackSize = 500;
      const defaultPackUnit = 'g';
      const packsNeeded = Math.ceil(totalGrams / defaultPackSize);

      // Build buy string for unmapped items
      const unmappedBuyString = packsNeeded === 1 
        ? `${defaultPackSize}${defaultPackUnit}`
        : `${packsNeeded} x ${defaultPackSize}${defaultPackUnit}`;
      
      groceryItems.set(foodId, {
        name: foodName,
        originalGrams: totalGrams,
        purchaseGrams: totalGrams, // No conversion for unmapped items
        packs: packsNeeded,
        packSize: defaultPackSize,
        packUnit: defaultPackUnit,
        buyString: unmappedBuyString,
        priceGBP: 0, // £0 for unmapped items
        category: 'Unmapped', // Special category for items without rules
        pantry: false
      });
      logPackAuditItem({
        foodId,
        packUnit: defaultPackUnit,
        purchaseGrams: totalGrams,
        totalGrams,
        pathUsed: "rule",
        totalPrice: 0,
        packsSummary: [`${packsNeeded}x${defaultPackSize}`],
        totalGramsFromPacks: packsNeeded * defaultPackSize,
        leftoverGrams: Math.max(0, packsNeeded * defaultPackSize - totalGrams),
        ruleLookupKey: foodId,
        mapItem: undefined,
      });
      return;
    }

    // HARD RULE: household staples are always 1 pack if present
    // Check original grocery map item for isHouseholdStaple flag
    let mapItem: GroceryRuleItem | undefined = undefined;
    if (groceryRulesInput.items && Array.isArray(groceryRulesInput.items)) {
      mapItem = groceryRulesInput.items.find((item: any) => item.id === ruleLookupKey);
    } else if (groceryRulesInput[ruleLookupKey]) {
      // Old structure fallback
      mapItem = groceryRulesInput[ruleLookupKey] as any;
    }
    
    if (mapItem?.isHouseholdStaple) {
      // Force 1 pack for household staples - skip all pack calculations
      const packSize = rule.packSize;
      const packUnit = rule.packUnit;
      let buyString = '';
      
      // Generate buy string for 1 pack
      if (packUnit === 'count') {
        const packCount = rule.packCount || 1;
        const displayLabel = rule.packDisplayLabel;
        
        if (packCount > 1) {
          buyString = displayLabel || `${packCount}-pack`;
        } else {
          const food = foodsMap[foodId];
          const itemName = food?.displayName || foodId.replace(/_/g, ' ');
          if (foodId === 'garlic') {
            buyString = '1 Garlic bulb';
          } else {
            buyString = `1 ${itemName}`;
          }
        }
      } else if (packUnit === 'eggs' || packUnit === 'bulb') {
        buyString = `${packSize} ${packUnit === 'eggs' ? 'eggs' : 'bulb'}`;
      } else {
        buyString = `${packSize}${packUnit}`;
      }
      
      // Force price to £0 for household staples
      const totalPrice = 0;
      
      console.log(`   🏠 [Grocery Builder] ${foodName} (${foodId}): Household staple - forcing 1 pack`);
      
      groceryItems.set(foodId, {
        name: foodName,
        originalGrams: totalGrams,
        purchaseGrams: 0, // Prevent downstream gram/ml pack math
        packs: 1, // Force 1 pack
        packSize,
        packUnit,
        buyString,
        priceGBP: totalPrice,
        category: rule.category,
        pantry: true
      });
      logPackAuditItem({
        foodId,
        packUnit,
        purchaseGrams: 0,
        totalGrams,
        pathUsed: "rule",
        totalPrice,
        packsSummary: ["1x" + packSize],
        totalGramsFromPacks: packSize,
        leftoverGrams: Math.max(0, packSize - 0),
        ruleLookupKey,
        mapItem,
      });
      return; // Early return - skip all pack calculations
    }

    // Apply cooked-to-dry conversion when purchase.form === "dry" and cookedToDryFactor present
    let purchaseGrams = totalGrams;
    let cookedToDryFactorUsed: number | null = null;
    const mapPurchase = mapItem?.purchase;
    if (
      (mapPurchase?.form === "dry" || rule.cookedToDryFactor !== undefined) &&
      typeof rule.cookedToDryFactor === "number" &&
      rule.cookedToDryFactor > 0
    ) {
      cookedToDryFactorUsed = rule.cookedToDryFactor;
      purchaseGrams = totalGrams * rule.cookedToDryFactor;
    }

    if (COOKED_DRY_AUDIT && foodId.endsWith("_cooked")) {
      console.log(
        `   🔍 [COOKED_DRY_AUDIT:item] id=${foodId}, ruleKeyUsed=${ruleKeyUsed}, totalGramsCooked=${totalGrams.toFixed(
          1,
        )}, cookedToDryFactor=${cookedToDryFactorUsed ?? "none"}, purchaseGrams=${purchaseGrams.toFixed(1)}`,
      );
    }

    // Get pack size and unit (needed for buy string even if forceWeeklyPacks is set)
    const packSize = rule.packSize;
    const packUnit = rule.packUnit;
    
    // HARD RULE: Pack-based items (seasonings with unit: "pack") are always 1 pack when present
    if (packUnit === 'pack') {
      // Seasonings, herbs, spices - always show as "1 pack" when present in meal plan
      const buyString = rule.packDisplayLabel || '1 pack';
      const totalPrice = rule.priceGBP; // Use regular price (not forced to £0 unless isHouseholdStaple)
      
      console.log(`   📦 [Grocery Builder] ${foodName} (${foodId}): Pack-based item (seasoning) - forcing 1 pack`);
      
      groceryItems.set(foodId, {
        name: foodName,
        originalGrams: totalGrams,
        purchaseGrams: 0, // Prevent downstream calculations
        packs: 1, // Always 1 pack
        packSize: 1,
        packUnit: 'pack',
        buyString,
        priceGBP: totalPrice,
        category: rule.category,
        pantry: rule.isPantry
      });
      logPackAuditItem({
        foodId,
        packUnit: 'pack',
        purchaseGrams: 0,
        totalGrams,
        pathUsed: "rule",
        totalPrice,
        packsSummary: ["1x1"],
        totalGramsFromPacks: 1,
        leftoverGrams: 1,
        ruleLookupKey,
        mapItem,
      });
      return; // Early return - skip all pack calculations
    }

    // Pack catalog: use multi-pack selection when available (weight/volume only)
    if ((packUnit === 'g' || packUnit === 'ml') && packCatalog[ruleLookupKey]?.length) {
      const selection = selectPacks(Math.ceil(purchaseGrams), packCatalog[ruleLookupKey], { preferTier: budgetTier });
      if (selection) {
        const buyParts = selection.chosenPacks.map((c) => (c.qty === 1 ? `${c.pack_g}${packUnit}` : `${c.qty} x ${c.pack_g}${packUnit}`));
        const buyString = buyParts.join(' + ');
        const packsCount = selection.chosenPacks.reduce((s, c) => s + c.qty, 0);
        let totalPrice = selection.total_price_gbp;
        if (rule.isPantry || (rule.category === 'Pantry / Staples' && rule.priceGBP === 0)) {
          totalPrice = 0;
        }
        groceryItems.set(foodId, {
          name: foodName,
          originalGrams: totalGrams,
          purchaseGrams: purchaseGrams,
          packs: packsCount,
          packSize: selection.chosenPacks[0].pack_g,
          packUnit,
          buyString,
          priceGBP: totalPrice,
          category: rule.category,
          pantry: rule.isPantry
        });
        const totalGramsFromPacks = selection.total_pack_g;
        const leftoverGrams = Math.max(0, totalGramsFromPacks - purchaseGrams);
        logPackAuditItem({
          foodId,
          packUnit,
          purchaseGrams,
          totalGrams,
          pathUsed: "catalog",
          totalPrice,
          packsSummary: selection.chosenPacks.map((c) => `${c.qty}x${c.pack_g}`),
          totalGramsFromPacks,
          leftoverGrams,
          ruleLookupKey,
          mapItem,
        });
        return;
      }
    }

    // HIDE TINY QUANTITIES: Skip items with negligible amounts
    // Check before calculating packs to avoid unnecessary work
    if (packUnit === 'count' || packUnit === 'eggs' || packUnit === 'bulb') {
      // For count-based items, check if needed count is less than 0.1 items
      const packCount = rule.packCount || 1;
      let itemWeight: number;
      
      if (packCount > 1) {
        // Multi-pack: packSize is total pack weight, so itemWeight = packSize / packCount
        itemWeight = packSize / packCount;
      } else {
        // Per-item: packSize is already the weight per item
        itemWeight = packSize;
      }
      
      const itemsNeeded = purchaseGrams / itemWeight;
      
      if (itemsNeeded < 0.1) {
        // Log skipped items for wrap-related items
        console.log(`   ⏭️ [Grocery Builder] Skipping ${foodId}: only ${itemsNeeded.toFixed(2)} items needed (< 0.1)`);
        return; // Skip this item - too small to matter
      }
    } else {
      // For weight/volume items, skip if less than 5g/ml
      if (purchaseGrams < 5) {
        console.log(`   ⏭️ [Grocery Builder] Skipping ${foodId}: only ${purchaseGrams.toFixed(1)}${packUnit} needed (< 5${packUnit})`);
        return; // Skip this item - too small to matter
      }
    }
    
    // Normalize rule pack for unit-family check and overbuy fix
    const rawPack = mapItem?.pack ?? (rawGroceryItemsById[ruleLookupKey] as any)?.pack;
    const packNorm = normalizeRulePack(rawPack);
    const neededFamily: "g" | "ml" | "count" =
      packUnit === "ml" ? "ml" : packUnit === "count" || packUnit === "eggs" || packUnit === "bulb" ? "count" : "g";
    let finalReasonIfFallback: string | undefined;

    // WEEKLY HARD CAPS (CRITICAL): Check forceWeeklyPacks FIRST
    let packsNeeded = 0;
    if ((rule as any).forceWeeklyPacks !== undefined && (rule as any).forceWeeklyPacks !== null) {
      packsNeeded = (rule as any).forceWeeklyPacks;
    } else if (
      packNorm.family === "unknown" ||
      neededFamily !== packNorm.family
    ) {
      packsNeeded = 1;
      finalReasonIfFallback = "unit_family_mismatch_or_unknown";
    } else {
      if (packUnit === "count" || packUnit === "eggs" || packUnit === "bulb") {
        const packCount = rule.packCount || 1;
        if (packCount > 1) {
          const itemWeight = packSize / packCount;
          const itemsNeeded = purchaseGrams / itemWeight;
          packsNeeded = Math.ceil(itemsNeeded / packCount);
        } else {
          packsNeeded = purchaseGrams <= packSize ? 1 : Math.ceil(purchaseGrams / packSize);
        }
      } else {
        packsNeeded = purchaseGrams <= packSize ? 1 : Math.ceil(purchaseGrams / packSize);
      }
      packsNeeded = Math.min(packsNeeded, rule.maxPacksPerWeek);
    }

    // Build "buy" string (pack-based purchase instruction)
    let buyString = '';
    if (packUnit === 'count') {
      const packCount = rule.packCount || 1;
      const displayLabel = rule.packDisplayLabel;
      
      if (packCount > 1) {
        // Multi-pack: use displayLabel from JSON (e.g., "6-pack")
      if (packsNeeded === 1) {
          buyString = displayLabel || `${packCount}-pack`;
        } else {
          buyString = `${packsNeeded} x ${displayLabel || `${packCount}-pack`}`;
        }
      } else {
        // Per-item: generate "6 Bananas" dynamically
        const food = foodsMap[foodId];
        const itemName = food?.displayName || foodId.replace(/_/g, ' ');
        
        // Special cases with descriptive suffixes
        if (foodId === 'garlic') {
          buyString = `${packsNeeded} Garlic ${packsNeeded === 1 ? 'bulb' : 'bulbs'}`;
        } else {
          const pluralName = pluralize(itemName, packsNeeded);
          buyString = `${packsNeeded} ${pluralName}`;
        }
      }
    } else if (packUnit === 'eggs' || packUnit === 'bulb') {
      // Legacy support for old format
      const unitDisplay = packUnit === 'eggs' ? 'eggs' : 'bulb';
      if (packsNeeded === 1) {
        buyString = `${packSize} ${unitDisplay}`;
      } else {
        buyString = `${packsNeeded} x ${packSize} ${unitDisplay}`;
      }
    } else {
      // Weight/volume packs (g, ml, kg, L)
      if (packsNeeded === 1) {
        buyString = `${packSize}${packUnit}`;
      } else {
        buyString = `${packsNeeded} x ${packSize}${packUnit}`;
      }
    }

    // SAFETY NET: Force 1 pack for household staples (in case any calculation overwrote it)
    // Check original grocery map item for isHouseholdStaple flag
    let mapItemFinal: GroceryRuleItem | undefined = undefined;
    if (groceryRulesInput.items && Array.isArray(groceryRulesInput.items)) {
      mapItemFinal = groceryRulesInput.items.find((item: any) => item.id === ruleLookupKey);
    } else if (groceryRulesInput[ruleLookupKey]) {
      // Old structure fallback
      mapItemFinal = groceryRulesInput[ruleLookupKey] as any;
    }
    
    if (mapItemFinal?.isHouseholdStaple) {
      packsNeeded = 1; // Safety net: force 1 pack regardless of calculations
    }

    if (GROCERY_UNIT_DEBUG) {
      const conversionsApplied: string[] = [];
      if (countConvertedIds.has(foodId)) conversionsApplied.push("count_to_grams");
      if (cookedToDryFactorUsed != null) conversionsApplied.push("cooked_to_dry");
      console.log(
        JSON.stringify({
          id: foodId,
          displayName: foodName,
          planAmountRaw: { value: totalGrams, unit: packUnit },
          planNormalized: { value: purchaseGrams, family: neededFamily, reason: finalReasonIfFallback ?? undefined },
          packNormalized: { packSize: packNorm.packSize, family: packNorm.family, reason: packNorm.reason },
          conversionsApplied,
          chosenPacks: packsNeeded,
          finalReasonIfFallback: finalReasonIfFallback ?? undefined,
        })
      );
    }

    // PANTRY / HOUSEHOLD STAPLES (£0): Force price to £0 if isHouseholdStaple or category is Pantry with £0 price
    let totalPrice = packsNeeded * rule.priceGBP;
    if (rule.isPantry || (rule.category === 'Pantry / Staples' && rule.priceGBP === 0)) {
      totalPrice = 0;
      console.log(`   💰 ${foodId}: Pantry/household staple - price forced to £0`);
    }

    groceryItems.set(foodId, {
      name: foodName,
      originalGrams: totalGrams, // Original cooked amount (for "needed" display)
      purchaseGrams: purchaseGrams, // Converted dry amount (for pack calculation)
      packs: packsNeeded,
      packSize,
      packUnit,
      buyString, // Store the pre-generated buy string (uses displayLabel for count packs)
      priceGBP: totalPrice,
      category: rule.category,
      pantry: rule.isPantry
    });
    const totalGramsFromPacks = packsNeeded * packSize;
    const leftoverGrams = Math.max(0, totalGramsFromPacks - purchaseGrams);
    logPackAuditItem({
      foodId,
      packUnit,
      purchaseGrams,
      totalGrams,
      pathUsed: "rule",
      totalPrice,
      packsSummary: [`${packsNeeded}x${packSize}`],
      totalGramsFromPacks,
      leftoverGrams,
      ruleLookupKey,
      mapItem: mapItemFinal || mapItem,
    });
  });

  // Step 3: Group items into categories
  // CRITICAL: Use category from GroceryMap.json (already stored in item.category)
  const categoryMap = new Map<string, GroceryItem[]>();

    groceryItems.forEach((item, foodId) => {
    // CRITICAL: Category MUST come from GroceryMap.json ONLY - never from food map or any other source
    // The category was already set from GroceryMap.json at line 357 (rule.category)
    const category = item.category || 'Other';
    if (!item.category) {
      console.warn(`⚠️ [Grocery Builder] Category missing for ${foodId} - category should have been set from GroceryMap.json. Using fallback: "Other"`);
    } else {
      // Verify category came from GroceryMap.json (not food map)
      // foodMap[foodId]?.category exists but we MUST NOT use it - only GroceryMap.json categories
      const foodMapCategory = foodsMap[foodId]?.category;
      if (foodMapCategory && foodMapCategory !== category) {
        // This is expected - food map categories may differ from grocery categories
        // e.g., food map might say "Grains" but GroceryMap.json says "Carbohydrates"
        // We use GroceryMap.json category, not food map category
        // Only log in dev mode to avoid noise
        if (Deno.env.get("DENO_ENV") === "development" || Deno.env.get("NODE_ENV") === "development") {
          console.log(`   ✅ [Grocery Builder] Using GroceryMap.json category "${category}" for ${foodId} (food map has "${foodMapCategory}" - ignoring)`);
        }
      }
    }
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }

    // Build "needed" string (actual amount needed from meals)
    // Format varies by pack unit type to match user examples
    let neededString = '';
    const originalGrams = item.originalGrams || item.purchaseGrams; // Fallback to purchaseGrams if originalGrams not available
    const purchaseGrams = item.purchaseGrams || originalGrams;
    
    // Format needed string based on pack unit type
    if (item.packUnit === 'count') {
      // Get packCount from rule (stored during rule creation)
      const rule = groceryRulesData[foodId];
      const packCount = rule?.packCount || 1;
      
      // For multi-pack items (packCount > 1): show count needed
      // For per-item items (packCount === 1): show grams
      if (packCount > 1) {
        // Multi-pack: packSize is total pack weight, so itemWeight = packSize / packCount
        const itemWeight = rule.packSize / packCount;
        const itemsNeeded = purchaseGrams / itemWeight;
        const totalItemsNeeded = Math.round(itemsNeeded); // Total items needed
        neededString = `${totalItemsNeeded}`;
      } else {
        // Per-item: show grams
        neededString = `${Math.round(originalGrams)}g`;
      }
    } else if (item.packUnit === 'eggs') {
      // Just show the gram amount
      neededString = `${Math.round(originalGrams)}g`;
    } else if (item.packUnit === 'bulb') {
      // Just show the gram amount
      neededString = `${Math.round(originalGrams)}g`;
    } else {
      const dryIndicator = originalGrams !== purchaseGrams && item.packUnit !== 'ml' ? ' dry' : '';
      const neededUnit = item.packUnit === 'ml' ? 'ml' : 'g';
      if (neededUnit === 'g') {
        const ruleLookupKey = LEAN_TO_GROCERY_RULE_ID[foodId] ?? foodId;
        const rawItem = rawGroceryItemsById[foodId] ?? rawGroceryItemsById[ruleLookupKey];
        const displayNeed = formatNeedForDisplay({
          id: foodId,
          neededValue: purchaseGrams,
          neededFamily: "g",
          rule: rawItem,
          groceryRulesInput,
        });
        neededString = displayNeed || `${Math.round(purchaseGrams)}g${dryIndicator}`;
      } else {
        neededString = `${Math.round(purchaseGrams)}${neededUnit}${dryIndicator}`;
      }
    }

    // Build base buy string (pack quantity only)
    const baseBuyString = item.buyString || (item.packs === 1 
      ? `${item.packSize}${item.packUnit}` 
      : `${item.packs} x ${item.packSize}${item.packUnit}`);

    // Format name to include needed information
    // For per-item foods, buy string already contains the pluralized name (e.g., "7 Bananas")
    // So name should only contain "(need: X)" to avoid duplication
    // For other foods, include the item name: "{itemName} (need: {actualAmount})"
    // SPECIAL: Garlic and lemons should show ONLY the buy string - no needed amount at all
    const rule = groceryRulesData[foodId];
    const isPerItemFood = rule && rule.packUnit === 'count' && (rule.packCount || 1) === 1;
    const isGarlicOrLemon = foodId === 'garlic' || foodId === 'lemon' || foodId.includes('lemon');
    
    let nameWithNeeded: string;
    if (isGarlicOrLemon) {
      // For garlic and lemons: show ONLY the buy string, no needed amount
      nameWithNeeded = '';
    } else if (isPerItemFood) {
      // Buy string already has the name (e.g., "7 Bananas"), so name should just be "(need: X)"
      // This prevents duplication when frontend displays "{buy} {name}"
      nameWithNeeded = `(need: ${neededString})`;
    } else {
      // For other foods (multi-packs, weight-based), include the item name
      nameWithNeeded = `${item.name} (need: ${neededString})`;
    }

    const groceryItem: GroceryItem = {
      foodId: foodId, // Store foodId for ID-based validation (no reverse lookup needed)
      name: nameWithNeeded, // Include needed information in name field
      buy: baseBuyString, // Keep buy as pack quantity only
      needed: neededString, // Keep needed field for backward compatibility
      estimatedPriceGBP: item.priceGBP,
      priceBand: budgetTier // Use input budgetTier
    };

    categoryMap.get(category)!.push(groceryItem);

    // Debug explain line (when debugExplain or DEBUG_GROCERY_EXPLAIN is set)
    if (debugExplain) {
      const ruleLookupKey = LEAN_TO_GROCERY_RULE_ID[foodId] ?? foodId;
      const rawItem = rawGroceryItemsById[ruleLookupKey];
      const catalogEntry = packCatalog[ruleLookupKey];
      const candidatePacks: GroceryExplainLine["candidatePacks"] = [];
      if (rawItem?.packs && Array.isArray(rawItem.packs)) {
        for (const p of rawItem.packs as any[]) {
          const sizeG = p.sizeG ?? p.sizeML;
          const unit = p.sizeML != null ? "ml" : "g";
          candidatePacks.push({
            packId: p.displayLabel || `${sizeG}${unit}`,
            size: { value: sizeG ?? 0, unit },
            normalizedSize: sizeG ?? 0,
            price: p.priceGBP ?? 0,
            notes: p.notes,
          });
        }
      }
      if (candidatePacks.length === 0 && catalogEntry?.length) {
        for (const p of catalogEntry) {
          candidatePacks.push({
            packId: p.pack_id,
            size: { value: p.pack_g, unit: "g" },
            normalizedSize: p.pack_g,
            price: p.price_gbp,
            store: p.store,
          });
        }
      }
      const boughtNormalized = item.packs * item.packSize;
      const overbuyNormalized = Math.max(0, boughtNormalized - purchaseGrams);
      const neededUnit = item.packUnit === "ml" ? "ml" : "g";
      explainLines.push({
        nameRequested: item.name,
        resolvedFoodId: foodId,
        resolvedDisplayName: foodsMap[foodId]?.displayName ?? foodId,
        category,
        needed: { value: Math.round(purchaseGrams), unit: neededUnit },
        normalizedNeededGramsOrMl: purchaseGrams,
        candidatePacks,
        chosenPacks: [{ packId: `${item.packSize}${item.packUnit}`, count: item.packs }],
        totals: { boughtNormalized, overbuyNormalized, cost: item.priceGBP },
        mappingStatus: item.category === "Unmapped" ? "unmapped" : "mapped",
        reasonIfUnmapped: item.category === "Unmapped" ? "No grocery rule for resolved id" : undefined,
      });
    }
  });

  // Step 4: Build sections in fixed order
  const fixedCategoryOrder = [
    'Proteins',
    'Carbohydrates',
    'Fruit & Vegetables',
    'Dairy & Alternatives',
    'Pantry / Staples',
    'Unmapped' // Items without grocery rules (price £0)
  ];

  const grocerySections: GrocerySection[] = [];
  const breakdownGBP: Record<string, number> = {};

  fixedCategoryOrder.forEach(categoryLabel => {
    const items = categoryMap.get(categoryLabel);
    if (items && items.length > 0) {
      // Calculate category total (exclude pantry items with priceGBP = 0)
      const categoryTotal = items.reduce((sum, item) => {
        // Pantry items with priceGBP = 0 are excluded from totals
        if (item.estimatedPriceGBP === 0) return sum;
        return sum + item.estimatedPriceGBP;
      }, 0);

      breakdownGBP[categoryLabel] = categoryTotal;

      grocerySections.push({
        label: categoryLabel,
        items: items
      });
    }
  });

  // Step 5: Compute estimatedTotalWeek (exclude pantry items with priceGBP = 0)
  const estimatedTotalWeek = Object.values(breakdownGBP).reduce((sum, val) => sum + val, 0);

  // Log summary of unmapped items (items not in grocery rules)
  if (unmappedItems.length > 0) {
    const unmappedList = unmappedItems.map(item => `${item.displayName} (${item.totalGrams.toFixed(0)}g)`).join(', ');
    console.warn(`⚠️ ${unmappedItems.length} items NOT in grocery map (unmapped): ${unmappedList}`);
  }

  // Log summary of successfully processed items for verification
  console.log(`✅ [Grocery Builder] Processed ${groceryItems.size} items into grocery list`);
  console.log(`   📦 Ingredients aggregated: ${ingredientTotals.size} unique items`);
  console.log(`   🛒 Grocery items created: ${groceryItems.size} items`);

  // DIAGNOSTIC: Show detailed trace for items (if needed for debugging)
  // Removed wrap-specific diagnostic logging since wraps are removed from maps

  const duration = Date.now() - startTime;

  const result: GroceryList & { groceryExplain?: GroceryExplainLine[] } = {
    grocerySections,
    groceryTotals: {
      totalPriceGBP: estimatedTotalWeek,
      breakdownGBP,
      estimatedTotalWeek
    }
  };
  if (debugExplain && explainLines.length > 0) {
    result.groceryExplain = explainLines;
  }
  return result;
}

