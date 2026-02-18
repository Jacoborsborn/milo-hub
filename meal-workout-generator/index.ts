// supabase/functions/meal-workout-generator/index.ts
// Supabase Edge Function for generating meal and workout plans using AI
// NEW ARCHITECTURE: 2-Call Meal Generation System
// 1. Call 1 (GPT-4o-mini): Generate meal concepts with reasonable portions
// 2. Parse and scale portions to hit exact calorie targets
// 3. Call 2 (GPT-4.1-nano): Generate recipes for each meal
// Note: Grocery list generation moved to on-demand endpoint (generate-grocery-list)

import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";
import OpenAI from "npm:openai@4.77.0";
import { type Food } from "../_shared/food-map.ts";
import { FOODS_DATA_LEAN, FOODS_BY_ID_LEAN, resolveCanonicalFoodId, resolveToLeanId } from "../_shared/food-map.lean.ts";
import foodsLightweight from "./foods_lightweight.json" assert { type: "json" };
import { buildGroceryListFromPlan } from "../_shared/grocery-builder.ts";
import groceryRules from "../_shared/grocery_rules_uk.json" assert { type: "json" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================================================
// PROMPT VERSION TOGGLE
// ============================================================================
// Set to 'new' to use the new structured prompt, 'original' to use the backup
const MEAL_PROMPT_VERSION = Deno.env.get('MEAL_PROMPT_VERSION') || 'new';

// ============================================================================
// FOODS_DATA_LEAN LOADED
// ============================================================================
// FOODS_DATA_LEAN is imported from _shared/food-map.lean.ts (canonical grocery list only)
// Contains lean set of foods with:
// - Accurate macros (calories, protein, carbs, fat, fibre)
// - Diet compatibility (vegan, vegetarian, pescatarian, balanced) in metadata.dietsAllowed
// - Allergen information in metadata.allergens
// - Category classification
//
// Used for:
// - Filtering by diet/allergies
// - Calculating accurate macros
// - Categorizing grocery items

// ============================================================================
// MACRO OVERRIDES (Fix known bad USDA data)
// ============================================================================
// Manual overrides for foods with incorrect USDA data
const MACRO_OVERRIDES: Record<string, any> = {
  banana: {
    macrosPer100: { 
      calories: 89, 
      protein_g: 1.1, 
      carbs_g: 23, 
      fat_g: 0.3, 
      fibre_g: 2.6 
    }
  },
  // Add more as discovered
};

// Lazy override getter (lean map only)
function getFoodWithOverrides(foodId: string): Food | undefined {
  const food = FOODS_BY_ID_LEAN[foodId];
  if (!food) return undefined;
  
  if (MACRO_OVERRIDES[foodId]) {
    return {
      ...food,
      macrosPer100: { ...food.macrosPer100, ...MACRO_OVERRIDES[foodId].macrosPer100 }
    };
  }
  return food;
}

/**
 * Build a food map with macro overrides applied
 * This ensures all food maps used for calculations have correct values (e.g., egg calories)
 */
function buildFoodMapWithOverrides(): Record<string, Food> {
  const foodMap: Record<string, Food> = {};
  
  for (const foodId in FOODS_BY_ID_LEAN) {
    const food = getFoodWithOverrides(foodId);
    if (food) {
      foodMap[foodId] = food;
    }
  }
  
  return foodMap;
}

// ============================================================================
// NEW 2-CALL MEAL GENERATION SYSTEM
// ============================================================================

/**
 * STEP 1: Generate meal concepts with portions using GPT-4o-mini
 * (First call - creative meal planning)
 */
async function generateMealConcepts(
  openai: OpenAI,
  inputs: {
    dietType: string;
    dailyCalories: number;
    days: number;
    mealsPerDay: number;
    dietGoal: string;
    allergies: string[];
    dislikes: string[];
    budgetTier?: string;
    // Week 2+ parameters (optional)
    isContinuationWeek?: boolean;
    previousMealTitles?: string[]; // Array of meal names from previous week
    previousGroceryList?: any; // Previous week's grocery list object
    week1Feedback?: string; // Free text feedback about liked/disliked meals and dietary changes (legacy)
    feedback2?: string; // User feedback question 2
    feedback3?: string; // User feedback question 3
  }
): Promise<string> {
  const startTime = Date.now();

  // Ensure allergies is always an array (handler passes expanded codes)
  const allergies = Array.isArray(inputs.allergies) ? inputs.allergies : [];

  // Budget tier configuration
  const budgetTier = inputs.budgetTier || 'medium';
  const budgetConfig = {
    low: { weeklyMax: '£45', proteins: 6, carbs: 5, vegetables: 10, fruit: 3, sauces: 5 }, // 5-6 proteins, 4-5 carbs, 8-10 veg (using max values)
    medium: { weeklyMax: '£70', proteins: 7, carbs: 6, vegetables: 12, fruit: 4, sauces: 6 }, // 6-7 proteins, 5-6 carbs, 10-12 veg (using max values)
    high: { weeklyMax: '£100', proteins: 8, carbs: 7, vegetables: 15, fruit: 6, sauces: 8 } // 7-8 proteins, 6-7 carbs, 12+ veg (using 15 as max)
  };
  const budget = budgetConfig[budgetTier as keyof typeof budgetConfig] || budgetConfig.medium;

  // Restrict to canonical grocery list (lean list only)
  const allowedIdSet = new Set(FOODS_DATA_LEAN.map((f) => f.id));
  const foodsFromCanonicalList = foodsLightweight.filter((food: any) => allowedIdSet.has(food.id));

  // Filter by diet, allergies (case-insensitive), and budget
  const filteredFoods = foodsFromCanonicalList.filter((food: any) => {
    if (!food.metadata?.dietsAllowed?.includes(inputs.dietType)) return false;
    const foodAllergens = (food.metadata?.allergens || []).map((a: string) => String(a).toLowerCase());
    if (allergies.some((a: string) => foodAllergens.includes(String(a).toLowerCase()))) return false;
    if (food.id === 'salmon' && budgetTier !== 'high') return false;
    return true;
  });

  console.log('📊 Foods in lightweight index:', foodsLightweight.length);
  console.log('📊 Foods in canonical allowlist:', foodsFromCanonicalList.length);
  console.log('📊 Foods AFTER diet/allergy/budget filter:', filteredFoods.length);
  console.log('❌ Foods REMOVED (total):', foodsLightweight.length - filteredFoods.length);

  const removedDueToAllergies = foodsLightweight.filter((food: any) => {
    const foodAllergens = (food.metadata?.allergens || []).map((a: string) => String(a).toLowerCase());
    return allergies.some((a: string) => foodAllergens.includes(String(a).toLowerCase()));
  });
  console.log('🚫 Sample removed foods:', removedDueToAllergies.slice(0, 10).map((f: any) => f.displayName));

  // Format filtered foods as simple list
  const filteredFoodList = filteredFoods
    .map((food: any) => `${food.id}: ${food.displayName}`)
    .join('\n');

  // Build meal structure context
  let mealStructureContext = '';
  if (inputs.mealsPerDay === 4) {
    mealStructureContext = `Breakfast (25% daily): Energy-focused
Lunch (30% daily): Balanced
Dinner (35% daily): Protein-focused
Snack (10% daily): Substantial`;
  } else if (inputs.mealsPerDay === 2) {
    mealStructureContext = `Meal 1 (50% daily): Balanced meal
Meal 2 (50% daily): Balanced meal`;
  } else if (inputs.mealsPerDay === 3) {
    mealStructureContext = `Breakfast (33% daily): Energy-focused
Lunch (33% daily): Balanced
Dinner (34% daily): Protein-focused`;
  }

  // Determine if this is Week 2+ (continuation week)
  const isContinuationWeek = inputs.isContinuationWeek || 
    (inputs.previousMealTitles && inputs.previousMealTitles.length > 0) ||
    (inputs.week1Feedback && inputs.week1Feedback.trim().length > 0) ||
    (inputs.feedback2 && inputs.feedback2.trim().length > 0) ||
    (inputs.feedback3 && inputs.feedback3.trim().length > 0);

  // Format previous week data for Week 2+ prompt
  let week1FeedbackSection = '';
  let previousMealTitlesList = '';
  let previousGroceryListText = '';
  
  if (isContinuationWeek) {
    // Format previous meal titles
    if (inputs.previousMealTitles && inputs.previousMealTitles.length > 0) {
      previousMealTitlesList = inputs.previousMealTitles.join('\n');
    }
    
    // Format previous grocery list
    if (inputs.previousGroceryList && inputs.previousGroceryList.grocerySections) {
      const groceryItems: string[] = [];
      inputs.previousGroceryList.grocerySections.forEach((section: any) => {
        if (section.items && Array.isArray(section.items)) {
          section.items.forEach((item: any) => {
            const itemText = item.name || item.displayName || item.id || 'Unknown item';
            groceryItems.push(`  - ${itemText}`);
          });
        }
      });
      previousGroceryListText = groceryItems.join('\n');
    }
    
    // Build Week 2+ feedback section from feedback2 and feedback3 (primary) or week1Feedback (legacy)
    const feedback2Text = inputs.feedback2 && inputs.feedback2.trim().length > 0 ? inputs.feedback2.trim() : '';
    const feedback3Text = inputs.feedback3 && inputs.feedback3.trim().length > 0 ? inputs.feedback3.trim() : '';
    const legacyFeedbackText = inputs.week1Feedback && inputs.week1Feedback.trim().length > 0 ? inputs.week1Feedback.trim() : '';
    
    // Combine feedback - prefer feedback2/feedback3 over legacy week1Feedback
    let combinedFeedback = '';
    if (feedback2Text || feedback3Text) {
      const feedbackParts = [feedback2Text, feedback3Text].filter(f => f.trim());
      combinedFeedback = feedbackParts.join('\n\n');
    } else if (legacyFeedbackText) {
      combinedFeedback = legacyFeedbackText;
    } else {
      combinedFeedback = 'None specified';
    }
    
    week1FeedbackSection = `
────────────────────────
USER FEEDBACK (CRITICAL - MUST FOLLOW)
────────────────────────
${combinedFeedback}

CRITICAL RULES:
- Meals the user DISLIKED (if mentioned) must NOT appear again (no same name or close variants).
- Meals the user LIKED (if mentioned) may be reused sparingly (max 1–2 times total across the week).
- If a liked meal is reused, it must be meaningfully adjusted (different cuisine angle OR different primary carb OR different primary vegetable).
- Dietary or preference changes (if mentioned) override all previous assumptions.
- If user requests specific ingredients to avoid, NEVER use those ingredients.
- Incorporate ALL feedback above into your meal generation - this is NOT optional.
`;
  }

  // Build prompt - use Week 2+ template if continuation week, otherwise use Week 1 template
  let prompt = '';
  
  if (isContinuationWeek) {
    // Week 2+ prompt template
    prompt = `You are the Gordon Ramsay of fitness nutrition. You create meals that fuel athletic performance while being genuinely enjoyable and realistic to shop for.

This is a CONTINUATION WEEK (Week 2 or later). The user has already completed a previous week.

────────────────────────
USER PROFILE
────────────────────────
Diet: ${inputs.dietType}
Daily calories: ${inputs.dailyCalories}
Days: ${inputs.days}
Meals per day: ${inputs.mealsPerDay}
Goal: ${inputs.dietGoal}
Allergies: ${inputs.allergies.length > 0 ? inputs.allergies.join(', ') : 'none'}
Dislikes: ${inputs.dislikes.length > 0 ? inputs.dislikes.join(', ') : 'none'}
Budget Tier: ${budgetTier} (weekly max: ${budget.weeklyMax} – price is a guide only)

${week1FeedbackSection}
────────────────────────
PREVIOUS WEEK MEALS (for reference)
────────────────────────
${previousMealTitlesList || 'None provided'}

────────────────────────
PREVIOUS WEEK GROCERY LIST (for leftovers awareness)
────────────────────────
${previousGroceryListText || 'None provided'}

────────────────────────
MEAL STRUCTURE (CONTEXT ONLY)
────────────────────────
${mealStructureContext}

────────────────────────
VARIETY & CONTINUITY BALANCE (CRITICAL)
────────────────────────
This is NOT a full reset week.

Continuity and novelty MUST scale with budget tier:

LOW:
- Mostly reuse the same meals or ingredient combinations
- Small changes allowed via seasoning, cooking method, or format
- Do NOT introduce new staple ingredients unless replacing an old one

MEDIUM:
- MEDIUM Week 2 follows LOW continuity rules by default
- New meals should mostly recombine existing LOW ingredients
- Any new ingredient must fit the MEDIUM upgrade limits (1 protein + 1 carb)
- Do NOT introduce additional protein or carb types beyond upgrades

HIGH:
- Broader variety allowed
- Target ~40–50% meals that feel new
- New meals may introduce new combinations, but still respect reuse and caps

Across all tiers:
- Do NOT simply rename meals
- New meals must differ by flavour profile, cooking method, or ingredient pairing
- Ingredient reuse remains mandatory

DEFINITION OF "NEW" (IMPORTANT):
- "New" does NOT require new ingredients
- "New" can mean:
  - different protein + carb pairing
  - different cooking method
  - different flavour profile
- Do NOT add ingredients just to satisfy novelty

────────────────────────
BUDGET & INGREDIENT CONSTRAINTS (HARD LIMITS)
────────────────────────
BUDGET TIER: ${budgetTier.toUpperCase()}
Weekly Budget Guide: ${budget.weeklyMax}

INGREDIENT CAPS (count unique items across ALL days):
- Proteins: MAX ${budget.proteins}
- Carbohydrates: MAX ${budget.carbs}
- Vegetables: MAX ${budget.vegetables}
- Fruit: MAX ${budget.fruit}
- Sauces/Extras: MAX ${budget.sauces}

Rules:
- Reuse the SAME ingredients across multiple meals and days.
- No single protein should dominate the plan.
- No vegetable used in more than 5–6 meals per week.
- RICE RULE: If rice is chosen, use only 1 type of rice for the entire meal plan (e.g. brown_rice_cooked OR white_rice_cooked – pick one, never mix).
- Pick ONE pasta type if used at all.

TIER RULES (ALWAYS RESPECT AVAILABLE FOODS LIST):
- LOW: Use only cheap proteins (chicken_thigh_skinless_raw, eggs, legumes, tofu, chickpeas_cooked, lentils_cooked, beans) AND only if present in AVAILABLE FOODS.
- MEDIUM: Mix cheap and mid-range proteins, but ONLY those present in AVAILABLE FOODS.
- HIGH: All proteins present in AVAILABLE FOODS are allowed.
Never assume a protein exists unless it appears in AVAILABLE FOODS.

────────────────────────
LEFTOVERS AWARENESS (LIGHTWEIGHT – NO MATH)
────────────────────────
Assume the user may still have leftovers from UK pack sizes bought last week.

Guidelines:
- Prefer reusing staple ingredients commonly sold in large packs (rice, pasta, oats, wraps, canned beans, lentils, frozen veg, sauces).
- Avoid introducing brand-new staple carbs or legumes unless replacing an existing one (1-in / 1-out).
- Design meals so the grocery list is likely a TOP-UP, not a full re-buy.

Do NOT calculate leftovers. Just bias ingredient choices intelligently.

────────────────────────
PROTEIN SOURCE RULES
────────────────────────

PROTEIN VARIETY (DISTINCT TYPES — SAME AS WEEK 1):
- LOW: 3–4 distinct primary protein types per week
- MEDIUM: MAX 5 distinct primary protein types per week
- HIGH: MAX 6 distinct primary protein types per week
- No protein powders or supplements.
- Use only whole, real food protein sources.

────────────────────────
OAT COMBOS RULE (STRICT)
────────────────────────
- Oat combos must ONLY be sweet.
- No savory oat combinations under any circumstances.

PANCAKE RULE (STRICT)
────────────────────────
- Pancakes must ONLY be sweet.
- No savory pancakes under any circumstances.

────────────────────────
INGREDIENT SELECTION STRATEGY (MANDATORY)
────────────────────────
1. Choose your allowed proteins first
2. Choose carbs second
3. Choose vegetables third
4. Choose fruits and sauces last
5. Create meals using ONLY these ingredients

────────────────────────
🚨 CRITICAL: INGREDIENT REQUIREMENTS
────────────────────────
Every meal MUST include AT LEAST 3-5 ingredients. DO NOT create meals with only 1-2 ingredients.

REQUIRED INGREDIENTS PER MEAL:
✅ MUST: 1 protein source (or primary protein)
✅ MUST: 1 carb source  
✅ MUST: At least 1 vegetable or fruit
✅ OPTIONAL: Sauce/seasoning/oil
✅ OPTIONAL: Additional ingredients for variety and flavor

CRITICAL: Output EVERY ingredient with its exact amount in grams. Do not skip any ingredients.

────────────────────────
OUTPUT FORMAT (STRICT – DO NOT DEVIATE)
────────────────────────
===DAY 1===
${inputs.mealsPerDay === 2 ? `===MEAL 1 - Breakfast===
NAME: [Meal name]
CUISINE: [Cuisine type]
INGREDIENTS:
food_id: 80g
food_id: 120g
food_id: 150g
food_id: 20g
(Minimum 3-5 ingredients per meal - include "g" after each amount)

===MEAL 2 - Lunch===
NAME: [Meal name]
CUISINE: [Cuisine type]
INGREDIENTS:
food_id: 200g
food_id: 150g
food_id: 100g
food_id: 50g
(Minimum 3-5 ingredients per meal - include "g" after each amount)
` : inputs.mealsPerDay === 3 ? `===MEAL 1 - Breakfast===
NAME: [Meal name]
CUISINE: [Cuisine type]
INGREDIENTS:
food_id: 80g
food_id: 120g
food_id: 150g
food_id: 20g
(Minimum 3-5 ingredients per meal - include "g" after each amount)

===MEAL 2 - Lunch===
NAME: [Meal name]
CUISINE: [Cuisine type]
INGREDIENTS:
food_id: 200g
food_id: 150g
food_id: 100g

===MEAL 3 - Dinner===
NAME: [Meal name]
CUISINE: [Cuisine type]
INGREDIENTS:
food_id: 250g
food_id: 200g
food_id: 150g
` : `===MEAL 1 - Breakfast===
NAME: [Meal name]
CUISINE: [Cuisine type]
INGREDIENTS:
food_id: 80g
food_id: 120g
food_id: 150g
food_id: 20g
(Minimum 3-5 ingredients per meal - include "g" after each amount)

===MEAL 2 - Lunch===
NAME: [Meal name]
CUISINE: [Cuisine type]
INGREDIENTS:
food_id: 200g
food_id: 150g
food_id: 100g

===MEAL 3 - Dinner===
NAME: [Meal name]
CUISINE: [Cuisine type]
INGREDIENTS:
food_id: 250g
food_id: 200g
food_id: 150g
===MEAL 4 - Snack===
NAME: [Meal name]
CUISINE: [Cuisine type]
INGREDIENTS:
food_id: 100g
food_id: 50g
food_id: 30g
(REQUIRED - DO NOT SKIP THIS MEAL)
`}

===DAY 2===
...

────────────────────────
AVAILABLE FOODS (USE ONLY THESE IDS)
────────────────────────
Use ONLY these ingredient names exactly. Do not invent or substitute other ingredients.
${filteredFoodList}

${budgetTier !== 'high' ? `🚨 BUDGET RESTRICTION: Salmon is only available for HIGH budget tier. You are on ${budgetTier.toUpperCase()} budget, so salmon is NOT in the available foods list above.` : ''}
`;
  } else {
    // Week 1 prompt - switchable between new and original via MEAL_PROMPT_VERSION
    if (MEAL_PROMPT_VERSION === 'new') {
      // NEW PROMPT — from docs/SUPABASE_MEAL_AI_PROMPT_EXACT.md (2026-02-09). Backup: docs/SUPABASE_MEAL_AI_PROMPT_BACKUP_2026-02-09.md
      prompt = `You are a professional nutritionist and fitness-focused chef.
You create meal plans that balance performance nutrition, taste, and budget realism for UK supermarkets.

Output structured text EXACTLY as requested.
Do NOT include commentary, explanations, or apologies.
If creativity conflicts with a rule, FOLLOW THE RULE.

────────────────────────
USER PROFILE
────────────────────────
Diet: ${inputs.dietType}
Daily calories: ${inputs.dailyCalories}
Days: ${inputs.days}
Meals per day: ${inputs.mealsPerDay}
Goal: ${inputs.dietGoal}
Allergies: ${inputs.allergies.length > 0 ? inputs.allergies.join(', ') : 'none'}
Dislikes: ${inputs.dislikes.length > 0 ? inputs.dislikes.join(', ') : 'none'}

Budget Tier: ${budgetTier}
Weekly Budget Guide: ${budget.weeklyMax} (guide only – realism matters more than exact value)

────────────────────────
MEAL STRUCTURE (CONTEXT ONLY – DO NOT OUTPUT) and rough examples
────────────────────────
For 3 meals/day:
- Breakfast ≈ 30–35% daily calories
- Lunch ≈ 30–35% daily calories
- Dinner ≈ 30–35% daily calories

For 4 meals/day:
- Breakfast ≈ 30% daily calories
- Lunch ≈ 30% daily calories
- Dinner ≈ 30% daily calories
-Snack = 10%

Meals must feel appropriately sized and satisfying.

────────────────────────
CORE INTENT
────────────────────────
Meals must be:
- Fitness-oriented
- Realistic to cook repeatedly
- Appropriate to the selected budget tier

TASTE AND COMPLEXITY SCALE WITH BUDGET:
- LOW: macro-first, simple, cheap, repeatable
- MEDIUM: more enjoyable execution using mostly the same ingredients
- HIGH: premium feel but still structured and realistic

Avoid empty, generic naming (e.g. "protein with rice") unless LOW tier AND the meal still includes a clear method or flavour cue (e.g. spiced, roasted, herby, garlic-chilli).

RULE PRIORITY ORDER (IF CONFLICTS ARISE):
HARD CAPS > TIER RULES > DISTRIBUTION RULES > CREATIVITY

────────────────────────
BUDGET-SCALED CREATIVITY RULES (CRITICAL)
────────────────────────

LOW BUDGET CREATIVITY:
- PRIMARY GOAL: hit macros cheaply and reliably
- Meals prioritise protein, calories, satiety, and simplicity over variety
- Expect frequent repetition and simple constructions
- Meals may repeat up to 3 times per week
- Creativity is secondary and comes only from:
  - basic seasoning
  - simple cooking methods
- NOT from adding new ingredients or premium flavours

MEDIUM BUDGET CREATIVITY:
- MEDIUM creativity is achieved by better execution of LOW meals
- Variety comes from cooking method, seasoning, and meal format
- Do NOT increase ingredient variety beyond allowed upgrades
- Meals may repeat up to 2 times per week

HIGH BUDGET CREATIVITY:
- High-quality ingredients and premium feel, but still controlled
- Variety increases, but ingredient reuse is still expected
- Meals should rarely repeat, but repetition is allowed if intentional
- Broader cuisine influence without novelty ingredients
- Premium proteins and richer combinations allowed, within caps
- Meals must remain realistic to cook weekly and shop in standard supermarkets

────────────────────────
CULINARY IDENTITY RULES (ALL BUDGETS)
────────────────────────

Each meal MUST satisfy at least ONE:
- A cuisine influence (Mediterranean, Mexican, Indian, Asian-inspired, etc.)
- A defined cooking method (roasted, baked, stir-fried, spiced, marinated)
- A flavour profile (smoky, herby, tangy, spicy, savoury-sweet)
LOW TIER NOTE:
- For LOW budget meals, satisfy identity using method or flavour cue wording (e.g. spiced, roasted, herby, garlic-chilli), NOT by adding extra ingredients.


COOKING METHOD ROTATION (WEEKLY MINIMUM):
- ≥1 roasted meal
- ≥1 stir-fry or pan-fried meal
- ≥1 saucy or spiced meal (curry, chilli, stew-style)
- ≥1 fresh or bowl-style meal

LUNCH vs DINNER:
- Lunch: lighter, fresher, bowl- or salad-style
- Dinner: cooked, hot, more indulgent
Even with shared ingredients, meals must feel different.

────────────────────────
CONCEPT VALIDITY RULE (CRITICAL)
────────────────────────
- Do NOT use wrap, sandwich, taco, burrito, or flatbread concepts
  unless a corresponding carbohydrate food_id exists.
- If unavailable, express the meal as a bowl, plate, or salad instead.

────────────────────────
HARD WEEKLY INGREDIENT CAPS (MANDATORY)
────────────────────────
Count UNIQUE ingredients across ALL days:

- Proteins: MAX ${budget.proteins}
- Carbohydrates: MAX ${budget.carbs}
- RICE RULE: If rice is chosen, use only 1 type of rice for the entire meal plan (e.g. brown_rice_cooked OR white_rice_cooked OR basmati_rice_cooked – pick one, never mix).
- Vegetables: MAX ${budget.vegetables}
- Fruit: MAX ${budget.fruit}
- Sauces/Extras: MAX ${budget.sauces}

Once ingredients are selected, ONLY these ingredients may be used.
Reuse is mandatory.

────────────────────────
PROTEIN GOVERNANCE (ALL BUDGETS)
────────────────────────

RULES:
TOFU IS NEVER TO BE OVER 1.6KG IN ANY SCENARIO 
CHICKEN NEVER MORE THAN 2KG 
CHICKEN COUNTS AS ONE TYPE:
- Do NOT use both chicken breast and chicken thigh in the same week.
EVEN IF THEY ARE CHEAP YOU STILL NEED VARIETY 

BANANAS NEVER MORE THAN 7 (1 PER DAY AT MOST)
MIXED VEG NEVER MORE THAN 1KG (USE OTHER VEG IF YOU HAVE TO)

PRIMARY PROTEIN:
- Contributes ≥20g protein to a meal

PROTEIN DOMINANCE:
- No single protein >35% of weekly protein
- HIGH tier stricter cap: 30%

PROTEIN VARIETY (DISTINCT TYPES):
- LOW: 3–4 distinct primary protein types per week
- MEDIUM: MAX 5 distinct primary protein types per week
- HIGH: MAX 6 distinct primary protein types per week
(Distinct types = chicken, eggs, tofu, lentils, chickpeas, beef, turkey, tuna, fish, etc.)

DAILY ROTATION:
- Same primary protein max once per day

WHOLE FOODS ONLY:
- No protein powders or supplements

────────────────────────
LOW BUDGET RULES (STRICT, STAPLE-DRIVEN)
────────────────────────

ALLOWED PROTEINS ONLY:
- chicken_thigh_skinless_raw
- eggs
- tofu 
- lentils_cooked
- chickpeas_cooked 
- beans

LOW PROTEIN RULES:
- Cheap proteins must dominate (TOFU CAN BE USED BUT NO MORE THAN 1.6KG)
- Legumes must be PRIMARY protein in ≥2 main meals/week
- Chicken must not dominate

LOW CARB PRIORITY (MANDATORY ORDER):
1. rolled_oats
2. rice (choose ONE)
3. potatoes or sweet_potato
4. pasta or couscous
Avoid quinoa unless already selected.

LOW VEGETABLE RULES:
- ≥50% of veg servings from frozen veg
- Select at most ONE leafy green
- Leafy green packs ≤2 per week
- Reuse veg across ≥4 meals
- No fresh + frozen duplicates

LOW TASTE RULE:
- Keep seasoning simple and repeatable (salt/pepper + 1–2 core spices or herbs)
- LOW tier should feel functional and cheap, not indulgent
- Do not add new ingredients just to increase flavour variety

EXTRA: 
-no need for really any cheese in low budget 
────────────────────────
MEDIUM BUDGET RULES (DERIVED — STRICT)
────────────────────────

MEDIUM BUDGET = LOW BUDGET RULES + LIMITED ADDITIONS.

CRITICAL:
- MEDIUM MUST obey EVERY LOW BUDGET RULE exactly.
- Assume LOW rules apply unless explicitly overridden below.
- If a rule is not listed here, the LOW rule applies.

ALLOWED ADDITIONS (ONLY THESE):

1) PROTEIN:
- Add AT MOST 1 additional protein type beyond LOW.
- This protein may be mid-range.
- It may be used in AT MOST 2 meals total.
- All other meals MUST use LOW proteins.

2) CARBOHYDRATE:
- Add AT MOST 1 additional carbohydrate beyond LOW.
- This carb must be used across multiple meals (not a one-off).
- All other carbs MUST follow LOW carb priority rules.

3) VEGETABLE:
- Add AT MOST 1 additional fresh vegetable beyond LOW.
- Frozen vegetables must still be the majority.

FORBIDDEN IN MEDIUM:
- Additional fruits beyond LOW
- Additional dairy types beyond LOW
- Additional sauces, herbs, spices, oils, or condiments
- Ingredient variety for "interest" or "creativity"

MEDIUM IS NOT:
- A variety tier
- A flavour-experiment tier
- A premium tier

MEDIUM EXISTS ONLY TO:
- Slightly reduce repetition
- Slightly improve enjoyment
- Keep the basket LOW-like in size and cost

────────────────────────
HIGH BUDGET RULES (EXPANDED MEDIUM — CONTROLLED)
────────────────────────

HIGH BUDGET = MEDIUM RULES + MODERATE VARIETY.

CRITICAL:
- HIGH MUST obey ALL MEDIUM RULES unless explicitly overridden here.
- HIGH is NOT a free-for-all.
- Ingredient reuse is still mandatory.

ALLOWED EXPANSIONS (ONLY THESE):

1) PROTEINS:
- You may add AT MOST 1 additional protein beyond MEDIUM.
- Total distinct proteins:
  - LOW: 3–4
  - MEDIUM: max 5
  - HIGH: max 6
- No protein may dominate weekly intake (>30%).

2) CARBOHYDRATES:
- You may add AT MOST 1 additional carbohydrate beyond MEDIUM.
- Carbs must still be reused across multiple meals.
- No novelty one-off carbs.

3) VEGETABLES:
- You may add AT MOST 2 additional vegetables beyond MEDIUM.
- Frozen vegetables should still be used regularly.
- No decorative or one-use vegetables.

4) FRUIT:
- You may add AT MOST 1 additional fruit beyond MEDIUM.
- Fruit variety must remain controlled.

5) SAUCES / EXTRAS:
- You may add AT MOST 1–2 additional sauces or condiments.
- Sauces must be reused across multiple meals.

FORBIDDEN EVEN IN HIGH:
- Luxury-only ingredients
- One-off "interesting" ingredients
- Pantry explosion
- Ingredient variety purely for creativity

HIGH EXISTS TO:
- Reduce repetition
- Improve enjoyment
- Allow slightly broader combinations
NOT to inflate the grocery list.

────────────────────────
BREAKFAST VARIETY RULE
────────────────────────
- Breakfast must rotate between ≥2 concepts
Examples:
- Overnight oats
- Baked oats
- Oat pancakes
- Yogurt + oats bowl
Same ingredients, different formats allowed.

────────────────────────
INGREDIENT SELECTION ORDER (MANDATORY)
────────────────────────
1. Proteins
2. Carbs
3. Vegetables
4. Fruits
5. Sauces/extras

────────────────────────
DISTRIBUTION RULES
────────────────────────
- Ingredient reuse is mandatory
- No excessive repetition beyond tier rules
- Meals must feel gym-focused, satisfying, and human

────────────────────────
🚨 CRITICAL: INGREDIENT REQUIREMENTS
────────────────────────
Every meal MUST include AT LEAST 3-5 ingredients. DO NOT create meals with only 1-2 ingredients.

REQUIRED INGREDIENTS PER MEAL:
✅ MUST: 1 protein source (or primary protein)
✅ MUST: 1 carb source  
✅ MUST: At least 1 vegetable or fruit
✅ OPTIONAL: Sauce/seasoning/oil
✅ OPTIONAL: Additional ingredients for variety and flavor

NOTE: Even LOW budget meals must meet the minimum ingredient requirement.

WRONG (BELOW MINIMUM INGREDIENT REQUIREMENT - DO NOT DO THIS):
INGREDIENTS:
rolled_oats: 100
banana: 120
(Only 2 ingredients - INSUFFICIENT)

RIGHT (PROPER MEAL WITH 4-5+ INGREDIENTS):
INGREDIENTS:
rolled_oats: 80
banana: 120
greek_yogurt: 150
honey: 20
almond_milk: 200
(5 ingredients - CORRECT)

CRITICAL: Output EVERY ingredient with its exact amount in grams. Do not skip any ingredients.

────────────────────────
🚨 CRITICAL: EGG UNIT RULE
────────────────────────
Eggs must ALWAYS be specified as whole units (minimum 60g = 1 egg).
- DO NOT use amounts like 13g, 25g, or 50g for eggs
- ALWAYS use 60g (1 egg), 120g (2 eggs), 180g (3 eggs), etc.
- You cannot crack an egg and weigh out partial amounts - eggs come in whole units only
- Example: "egg: 60g" or "egg: 120g" (NOT "egg: 50g" or "egg: 13g")
- CRITICAL: Always include "g" after the amount (e.g., "egg: 60g" NOT "egg: 60")

────────────────────────
OAT COMBOS RULE (CRITICAL):
────────────────────────
- Oat combos must ONLY be used in SWEET combinations (e.g., with fruits, honey, nuts, seeds, yogurt)
- DO NOT create savory oat combinations (e.g., oats with chicken, eggs, vegetables, or savory proteins)
- Most people find savory oat combinations unappealing - stick to sweet oat recipes only

────────────────────────
PANCAKE RULE (CRITICAL):
────────────────────────
- Pancakes must ONLY be SWEET (e.g., with fruits, honey, maple syrup, yogurt, nuts, seeds)
- DO NOT create savory pancake combinations (e.g., pancakes with chicken, eggs, vegetables, or savory proteins)
- Most people find savory pancakes unappealing - stick to sweet pancake recipes only

────────────────────────
🚨 CRITICAL: MEAL COUNT REQUIREMENT (${inputs.mealsPerDay} MEALS PER DAY)
────────────────────────

You MUST generate EXACTLY ${inputs.mealsPerDay} meals per day for ALL ${inputs.days} days.

${inputs.mealsPerDay === 4 ? `CRITICAL FOR 4-MEAL PLANS:
- EVERY day MUST have exactly 4 meals: MEAL 1 (Breakfast), MEAL 2 (Lunch), MEAL 3 (Dinner), MEAL 4 (Snack)
- DO NOT skip MEAL 4 (Snack) - it is REQUIRED and must be a FULL MEAL with 3-5 ingredients
- The snack should contribute ~10% of daily calories (~${Math.round((inputs.dailyCalories || 2000) * 0.1)} calories)
- If you only generate 3 meals, your output is INVALID

` : inputs.mealsPerDay === 3 ? `CRITICAL FOR 3-MEAL PLANS:
- Each day MUST have exactly 3 meals: MEAL 1 (Breakfast), MEAL 2 (Lunch), MEAL 3 (Dinner)
- DO NOT include snacks or a 4th meal

` : ''}
────────────────────────
OUTPUT FORMAT (STRICT)
────────────────────────

===DAY 1===
${inputs.mealsPerDay === 2 ? `===MEAL 1 - Breakfast===
NAME: [Meal name]
CUISINE: [Cuisine]
INGREDIENTS:
food_id: 80g
food_id: 120g
food_id: 150g
food_id: 20g
(Minimum 3-5 ingredients per meal - include "g" after each amount)

===MEAL 2 - Lunch===
NAME: [Meal name]
CUISINE: [Cuisine]
INGREDIENTS:
food_id: 200g
food_id: 150g
food_id: 100g
food_id: 50g
(Minimum 3-5 ingredients per meal - include "g" after each amount)
` : inputs.mealsPerDay === 3 ? `===MEAL 1 - Breakfast===
NAME: [Meal name]
CUISINE: [Cuisine]
INGREDIENTS:
food_id: 80g
food_id: 120g
food_id: 150g
food_id: 20g
(Minimum 3-5 ingredients per meal - include "g" after each amount)

===MEAL 2 - Lunch===
NAME: [Meal name]
CUISINE: [Cuisine]
INGREDIENTS:
food_id: 200g
food_id: 150g
food_id: 100g

===MEAL 3 - Dinner===
NAME: [Meal name]
CUISINE: [Cuisine]
INGREDIENTS:
food_id: 250g
food_id: 200g
food_id: 150g
` : `===MEAL 1 - Breakfast===
NAME: [Meal name]
CUISINE: [Cuisine]
INGREDIENTS:
food_id: 80g
food_id: 120g
food_id: 150g
food_id: 20g
(Minimum 3-5 ingredients per meal - include "g" after each amount)

===MEAL 2 - Lunch===
NAME: [Meal name]
CUISINE: [Cuisine]
INGREDIENTS:
food_id: 200g
food_id: 150g
food_id: 100g

===MEAL 3 - Dinner===
NAME: [Meal name]
CUISINE: [Cuisine]
INGREDIENTS:
food_id: 250g
food_id: 200g
food_id: 150g
===MEAL 4 - Snack===
NAME: [Meal name]
CUISINE: [Cuisine]
INGREDIENTS:
food_id: 100g
food_id: 80g
food_id: 50g
(REQUIRED - DO NOT SKIP THIS MEAL - include "g" after each amount)
`}
===DAY 2===
[Repeat for all ${inputs.days} days - MUST include MEAL 4 (Snack) for EVERY day if mealsPerDay === 4]

────────────────────────
AVAILABLE FOODS
────────────────────────
Use ONLY these food IDs and ingredient names exactly. Do not invent or substitute other ingredients.
${filteredFoodList}

${budgetTier !== 'high' ? `🚨 BUDGET RESTRICTION: Salmon is only available for HIGH budget tier. You are on ${budgetTier.toUpperCase()} budget, so salmon is NOT in the available foods list above.` : ''}

Do NOT invent ingredients.
Do NOT change food IDs.
Do NOT explain decisions.

Generate all ${inputs.days} days now.`;
    } else {
      // ORIGINAL PROMPT (backup - can be reverted)
    prompt = `You are the Gordon Ramsay of fitness nutrition. You create meals that fuel athletic performance while being delicious enough to make people excited to eat them.

USER PROFILE:

Diet: ${inputs.dietType}
Daily calories: ${inputs.dailyCalories}
Days: ${inputs.days}
Meals per day: ${inputs.mealsPerDay}
Goal: ${inputs.dietGoal}
Allergies: ${inputs.allergies.length > 0 ? inputs.allergies.join(', ') : 'none'}
Dislikes: ${inputs.dislikes.length > 0 ? inputs.dislikes.join(', ') : 'none'}
Budget Tier: ${budgetTier} (weekly max: ${budget.weeklyMax} - price is just a guide)

MEAL STRUCTURE (for context only):
${mealStructureContext}

CREATIVITY BALANCE:

Balance creative cuisine exploration with reliable classics. Include exciting meals (Mediterranean spiced bowls, Asian fusion, Mexican-inspired) alongside dependable staples (chicken rice broccoli, overnight oats). Let variety happen naturally.

BUDGET & INGREDIENT CONSTRAINTS (CRITICAL):

BUDGET TIER: ${budgetTier.toUpperCase()}
Weekly Budget Guide: ${budget.weeklyMax} (use as reference only)

INGREDIENT SELECTION:
${budgetTier === 'low' ? `LOW: Cheap proteins only (chicken_thigh_skinless_raw, eggs, legumes, tofu, chickpeas_cooked, lentils_cooked, beans). Avoid salmon/beef/lamb. Use 5-6 proteins, 4-5 carbs, 8-10 vegetables.` : budgetTier === 'medium' ? `MEDIUM: Mix cheap + mid-range proteins. Can include some salmon/beef. Use 6-7 proteins, 5-6 carbs, 10-12 vegetables.` : `HIGH: All proteins allowed (salmon, beef, lamb, chicken, fish, eggs, legumes, tofu, etc.). Use 7-8 proteins, 6-7 carbs, 12+ vegetables.`}

WEEKLY INGREDIENT CAPS (STRICT LIMITS - MANDATORY):
These are HARD LIMITS that MUST NOT be exceeded. Count unique ingredients across ALL ${inputs.days} days:

- Proteins: MAX ${budget.proteins} unique protein sources
  * Current tier: ${budgetTier === 'low' ? '5-6' : budgetTier === 'medium' ? '6-7' : '7-8'} unique proteins
  * You MUST reuse the same proteins across multiple meals and days
  * Example: Use chicken_breast in 3-4 different meals, not introduce 10 different proteins
  ${budgetTier === 'low' ? '* LOW TIER: Only use cheap proteins (chicken_thigh_skinless_raw, eggs, legumes, tofu, chickpeas_cooked, lentils_cooked, beans). DO NOT use salmon, beef, or lamb.' : budgetTier === 'medium' ? '* MEDIUM TIER: Mix cheap and mid-range proteins. Can include some salmon or beef, but prioritize cheaper options.' : '* HIGH TIER: All proteins allowed. Use variety across all protein types.'}

- Carbohydrates: MAX ${budget.carbs} unique carb sources (e.g., brown_rice_cooked, rolled_oats, wholewheat_pasta_cooked, potatoes, sweet_potato_raw)
  * Current tier: ${budgetTier === 'low' ? '4-5' : budgetTier === 'medium' ? '5-6' : '6-7'} unique carbs
  * Pick ONE primary rice and reuse it. Pick ONE pasta type if needed. Reuse the same carbs.

- Vegetables: MAX ${budget.vegetables} unique vegetables (e.g., broccoli, spinach, carrots, bell_pepper, tomatoes)
  * Current tier: ${budgetTier === 'low' ? '8-10' : budgetTier === 'medium' ? '10-12' : '12+'} unique vegetables
  * Reuse the same vegetables across multiple meals - do NOT introduce a new vegetable for every meal

- Fruit: MAX ${budget.fruit} unique fruits (e.g., banana, apple, strawberries, blueberries)
  * Current tier: ${budgetTier === 'low' ? '2–3' : budgetTier === 'medium' ? '3–4' : '4–6'} unique fruits
  * Reuse the same fruits - do NOT use 10 different fruits

- Sauces/Extras: MAX ${budget.sauces} unique sauces/extras (e.g., olive_oil, soy_sauce, honey, peanut_butter)
  * Current tier: ${budgetTier === 'low' ? '3–5' : budgetTier === 'medium' ? '4–6' : '5–8'} unique sauces/extras

CRITICAL ENFORCEMENT:
- Before generating, plan which ${budget.proteins} proteins you'll use and reuse them
- Before generating, plan which ${budget.carbs} carbs you'll use and reuse them
- Before generating, plan which ${budget.vegetables} vegetables you'll use and reuse them
- If you exceed these limits, your output is INVALID and must be regenerated

DISTRIBUTION RULE (ALL BUDGETS):
- Spread ingredients evenly - don't overuse any single item
- No vegetable in more than 5-6 meals per week
- No protein dominating the plan
- Vary your choices throughout the week

PROTEIN SOURCE REQUIREMENT:
- DO NOT use protein powders, supplements, or processed protein products
- ALL protein must come from natural, whole food sources (e.g., chicken, fish, eggs, beans, lentils, tofu, Greek yogurt, etc.)
- Focus on real, unprocessed protein foods that people can buy at a regular grocery store

PROTEIN DISTRIBUTION:
- Distribute proteins evenly across the week - if you choose ${budget.proteins} proteins, each should appear roughly equal times
- Don't overuse one protein source - balance protein usage across all selected proteins
- Vary your protein choices throughout the week - don't let one protein dominate the plan

OAT COMBOS RULE (CRITICAL):
- Oat combos must ONLY be used in SWEET combinations (e.g., with fruits, honey, nuts, seeds, yogurt)
- DO NOT create savory oat combinations (e.g., oats with chicken, eggs, vegetables, or savory proteins)
- Most people find savory oat combinations unappealing - stick to sweet oat recipes only

PANCAKE RULE (CRITICAL):
- Pancakes must ONLY be SWEET (e.g., with fruits, honey, maple syrup, yogurt, nuts, seeds)
- DO NOT create savory pancake combinations (e.g., pancakes with chicken, eggs, vegetables, or savory proteins)
- Most people find savory pancakes unappealing - stick to sweet pancake recipes only

PANCAKE RULE (CRITICAL):
- Pancakes must ONLY be used in SWEET combinations (e.g., with fruits, honey, syrup, yogurt, berries)
- DO NOT create savory pancake combinations (e.g., pancakes with chicken, eggs, vegetables, or savory proteins)
- Most people find savory pancake combinations unappealing - stick to sweet pancake recipes only

INGREDIENT REUSE REQUIREMENT (MANDATORY):

CRITICAL: You MUST reuse the same ingredients across multiple meals and days. This is NOT optional - it's required to:
1. Stay within the ingredient caps above (you will FAIL if you exceed them)
2. Reduce grocery costs
3. Minimize food waste

STRATEGY FOR REUSE:
1. Choose your ${budget.proteins} proteins FIRST (e.g., chicken_breast, salmon, eggs, tofu)
2. Choose your ${budget.carbs} carbs FIRST (e.g., brown_rice_cooked, rolled_oats, wholewheat_pasta_cooked)
3. Choose your ${budget.vegetables} vegetables FIRST (e.g., broccoli, spinach, carrots, bell_pepper)
4. Choose your ${budget.fruit} fruits FIRST (e.g., banana, apple, strawberries)
5. THEN create meals using ONLY these pre-selected ingredients

Examples of CORRECT reuse:
- Use brown_rice_cooked in 4-5 different meals across different days (same ingredient, different recipes)
- Use chicken_breast in 3-4 different meals (same protein, different preparations)
- Use broccoli in 3-4 different meals (same vegetable, different dishes)
- Use banana in 2-3 different meals (same fruit, different uses)

Examples of INCORRECT (DO NOT DO THIS):
- Introducing a new protein for every meal (e.g., chicken_breast, then salmon, then beef, then turkey, then tofu, then eggs, then chickpeas, then lentils, then tuna, then cod = 10 proteins = FAIL)
- Introducing a new vegetable for every meal (e.g., broccoli, then spinach, then carrots, then bell_pepper, then tomatoes, then mushrooms, then courgette, then aubergine, then cucumber, then lettuce, then kale, then cabbage = 12 vegetables = FAIL for low tier)
- Using a different rice for each meal (e.g., brown_rice_cooked, then white_rice_cooked, then basmati_rice_cooked, then quinoa_cooked = 4 carbs = OK for low tier, but inefficient)

INGREDIENT EFFICIENCY (MANDATORY):

Pick ONE primary rice for the week and use it in 4-6 meals (reuse it!)
Pick ONE primary pasta if needed and use it in 2-3 meals (reuse it!)
Reuse the SAME ${budget.vegetables} vegetables across multiple meals (same vegetables throughout)
Reuse the SAME ${budget.proteins} proteins across multiple meals (same proteins throughout)
Avoid single-use niche ingredients - if you use an ingredient, use it at least 2-3 times

YOUR TASK:
Generate ${inputs.days} days of meal concepts. For each meal, provide:

Meal name
Ingredient list with realistic home-cooked portions (roughly 600 kcal per meal). Focus on balanced meal composition - the system will scale portions automatically to hit user targets.

🚨 CRITICAL: INGREDIENT REQUIREMENTS
Every meal MUST include AT LEAST 3-5 ingredients. DO NOT create meals with only 1-2 ingredients.

REQUIRED INGREDIENTS PER MEAL:
✅ MUST: 1 protein source (or primary protein)
✅ MUST: 1 carb source  
✅ MUST: At least 1 vegetable or fruit
✅ OPTIONAL: Sauce/seasoning/oil
✅ OPTIONAL: Additional ingredients for variety and flavor

WRONG (TOO FEW INGREDIENTS - DO NOT DO THIS):
INGREDIENTS:
rolled_oats: 100
banana: 120
(Only 2 ingredients - INSUFFICIENT)

RIGHT (PROPER MEAL WITH 4-5+ INGREDIENTS):
INGREDIENTS:
rolled_oats: 80
banana: 120
greek_yogurt: 150
honey: 20
almond_milk: 200
(5 ingredients - CORRECT)

CRITICAL: Output EVERY ingredient with its exact amount in grams. Do not skip any ingredients.

🚨 CRITICAL: MEAL COUNT REQUIREMENT (${inputs.mealsPerDay} MEALS PER DAY)

You MUST generate EXACTLY ${inputs.mealsPerDay} meals per day for ALL ${inputs.days} days.

${inputs.mealsPerDay === 4 ? `CRITICAL FOR 4-MEAL PLANS:
- EVERY day MUST have exactly 4 meals: MEAL 1 (Breakfast), MEAL 2 (Lunch), MEAL 3 (Dinner), MEAL 4 (Snack)
- DO NOT skip MEAL 4 (Snack) - it is REQUIRED and must be a FULL MEAL with 3-5 ingredients
- The snack should contribute ~10% of daily calories (~${Math.round((inputs.dailyCalories || 2000) * 0.1)} calories)
- If you only generate 3 meals, your output is INVALID

` : inputs.mealsPerDay === 3 ? `CRITICAL FOR 3-MEAL PLANS:
- Each day MUST have exactly 3 meals: MEAL 1 (Breakfast), MEAL 2 (Lunch), MEAL 3 (Dinner)
- DO NOT include snacks or a 4th meal

` : inputs.mealsPerDay === 2 ? `CRITICAL FOR 2-MEAL PLANS:
- Each day MUST have exactly 2 meals: MEAL 1 and MEAL 2
- CALORIE DISTRIBUTION: Balance calories 50/50 between the two meals
- Each meal should contribute ~50% of daily calories (~${Math.round((inputs.dailyCalories || 2000) * 0.5)} calories per meal)
- Both meals must be substantial and balanced with 3-5 ingredients each
- DO NOT include a 3rd meal or snack

` : ''}
OUTPUT FORMAT (STRICT):
===DAY 1===
${inputs.mealsPerDay === 2 ? `===MEAL 1 - Breakfast===
NAME: [Meal name]
CUISINE: [type]
INGREDIENTS:
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
(Minimum 3-5 ingredients per meal)

===MEAL 2 - Lunch===
NAME: [Meal name]
CUISINE: [type]
INGREDIENTS:
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
(Minimum 3-5 ingredients per meal)
` : inputs.mealsPerDay === 3 ? `===MEAL 1 - Breakfast===
NAME: [Meal name]
CUISINE: [type]
INGREDIENTS:
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
(Minimum 3-5 ingredients per meal)
===MEAL 2 - Lunch===
NAME: [Meal name]
CUISINE: [type]
INGREDIENTS:
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams

===MEAL 3 - Dinner===
NAME: [Meal name]
CUISINE: [type]
INGREDIENTS:
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
` : `===MEAL 1 - Breakfast===
NAME: [Meal name]
CUISINE: [type]
INGREDIENTS:
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
(Minimum 3-5 ingredients per meal)
===MEAL 2 - Lunch===
NAME: [Meal name]
CUISINE: [type]
INGREDIENTS:
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams

===MEAL 3 - Dinner===
NAME: [Meal name]
CUISINE: [type]
INGREDIENTS:
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
===MEAL 4 - Snack===
NAME: [Meal name]
CUISINE: [type]
INGREDIENTS:
food_id: amount_in_grams
food_id: amount_in_grams
food_id: amount_in_grams
(REQUIRED - DO NOT SKIP THIS MEAL)
`}
===DAY 2===
[Repeat for all ${inputs.days} days - MUST include MEAL 4 (Snack) for EVERY day if mealsPerDay === 4]

🚨 CRITICAL: DAY COUNT REQUIREMENT
────────────────────────
You MUST generate EXACTLY ${inputs.days} days.
- Day numbers MUST be sequential: DAY 1, DAY 2, DAY 3${inputs.days > 3 ? `, ... DAY ${inputs.days}` : ''}
- DO NOT repeat day numbers (e.g., don't output DAY 1 twice)
- DO NOT skip day numbers (e.g., don't go from DAY 1 to DAY 3)
- DO NOT generate more than ${inputs.days} days
- Each day must have exactly ${inputs.mealsPerDay} meal${inputs.mealsPerDay > 1 ? 's' : ''}

AVAILABLE FOODS (use ONLY these IDs): Use ONLY these ingredient names exactly.
${filteredFoodList}

${budgetTier !== 'high' ? `🚨 BUDGET RESTRICTION: Salmon is only available for HIGH budget tier. You are on ${budgetTier.toUpperCase()} budget, so salmon is NOT in the available foods list above.` : ''}

Generate EXACTLY ${inputs.days} days now. Start with ===DAY 1=== and end with ===DAY ${inputs.days}===.`;
    }
  }

  // Call GPT-4.1-mini
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    max_tokens: 16000,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: 'You are a professional nutritionist creating meal plans. Output structured text exactly as requested.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const duration = Date.now() - startTime;
  const text = response.choices[0]?.message?.content || '';

  return text;
}

/**
 * STEP 2: Parse AI response to structured object
 */
function parseMealConcepts(aiResponse: string, days: number, mealsPerDay: number): any {
  const startTime = Date.now();

  // 🔍 DIAGNOSTIC: Log parsing input

  const result = {
    days: [] as any[]
  };

  // Split by day delimiters
  const dayRegex = /===DAY\s+(\d+)===/gi;
  let dayMatches: Array<{ number: number; index: number }> = [];
  let match;
  while ((match = dayRegex.exec(aiResponse)) !== null) {
    dayMatches.push({
      number: parseInt(match[1], 10),
      index: match.index
    });
  }

  if (dayMatches.length === 0) {
    throw new Error('No days found in AI response');
  }

  // 🔧 FIX: Validate day count and sequential numbering
  const uniqueDayNumbers = new Set(dayMatches.map(m => m.number));
  const expectedDays = days;
  const foundDays = uniqueDayNumbers.size;
  
  if (foundDays !== expectedDays) {
    // Check if days are sequential starting from 1
    const sortedDays = Array.from(uniqueDayNumbers).sort((a, b) => a - b);
    const isSequential = sortedDays.length === expectedDays && 
                         sortedDays[0] === 1 && 
                         sortedDays[sortedDays.length - 1] === expectedDays &&
                         sortedDays.every((d, i) => d === i + 1);
    
    // If too many days, truncate to expected count (keep first N days)
    if (foundDays > expectedDays) {
      // Filter to only include days 1 through expectedDays
      const validDayNumbers = new Set(Array.from({ length: expectedDays }, (_, i) => i + 1));
      dayMatches = dayMatches.filter(m => validDayNumbers.has(m.number));
      // Remove duplicates - keep first occurrence of each day number
      const seen = new Set<number>();
      dayMatches = dayMatches.filter(m => {
        if (seen.has(m.number)) return false;
        seen.add(m.number);
        return true;
      });
      // Sort by day number
      dayMatches.sort((a, b) => a.number - b.number);
    } else if (foundDays < expectedDays) {
      throw new Error(`Insufficient days generated: found ${foundDays} days, expected ${expectedDays}. The AI may have stopped early or generated duplicate day numbers.`);
    }
  }

  // Extract each day
  for (let i = 0; i < dayMatches.length; i++) {
    const startIndex = dayMatches[i].index;
    const endIndex = i < dayMatches.length - 1 ? dayMatches[i + 1].index : aiResponse.length;
    const dayContent = aiResponse.substring(startIndex, endIndex);

    const day: any = {
      dayIndex: dayMatches[i].number,
      meals: []
    };

    // Extract meals
    const mealRegex = /===MEAL\s+(\d+)\s+-\s+(\w+)===/gi;
    const mealMatches: Array<{ number: number; type: string; index: number }> = [];
    let mealMatch;
    while ((mealMatch = mealRegex.exec(dayContent)) !== null) {
      mealMatches.push({
        number: parseInt(mealMatch[1], 10),
        type: mealMatch[2].toLowerCase(),
        index: mealMatch.index
      });
    }

    // Extract each meal
    for (let j = 0; j < mealMatches.length; j++) {
      const mealStartIndex = mealMatches[j].index;
      const mealEndIndex = j < mealMatches.length - 1 ? mealMatches[j + 1].index : dayContent.length;
      const mealContent = dayContent.substring(mealStartIndex, mealEndIndex);

      // Extract name
      const nameMatch = mealContent.match(/NAME:\s*(.+)/i);
      if (!nameMatch) continue;

      // Extract cuisine
      const cuisineMatch = mealContent.match(/CUISINE:\s*(.+)/i);
      const cuisine = cuisineMatch ? cuisineMatch[1].trim() : 'International';

      // Extract ingredients
      const ingredientsSection = mealContent.match(/INGREDIENTS:([\s\S]*?)(?===MEAL|===DAY|$)/i);
      const ingredients: Array<{ id: string; amount: number }> = [];

      if (ingredientsSection) {
        const ingredientsText = ingredientsSection[1].trim();
        const lines = ingredientsText.split('\n').filter(l => l.trim());
        
        // 🔍 DIAGNOSTIC: Log raw ingredients text
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('===')) continue;
          
          // Match: food_id: amount (FIXED: handle underscores, hyphens, numbers in food IDs, and parenthetical comments)
          // Handles formats like:
          // - "egg: 50g"
          // - "egg: 50g (1 egg)"
          // - "chicken_breast: 150g"
          // - "banana: 11" (without "g" - should be treated as 11 bananas = 1320g)
          // Remove parenthetical comments before parsing
          const cleanedLine = trimmed.replace(/\s*\([^)]*\)\s*$/, ''); // Remove trailing comments like "(1 egg)"
          const ingMatch = cleanedLine.match(/^([a-z0-9_-]+):\s*(\d+(?:\.\d+)?)\s*(g|grams?|ml|milliliters?)?$/i);
          if (ingMatch) {
            const foodId = ingMatch[1].trim();
            let amount = parseFloat(ingMatch[2]);
            const unitMatch = ingMatch[3]; // Extract unit if provided (g, ml, etc.)
            const hasExplicitUnit = !!unitMatch; // Check if "g" or "ml" was explicitly provided
            
            // Determine unit: if explicitly provided, use it; otherwise default to 'g'
            let unit: string | undefined = undefined;
            if (unitMatch) {
              // Normalize unit: 'g', 'grams', 'gram' → 'g'; 'ml', 'milliliters', 'milliliter' → 'ml'
              const unitLower = unitMatch.toLowerCase();
              if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
                unit = 'g';
              } else if (unitLower === 'ml' || unitLower === 'milliliter' || unitLower === 'milliliters') {
                unit = 'ml';
              } else {
                unit = unitMatch; // Keep as-is if unknown
              }
            } else {
              // No unit specified - default to 'g' for weight-based items
              unit = 'g';
            }
            
            ingredients.push({
              id: foodId,
              amount: amount,
              unit: unit // 🔧 FIX: Set unit so calculateMacroMultiplier knows it's weight-based
            } as any); // Type assertion needed because unit is optional in some contexts
          }
        }
      } else {
      }

      if (ingredients.length > 0) {
        // Map meal type from AI response to standard types
        let mealType = mealMatches[j].type.toLowerCase();
        if (mealType === 'snack' && mealsPerDay === 4) {
          mealType = 'snack';
        } else if (mealType === 'breakfast') {
          mealType = 'breakfast';
        } else if (mealType === 'lunch') {
          mealType = 'lunch';
        } else if (mealType === 'dinner') {
          mealType = 'dinner';
        }
        
        day.meals.push({
          mealType: mealType,
          name: nameMatch[1].trim(),
          cuisine: cuisine,
          ingredients: ingredients
        });
      }
    }

    if (day.meals.length > 0) {
      result.days.push(day);
    }
  }

  // 🔧 FIX: Validate final day count matches expected
  const finalDayCount = result.days.length;
  if (finalDayCount !== days) {
    if (finalDayCount > days) {
      // Truncate to expected number of days (keep first N days)
      result.days = result.days.slice(0, days);
    } else if (finalDayCount < days) {
      throw new Error(`Insufficient days in final result: got ${finalDayCount} days, expected ${days}. The AI may have stopped early.`);
    }
  }
  
  // Validate day indices are sequential (1, 2, 3, ..., N)
  const dayIndices = result.days.map((d: any) => d.dayIndex).sort((a: number, b: number) => a - b);
  const expectedIndices = Array.from({ length: days }, (_, i) => i + 1);
  const isSequential = dayIndices.length === expectedIndices.length && 
                       dayIndices.every((idx: number, i: number) => idx === expectedIndices[i]);
  
  if (!isSequential) {
    // Try to fix by renumbering days sequentially
    result.days.forEach((day: any, index: number) => {
      day.dayIndex = index + 1;
    });
  }

  const duration = Date.now() - startTime;

  return result;
}

/**
 * Validate macro percentages against target ranges
 * Target ranges:
 * - Protein: 22–27% of calories
 * - Fat: 23–30% of calories
 * - Carbs: 45–55% of calories
 */
function validateMacroPercentages(
  calories: number,
  protein_g: number,
  carbs_g: number,
  fat_g: number,
  mealName: string
): { isValid: boolean; warnings: string[] } {
  if (calories === 0) {
    return { isValid: false, warnings: ['No calories - cannot validate macros'] };
  }

  const warnings: string[] = [];
  
  // Calculate calories from each macro (protein and carbs = 4 cal/g, fat = 9 cal/g)
  const proteinCalories = protein_g * 4;
  const carbsCalories = carbs_g * 4;
  const fatCalories = fat_g * 9;
  
  // Calculate percentages
  const proteinPercent = (proteinCalories / calories) * 100;
  const carbsPercent = (carbsCalories / calories) * 100;
  const fatPercent = (fatCalories / calories) * 100;
  
  // Validate against ranges
  if (proteinPercent < 22 || proteinPercent > 27) {
    warnings.push(`Protein ${proteinPercent.toFixed(1)}% (target: 22–27%)`);
  }
  if (carbsPercent < 45 || carbsPercent > 55) {
    warnings.push(`Carbs ${carbsPercent.toFixed(1)}% (target: 45–55%)`);
  }
  if (fatPercent < 23 || fatPercent > 30) {
    warnings.push(`Fat ${fatPercent.toFixed(1)}% (target: 23–30%)`);
  }
  
  if (warnings.length > 0) {
    return { isValid: false, warnings };
  }
  
  return { isValid: true, warnings: [] };
}

/**
 * STEP 3: Scale portions to hit calorie targets
 */
function scalePortionsToTargets(
  parsedMeals: any,
  mealTargets: Record<string, number>,
  fullFoodMap: Record<string, Food>
): any {
  const startTime = Date.now();
  
  const foodMapSize = Object.keys(fullFoodMap).length;
  if (foodMapSize === 0) {
    throw new Error('CRITICAL: Food map is empty!');
  }

  const scaled = {
    days: parsedMeals.days.map((day: any) => ({
      dayIndex: day.dayIndex,
      meals: day.meals.map((meal: any) => {
        // Calculate AI's total calories
        let aiTotal = 0;
        const validIngredients: any[] = [];
        const skippedIngredients: any[] = [];
        
        meal.ingredients.forEach((ing: any) => {
          
          // 🔧 FIX: Try direct lookup first, then resolveToLeanId as fallback
          let food = fullFoodMap[ing.id];
          let resolvedId = ing.id;
          
          if (!food) {
            // Try resolveToLeanId to handle variations (e.g., "chicken_thigh" → "chicken_thigh_skinless_raw")
            const resolved = resolveToLeanId(ing.id);
            if (resolved && fullFoodMap[resolved]) {
              food = fullFoodMap[resolved];
              resolvedId = resolved;
            }
          }
          
          if (food && food.macrosPer100 && food.macrosPer100.calories) {
            // ✅ FIX: Handle units vs grams correctly
            const multiplier = calculateMacroMultiplier(food, ing.amount, ing.unit);
            const cals = food.macrosPer100.calories * multiplier;
            aiTotal += cals;
            // Use resolved ID if different from original
            validIngredients.push({
              ...ing,
              id: resolvedId  // Use resolved ID for consistency
            });
          } else {
            skippedIngredients.push(ing);
            void resolveToLeanId(ing.id);
          }
        });

        if (validIngredients.length === 0) {
          return null;
        }

        // Calculate scale factor
        // For 2-meal plans, both meals should target 50% of daily calories
        // mealType should be 'breakfast' or 'lunch' for 2-meal plans
        let target: number | undefined = mealTargets[meal.mealType];
        if (target === undefined) {
          // Fallback: try breakfast, then lunch
          target = mealTargets['breakfast'] || mealTargets['lunch'];
        }
        
        const scaleFactor = aiTotal > 0 && target !== undefined ? target / aiTotal : 1;


        // Scale each ingredient with smart rounding (only valid ingredients)
        // Use Math.round() for normal rounding - rebalancing logic will compensate for any losses
        let scaledIngredients = validIngredients.map((ing: any) => {
          let scaledAmount = ing.amount * scaleFactor;

          // 🔧 FIX: Eggs must always be whole units (60g minimum, rounded to nearest 60g)
          // You can't crack an egg and weigh out 13g - eggs come in whole units
          if (ing.id === 'egg' || ing.id === 'eggs') {
            if (scaledAmount < 60) {
              scaledAmount = 60; // Minimum 1 egg = 60g
            } else {
              // Round to nearest whole egg (nearest 60g)
              scaledAmount = Math.round(scaledAmount / 60) * 60;
              if (scaledAmount === 0) scaledAmount = 60; // Ensure at least 1 egg
            }
          } else {
            // Smart rounding based on size (round to nearest)
            if (scaledAmount < 20) {
              scaledAmount = Math.round(scaledAmount); // Round to nearest 1g
            } else if (scaledAmount < 100) {
              scaledAmount = Math.round(scaledAmount / 5) * 5; // Round to nearest 5g
            } else if (scaledAmount < 250) {
              scaledAmount = Math.round(scaledAmount / 10) * 10; // Round to nearest 10g
            } else {
              scaledAmount = Math.round(scaledAmount / 25) * 25; // Round to nearest 25g
            }
          }

          return {
            id: ing.id,
            amount: scaledAmount
          };
        });

        // Recalculate final macros with rounded portions
        let finalCalories = 0;
        let finalProtein = 0;
        let finalCarbs = 0;
        let finalFat = 0;

        scaledIngredients.forEach((ing: any) => {
          const food = fullFoodMap[ing.id];
          if (food && food.macrosPer100) {
            // ✅ FIX: Handle units vs grams correctly
            const multiplier = calculateMacroMultiplier(food, ing.amount, ing.unit);
            finalCalories += food.macrosPer100.calories * multiplier;
            finalProtein += food.macrosPer100.protein_g * multiplier;
            finalCarbs += food.macrosPer100.carbs_g * multiplier;
            finalFat += food.macrosPer100.fat_g * multiplier;
          }
        });

        // Round final macros (use Math.round() - rebalancing will compensate for any losses)
        const roundedCalories = Math.round(finalCalories);
        const roundedProtein = Math.round(finalProtein * 10) / 10;
        const roundedCarbs = Math.round(finalCarbs * 10) / 10;
        const roundedFat = Math.round(finalFat * 10) / 10;

        // Validate macro percentages
        const macroValidation = validateMacroPercentages(
          roundedCalories,
          roundedProtein,
          roundedCarbs,
          roundedFat,
          meal.name
        );

        // Log validation result (only warnings if out of range)
        if (!macroValidation.isValid) {
          const proteinCal = roundedProtein * 4;
          const carbsCal = roundedCarbs * 4;
          const fatCal = roundedFat * 9;
          const proteinPct = ((proteinCal / roundedCalories) * 100).toFixed(1);
          const carbsPct = ((carbsCal / roundedCalories) * 100).toFixed(1);
          const fatPct = ((fatCal / roundedCalories) * 100).toFixed(1);
        } else {
          const proteinCal = roundedProtein * 4;
          const carbsCal = roundedCarbs * 4;
          const fatCal = roundedFat * 9;
          const proteinPct = ((proteinCal / roundedCalories) * 100).toFixed(1);
          const carbsPct = ((carbsCal / roundedCalories) * 100).toFixed(1);
          const fatPct = ((fatCal / roundedCalories) * 100).toFixed(1);
        }

        return {
          mealType: meal.mealType,
          name: meal.name,
          cuisine: meal.cuisine,
          ingredients: scaledIngredients,
          macrosPerPortion: {
            calories: roundedCalories,
            protein_g: roundedProtein,
            carbs_g: roundedCarbs,
            fat_g: roundedFat
          },
          macroValidation: macroValidation // Include validation result for debugging
        };
      }).filter((meal: any) => meal !== null) // Remove null meals
    }))
  };

  // Filter out days with no meals
  scaled.days = scaled.days.filter((day: any) => day.meals.length > 0);

  // Calculate day totals and validate daily macro percentages
  scaled.days.forEach((day: any) => {
    day.totalCalories = day.meals.reduce((sum: number, meal: any) => 
      sum + (meal.macrosPerPortion?.calories || 0), 0
    );
    
    // Calculate daily macro totals
    const dayTotalProtein = day.meals.reduce((sum: number, meal: any) => 
      sum + (meal.macrosPerPortion?.protein_g || 0), 0
    );
    const dayTotalCarbs = day.meals.reduce((sum: number, meal: any) => 
      sum + (meal.macrosPerPortion?.carbs_g || 0), 0
    );
    const dayTotalFat = day.meals.reduce((sum: number, meal: any) => 
      sum + (meal.macrosPerPortion?.fat_g || 0), 0
    );
    
    // Validate daily macro percentages
    const dayValidation = validateMacroPercentages(
      day.totalCalories,
      dayTotalProtein,
      dayTotalCarbs,
      dayTotalFat,
      `Day ${day.dayIndex}`
    );
    
    if (dayValidation.isValid) {
      const proteinCal = dayTotalProtein * 4;
      const carbsCal = dayTotalCarbs * 4;
      const fatCal = dayTotalFat * 9;
      const proteinPct = ((proteinCal / day.totalCalories) * 100).toFixed(1);
      const carbsPct = ((carbsCal / day.totalCalories) * 100).toFixed(1);
      const fatPct = ((fatCal / day.totalCalories) * 100).toFixed(1);
    } else {
      const proteinCal = dayTotalProtein * 4;
      const carbsCal = dayTotalCarbs * 4;
      const fatCal = dayTotalFat * 9;
      const proteinPct = ((proteinCal / day.totalCalories) * 100).toFixed(1);
      const carbsPct = ((carbsCal / day.totalCalories) * 100).toFixed(1);
      const fatPct = ((fatCal / day.totalCalories) * 100).toFixed(1);
    }
    
    // Store daily macro totals for reference
    day.totalMacros = {
      protein_g: Math.round(dayTotalProtein * 10) / 10,
      carbs_g: Math.round(dayTotalCarbs * 10) / 10,
      fat_g: Math.round(dayTotalFat * 10) / 10
    };
    day.macroValidation = dayValidation;
  });

  const duration = Date.now() - startTime;

  return scaled;
}

/**
 * Check if a food ID is a liquid (should use ml instead of g)
 * Oils, sauces, milks, juices, vinegars, stocks = ml
 * Everything else = g
 */
function isLiquidFood(foodId: string, foodsMap: Record<string, Food>): boolean {
  if (!foodId) return false;
  
  // Check food map defaultUnit first
  const food = foodsMap[foodId];
  if (food?.defaultUnit === 'ml') {
    return true;
  }
  
  // List of liquid food IDs (oils, sauces, milks, juices, vinegars, stocks)
  const liquidIds = new Set([
    // Oils (all oils should be ml per user requirement, even if food map says grams)
    'olive_oil', 'extra_virgin_olive_oil', 'coconut_oil', 'sesame_oil', 'sunflower_oil', 
    'rapeseed_oil', 'vegetable_oil', 'canola_oil', 'avocado_oil', 'walnut_oil',
    
    // Milks and milk alternatives
    'almond_milk', 'coconut_milk', 'oat_milk', 'soy_milk', 'rice_milk', 'pea_milk',
    'cashew_milk', 'coconut_oat_drink', 'semi_skimmed_milk', 'skimmed_milk', 'whole_milk',
    
    // Juices
    'orange_juice', 'yuzu_juice',
    
    // Sauces and condiments
    'soy_sauce', 'tamari', 'fish_sauce', 'worcestershire_sauce', 'hot_sauce',
    'hoisin_sauce', 'oyster_sauce', 'mirin', 'bbq_sauce', 'ketchup', 'sriracha',
    
    // Vinegars
    'vinegar', 'balsamic_vinegar', 'white_wine_vinegar', 'rice_vinegar', 'apple_cider_vinegar',
    'black_vinegar',
    
    // Stocks and broths
    'chicken_stock', 'beef_stock', 'vegetable_stock',
    
    // Other liquids
    'water', 'cold_brew', 'green_tea', 'kombucha', 'matcha_latte', 'passata',
    'coconut_cream', 'soy_cream'
  ]);
  
  // Check if exact ID matches
  if (liquidIds.has(foodId)) {
    return true;
  }
  
  // Check if food ID contains liquid patterns (for variations)
  const foodIdLower = foodId.toLowerCase();
  if (foodIdLower.includes('_oil') || 
      foodIdLower.includes('_milk') || 
      foodIdLower.includes('_juice') ||
      foodIdLower.includes('_sauce') ||
      foodIdLower.includes('vinegar') ||
      foodIdLower.includes('_stock') ||
      foodIdLower.includes('_broth') ||
      foodIdLower.endsWith('_drink') ||
      foodIdLower === 'water') {
    return true;
  }
  
  return false;
}

/**
 * STEP 4: Generate recipes for each meal
 * (Second call - uses GPT-4.1-nano for faster response)
 */
async function generateRecipes(
  openai: OpenAI,
  scaledMeals: any,
  foodsMap: Record<string, Food>
): Promise<any> {
  const startTime = Date.now();

  const mealsWithRecipes = {
    days: [] as any[]
  };

  // Process all meals in parallel batches
  for (const day of scaledMeals.days) {
    const dayMeals = await Promise.all(
      day.meals.map(async (meal: any) => {
        // Build ingredients list for prompt (format with correct units)
        // Use ingredientsPerPortion if available (after capping), otherwise fall back to ingredients
        const ingredientsArray = meal.ingredientsPerPortion || meal.ingredients || [];
        const ingredientsList = ingredientsArray
          .map((ing: any) => {
            const foodId = ing.foodId || ing.id;
            const amount = ing.amount || 0;
            // 🔧 FIX: Eggs should always display with "g" unit in recipe prompts
            let unit = ing.unit;
            // Force 'g' for eggs regardless of what's stored
            if (foodId === 'egg' || foodId === 'eggs') {
              unit = 'g'; // Always force 'g' for eggs
            } else if (!unit) {
              unit = isLiquidFood(foodId, foodsMap) ? 'ml' : 'g';
            }
            // Ensure unit is never empty
            if (!unit) unit = 'g';
            return `${foodId}: ${amount}${unit}`;
          })
          .join('\n');

        const recipePrompt = `Generate cooking instructions for this meal:
Meal: ${meal.name}
Cuisine: ${meal.cuisine}
Ingredients (with EXACT portions - use these exact amounts in your instructions):

${ingredientsList}

CRITICAL: Use the EXACT amounts shown above in your recipe instructions. Do not modify or estimate amounts.

Output format:
PREP_TIME: [minutes]
RECIPE_STEPS:

[step]
[step]
[step]

Keep it concise (3-5 steps) and practical.`;

        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4.1-nano',
            max_tokens: 500,
            temperature: 0.7,
            messages: [
              {
                role: 'system',
                content: 'You are a professional chef. Provide clear, concise cooking instructions.'
              },
              {
                role: 'user',
                content: recipePrompt
              }
            ]
          });

          const text = response.choices[0]?.message?.content || '';

          // Parse prep time
          const prepTimeMatch = text.match(/PREP_TIME:\s*(\d+)/i);
          const prepTimeMin = prepTimeMatch ? parseInt(prepTimeMatch[1], 10) : 15;

          // Parse recipe steps
          const stepsSection = text.match(/RECIPE_STEPS:([\s\S]*?)(?=PREP_TIME:|$)/i);
          const recipeSteps: string[] = [];
          if (stepsSection) {
            const stepsText = stepsSection[1].trim();
            const lines = stepsText.split('\n').filter(l => l.trim() && !l.match(/^===/));
            recipeSteps.push(...lines);
          }

          // Validation: Check if recipe mentions ingredient amounts that match ingredient list
          const sourceIngredients = meal.ingredientsPerPortion || meal.ingredients || [];
          const ingredientAmounts: Record<string, number> = {};
          sourceIngredients.forEach((ing: any) => {
            const foodId = ing.foodId || ing.id;
            if (foodId) {
              ingredientAmounts[foodId] = ing.amount || 0;
            }
          });

          // Extract amounts mentioned in recipe text (simple regex for "Xg food_id" or "Xg foodName")
          const recipeTextLower = text.toLowerCase();
          const mismatches: Array<{ foodId: string; ingredientAmount: number; recipeAmount: number | null }> = [];
          
          Object.keys(ingredientAmounts).forEach(foodId => {
            const ingredientAmount = ingredientAmounts[foodId];
            const food = foodsMap[foodId];
            const foodName = food?.displayName?.toLowerCase() || foodId.toLowerCase();
            
            // Try to find amount mentions in recipe (e.g., "300g frozen vegetables" or "300g frozen_vegetables")
            const patterns = [
              new RegExp(`(\\d+)\\s*g\\s*${foodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
              new RegExp(`(\\d+)\\s*g\\s*${foodId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
            ];
            
            let recipeAmount: number | null = null;
            for (const pattern of patterns) {
              const match = recipeTextLower.match(pattern);
              if (match) {
                recipeAmount = parseInt(match[1], 10);
                break;
              }
            }
            
            // Only log mismatch if recipe mentions this ingredient with a specific amount
            if (recipeAmount !== null && recipeAmount !== ingredientAmount) {
              mismatches.push({ foodId, ingredientAmount, recipeAmount });
            }
          });

          // Recipe validation mismatches logged (removed for production)

          // sourceIngredients already declared above for validation - reuse it
          return {
            ...meal,
            prepTimeMin: prepTimeMin,
            recipeSteps: recipeSteps.length > 0 ? recipeSteps : ['Follow standard cooking methods for this dish.'],
            ingredientsPerPortion: sourceIngredients.map((ing: any) => {
              // NO CONVERSIONS: Ingredients are exactly what AI outputs - grams (or ml if AI specified)
              // Conversions only happen in grocery list builder, not here
              const foodId = ing.foodId || ing.id;
              // 🔧 FIX: Eggs should ALWAYS display with "g" unit for consistency (even if food map says "units")
              let unit = ing.unit;
              if (!unit) {
                // If no unit specified, check if it's a liquid or egg
                if (foodId === 'egg' || foodId === 'eggs') {
                  unit = 'g'; // Force 'g' for eggs in display
                } else {
                  unit = isLiquidFood(foodId, foodsMap) ? 'ml' : 'g';
                }
              } else {
                // If unit is specified, use it (but ensure eggs always use 'g')
                if (foodId === 'egg' || foodId === 'eggs') {
                  unit = 'g'; // Override any other unit for eggs
                }
              }
              
              return {
                foodId: foodId,
                amount: ing.amount || 0,
                unit: unit === 'ml' ? 'ml' : 'g' // Only accept 'g' or 'ml' - no conversions
              };
            })
          };
        } catch (error) {
          // Use ingredientsPerPortion if available (after capping), otherwise use ingredients
          const sourceIngredients = meal.ingredientsPerPortion || meal.ingredients || [];
          
          return {
            ...meal,
            prepTimeMin: 15,
            recipeSteps: ['Follow standard cooking methods for this dish.'],
            ingredientsPerPortion: sourceIngredients.map((ing: any) => {
              // NO CONVERSIONS: Ingredients are exactly what AI outputs - grams (or ml if AI specified)
              const foodId = ing.foodId || ing.id;
              // 🔧 FIX: Eggs should ALWAYS display with "g" unit for consistency (even if food map says "units")
              let unit: string;
              if (foodId === 'egg' || foodId === 'eggs') {
                unit = 'g'; // Always use 'g' for eggs, regardless of what's stored
              } else {
                unit = ing.unit || (isLiquidFood(foodId, foodsMap) ? 'ml' : 'g');
              }
              
              return {
                foodId: foodId,
                amount: ing.amount || 0,
                unit: unit === 'ml' ? 'ml' : 'g' // Only accept 'g' or 'ml' - no conversions
              };
            })
          };
        }
      })
    );

    mealsWithRecipes.days.push({
      dayIndex: day.dayIndex,
      label: `Day ${day.dayIndex}`,
      totalCalories: day.totalCalories,
      meals: dayMeals
    });
  }

  const duration = Date.now() - startTime;

  return mealsWithRecipes;
}

/**
 * Apply portion caps and rebalance calories (middleware)
 * Recalculates macros from meal plan ingredients
 */
function applyPortionCapsAndRebalance(
  mealPlan: any,
  mealInputs: {
    dailyCalories: number;
    mealsPerDay: number;
    budgetTier?: string;
  },
  foodsMap: Record<string, Food>
): any {
  const { dailyCalories, mealsPerDay, budgetTier = 'medium' } = mealInputs;
  
  // 🔍 DIAGNOSTIC: Log the received values
  
  const targetCaloriesPerMeal = dailyCalories / mealsPerDay;

  // Calculate meal targets based on mealsPerDay (MATCH AI PROMPT)
  // AI prompt says: 2 meals = 50/50 split
  //                  3 meals = 30-35% each (equal split = 33.33% each)
  //                  4 meals = 30% each for breakfast/lunch/dinner + 10% for snack
  const mealTargets: Record<string, number> = {};
  if (mealsPerDay === 2) {
    // 2 meals: 50/50 split
    const half = Math.round(dailyCalories / 2);
    mealTargets.breakfast = half;
    mealTargets.lunch = dailyCalories - half; // Ensures sum equals dailyCalories exactly
  } else if (mealsPerDay === 4) {
    // 4 meals: 30% each for breakfast/lunch/dinner, 10% for snack
    mealTargets.breakfast = Math.round(dailyCalories * 0.30);
    mealTargets.lunch = Math.round(dailyCalories * 0.30);
    mealTargets.dinner = Math.round(dailyCalories * 0.30);
    mealTargets.snack = Math.round(dailyCalories * 0.10);
  } else if (mealsPerDay === 3) {
    // 3 meals: Equal split (33.33% each, with rounding: 33%, 33%, 34%)
    const oneThird = Math.round(dailyCalories / 3);
    mealTargets.breakfast = oneThird;
    mealTargets.lunch = oneThird;
    mealTargets.dinner = dailyCalories - (oneThird * 2); // Ensures sum equals dailyCalories exactly
  }

  // Helper to get ingredient category for rebalancing
  function getIngredientCategory(foodId: string): {
    type: 'vegetable' | 'frozen_veg' | 'leafy_greens' | 'aromatics' | 'cooked_grain' | 'oats' | 'potato' | 'cooked_legumes' | 'tofu' | 'chicken_meat' | 'mince' | 'eggs' | 'olive_oil' | 'cheese' | 'other';
    isVegetable: boolean;
  } {
    const food = foodsMap[foodId] || foodsMap[resolveToLeanId(foodId) || ''];
    if (!food) return { type: 'other', isVegetable: false };

    const id = foodId.toLowerCase();
    const displayName = (food.displayName || '').toLowerCase();
    const category = (food.category || '').toLowerCase();

    // Aromatics (garlic/ginger)
    if (id === 'garlic' || id === 'ginger' || displayName.includes('garlic') || displayName.includes('ginger')) {
      return { type: 'aromatics', isVegetable: false };
    }

    // Olive oil
    if (id.includes('olive_oil') || id === 'olive_oil' || displayName.includes('olive oil')) {
      return { type: 'olive_oil', isVegetable: false };
    }

    // Eggs
    if (id === 'egg' || id === 'eggs' || displayName.includes('egg')) {
      return { type: 'eggs', isVegetable: false };
    }

    // Oats
    if (id.includes('oat') && !id.includes('milk') && !id.includes('drink')) {
      return { type: 'oats', isVegetable: false };
    }

    // Frozen mixed veg
    if (id.includes('frozen') && (id.includes('veg') || id.includes('vegetable') || id.includes('mixed'))) {
      return { type: 'frozen_veg', isVegetable: true };
    }

    // Leafy greens
    if (displayName.includes('spinach') || displayName.includes('kale') || displayName.includes('lettuce') || 
        displayName.includes('arugula') || displayName.includes('rocket') || displayName.includes('chard') ||
        id.includes('spinach') || id.includes('kale') || id.includes('lettuce')) {
      return { type: 'leafy_greens', isVegetable: true };
    }

    // Potatoes/sweet potato
    if (id.includes('potato') || displayName.includes('potato')) {
      return { type: 'potato', isVegetable: false };
    }

    // Cooked rice/pasta/grains
    if (id.includes('rice_cooked') || id.includes('pasta_cooked') || id.includes('quinoa_cooked') || 
        id.includes('bulgur_cooked') || id.includes('couscous_cooked') || 
        (displayName.includes('cooked') && (displayName.includes('rice') || displayName.includes('pasta') || displayName.includes('grain')))) {
      return { type: 'cooked_grain', isVegetable: false };
    }

    // Cooked legumes
    if ((id.includes('lentils_cooked') || id.includes('chickpeas_cooked') || id.includes('beans_cooked') ||
         displayName.includes('lentils') || displayName.includes('chickpeas') || displayName.includes('beans')) &&
        (id.includes('cooked') || displayName.includes('cooked'))) {
      return { type: 'cooked_legumes', isVegetable: false };
    }

    // Tofu
    if (id === 'tofu' || displayName.includes('tofu')) {
      return { type: 'tofu', isVegetable: false };
    }

    // Chicken/meat (raw)
    if (category === 'protein' && (id.includes('chicken') || id.includes('beef') || id.includes('pork') || 
        id.includes('lamb') || id.includes('turkey') || displayName.includes('chicken') || displayName.includes('beef'))) {
      if (id.includes('mince') || displayName.includes('mince') || displayName.includes('ground')) {
        return { type: 'mince', isVegetable: false };
      }
      return { type: 'chicken_meat', isVegetable: false };
    }

    // Vegetables (non-starchy, non-leafy)
    if (category === 'vegetable' || category === 'vegetables') {
      return { type: 'vegetable', isVegetable: true };
    }

    return { type: 'other', isVegetable: false };
  }

  // Process meals: recalculate macros and rebalance if needed
  let processedMealPlan = {
    days: mealPlan.days.map((day: any) => ({
      ...day,
      meals: day.meals.map((meal: any) => {
        // Convert ingredients to ingredientsPerPortion if needed (from scalePortionsToTargets)
        let sourceIngredients = meal.ingredientsPerPortion || meal.ingredients || [];
        if (!Array.isArray(sourceIngredients) || sourceIngredients.length === 0) {
          return meal;
        }

        // Convert from {id, amount} to {foodId, amount, unit} format if needed
        let ingredients = sourceIngredients.map((ing: any) => {
          const foodId = ing.foodId || ing.id;
          const amount = ing.amount || 0;
          const unit = ing.unit || (isLiquidFood(foodId, foodsMap) ? 'ml' : 'g');
          
          return {
            foodId: foodId,
            amount: amount,
            unit: unit
          };
        });

        // RECALCULATE MACROS
        let calories = 0;
        let protein = 0;
        let carbs = 0;
        let fat = 0;
        const skippedInRebalance: any[] = [];

        ingredients.forEach((ing: any) => {
          const food = foodsMap[ing.foodId] || foodsMap[resolveToLeanId(ing.foodId) || ''];
          if (food && food.macrosPer100) {
            // ✅ FIX: Handle units vs grams correctly
            const multiplier = calculateMacroMultiplier(food, ing.amount, ing.unit);
            const ingCalories = food.macrosPer100.calories * multiplier;
            const ingProtein = food.macrosPer100.protein_g * multiplier;
            const ingCarbs = food.macrosPer100.carbs_g * multiplier;
            const ingFat = food.macrosPer100.fat_g * multiplier;
            
            calories += ingCalories;
            protein += ingProtein;
            carbs += ingCarbs;
            fat += ingFat;
          } else {
            skippedInRebalance.push(ing);
            void resolveToLeanId(ing.foodId);
          }
        });

        calories = Math.round(calories);
        protein = Math.round(protein * 10) / 10;
        carbs = Math.round(carbs * 10) / 10;
        fat = Math.round(fat * 10) / 10;
        
        // 🔍 VALIDATION: Check for suspiciously low calories
        const minCaloriesPerMeal = 200;
        const maxCaloriesPerMeal = 1200;
        const mealTarget = mealTargets[meal.mealType] || mealTargets['breakfast'] || targetCaloriesPerMeal;

        // REBALANCE CALORIES if below target (compensate for rounding losses)
        // Use actual mealTarget, not minTarget - we want to hit targets, not just avoid being too low
        
        // Rebalance if calories are below target (allow up to 2% tolerance for rounding)
        const targetTolerance = mealTarget * 0.98; // 2% tolerance
        if (calories < targetTolerance) {
          const deficit = mealTarget - calories;
          let remainingDeficit = deficit;

          // Priority order: carbs > protein > oil (never vegetables)
          // Increase carbs (rice/potatoes/oats)
          const carbIngredients = ingredients.filter((ing: any) => {
            const cat = getIngredientCategory(ing.foodId);
            return cat.type === 'cooked_grain' || cat.type === 'oats' || cat.type === 'potato';
          });

          for (const ing of carbIngredients) {
            if (remainingDeficit <= 0) break;
            const food = foodsMap[ing.foodId] || foodsMap[resolveToLeanId(ing.foodId) || ''];
            if (!food || !food.macrosPer100) continue;

            const current = ing.amount;
            const increment = getIngredientCategory(ing.foodId).type === 'oats' ? 10 : 25;
            let newAmount = current + increment;
            
            // 🔧 FIX: Eggs must always be whole units (60g minimum, rounded to nearest 60g)
            if (ing.foodId === 'egg' || ing.foodId === 'eggs') {
              newAmount = Math.round(newAmount / 60) * 60;
              if (newAmount === 0) newAmount = 60; // Ensure at least 1 egg
              const actualIncrement = newAmount - current;
              const addedCalories = (actualIncrement / 100) * food.macrosPer100.calories;
              ing.amount = newAmount;
              remainingDeficit -= addedCalories;
              calories += addedCalories;
            } else {
              const addedCalories = (increment / 100) * food.macrosPer100.calories;
              ing.amount = newAmount;
              remainingDeficit -= addedCalories;
              calories += addedCalories;
            }
          }

          // Increase protein (chicken/mince/tofu/legumes/eggs)
          if (remainingDeficit > 0) {
            const proteinIngredients = ingredients.filter((ing: any) => {
              const cat = getIngredientCategory(ing.foodId);
              return cat.type === 'chicken_meat' || cat.type === 'mince' || cat.type === 'tofu' || 
                     cat.type === 'cooked_legumes' || cat.type === 'eggs';
            });

            for (const ing of proteinIngredients) {
              if (remainingDeficit <= 0) break;
              const food = foodsMap[ing.foodId] || foodsMap[resolveToLeanId(ing.foodId) || ''];
              if (!food || !food.macrosPer100) continue;

              const current = ing.amount;
              let increment = 20;
              let newAmount = current + increment;
              
              // 🔧 FIX: Eggs must always be whole units (60g minimum, rounded to nearest 60g)
              if (ing.foodId === 'egg' || ing.foodId === 'eggs') {
                newAmount = Math.round(newAmount / 60) * 60;
                if (newAmount === 0) newAmount = 60; // Ensure at least 1 egg
                if (newAmount <= current) newAmount = current + 60; // Add at least 1 whole egg
                increment = newAmount - current;
              }
              
              const addedCalories = (increment / 100) * food.macrosPer100.calories;
              ing.amount = newAmount;
              remainingDeficit -= addedCalories;
              calories += addedCalories;
            }
          }

          // Increase oil (5ml increments, max 15ml for medium/high, 10ml for low)
          if (remainingDeficit > 0) {
            const oilLimit = budgetTier === 'low' ? 10 : 15;
            const oilIngredients = ingredients.filter((ing: any) => {
              const cat = getIngredientCategory(ing.foodId);
              return cat.type === 'olive_oil';
            });

            for (const ing of oilIngredients) {
              if (remainingDeficit <= 0) break;
              const food = foodsMap[ing.foodId] || foodsMap[resolveToLeanId(ing.foodId) || ''];
              if (!food || !food.macrosPer100) continue;

              const current = ing.amount;
              const newAmount = Math.min(oilLimit, current + 5);
              
              if (newAmount > current) {
                const addedCalories = ((newAmount - current) / 100) * food.macrosPer100.calories;
                ing.amount = newAmount;
                remainingDeficit -= addedCalories;
                calories += addedCalories;
              }
            }
          }

          // Recalculate macros after rebalancing
          calories = 0;
          protein = 0;
          carbs = 0;
          fat = 0;

          ingredients.forEach((ing: any) => {
            const food = foodsMap[ing.foodId] || foodsMap[resolveToLeanId(ing.foodId) || ''];
            if (food && food.macrosPer100) {
              // ✅ FIX: Handle units vs grams correctly
              const multiplier = calculateMacroMultiplier(food, ing.amount, ing.unit);
              calories += food.macrosPer100.calories * multiplier;
              protein += food.macrosPer100.protein_g * multiplier;
              carbs += food.macrosPer100.carbs_g * multiplier;
              fat += food.macrosPer100.fat_g * multiplier;
            }
          });

          calories = Math.round(calories);
          protein = Math.round(protein * 10) / 10;
          carbs = Math.round(carbs * 10) / 10;
          fat = Math.round(fat * 10) / 10;
        }

        // Update meal with macros
        return {
          ...meal,
          ingredientsPerPortion: ingredients,
          macrosPerPortion: {
            calories,
            protein_g: protein,
            carbs_g: carbs,
            fat_g: fat
          }
        };
      })
    }))
  };

  // Calculate and log daily totals
    processedMealPlan.days.forEach((day: any) => {
    const dayTotal = day.meals.reduce((sum: number, meal: any) => 
      sum + (meal.macrosPerPortion?.calories || 0), 0
    );
    day.totalCalories = dayTotal;
    
    if (Math.abs(dayTotal - dailyCalories) > 50) {
    }
  });

  // CROSS-DAY REBALANCING: Create balance of deficits/surpluses to hit weekly target
  const dayTotals = processedMealPlan.days.map((day: any) => ({
    dayIndex: day.dayIndex,
    total: day.totalCalories,
    target: dailyCalories,
    diff: day.totalCalories - dailyCalories,
    day
  }));

  const totalCalories = dayTotals.reduce((sum, day) => sum + day.total, 0);
  const targetTotal = dailyCalories * processedMealPlan.days.length;
  const weeklyDeficit = targetTotal - totalCalories;
  
  // 🔍 DIAGNOSTIC: Log the cross-day analysis

  // If weekly total is short (more than 50 calories per day average), redistribute
  // Lower threshold to catch smaller deficits and ensure balance
  const deficitPerDay = weeklyDeficit / processedMealPlan.days.length;
  if (weeklyDeficit > 50 || deficitPerDay > 50) {
    // Strategy: Create a mix of surpluses and deficits
    // Add MORE calories to some days (creating surpluses) and fewer to others (keeping deficits)
    // This creates natural variation while balancing the weekly total
    
    const days = processedMealPlan.days.length;
    const avgDeficitPerDay = weeklyDeficit / days;
    
    // Calculate how many days should have surpluses vs deficits
    // Target: ~50% days with surpluses, 50% at target or small deficit
    // Strategy: Add ALL the deficit calories to some days (creating surpluses), 
    //           so other days stay at their current levels (which are already deficits)
    const surplusDays = Math.ceil(days * 0.5); // 50% of days get surpluses
    const caloriesPerSurplusDay = Math.ceil(weeklyDeficit / surplusDays); // All deficit goes to surplus days
    

    // Helper function to add calories to a day
    const addCaloriesToDay = (day: any, targetAdd: number): number => {
      let addedCalories = 0;

      // Add calories to meals that are below target
      day.meals.forEach((meal: any) => {
        if (!meal.ingredientsPerPortion || addedCalories >= targetAdd) return;

        const mealTarget = mealTargets[meal.mealType] || mealTargets['breakfast'] || targetCaloriesPerMeal;
        const mealCalories = meal.macrosPerPortion?.calories || 0;
        const mealDeficit = mealTarget - mealCalories;
        const remainingToAdd = targetAdd - addedCalories;

        if (remainingToAdd > 0) {
          // Increase carbs first
          const carbIngredients = meal.ingredientsPerPortion.filter((ing: any) => {
                  const cat = getIngredientCategory(ing.foodId);
                  return cat.type === 'cooked_grain' || cat.type === 'oats' || cat.type === 'potato';
                });

                for (const ing of carbIngredients) {
            if (addedCalories >= targetAdd) break;
                  const food = foodsMap[ing.foodId] || foodsMap[resolveToLeanId(ing.foodId) || ''];
                  if (!food || !food.macrosPer100) continue;

            const increment = getIngredientCategory(ing.foodId).type === 'oats' ? 10 : 25;
            const addedCal = (increment / 100) * food.macrosPer100.calories;
            
            if (addedCalories + addedCal <= targetAdd * 1.3) { // Allow slight over
              ing.amount += increment;
              addedCalories += addedCal;
            }
          }

          // If still need more, increase protein
          if (addedCalories < targetAdd) {
            const proteinIngredients = meal.ingredientsPerPortion.filter((ing: any) => {
                    const cat = getIngredientCategory(ing.foodId);
              return cat.type === 'chicken_meat' || cat.type === 'mince' || cat.type === 'tofu' || 
                     cat.type === 'cooked_legumes' || cat.type === 'eggs';
                  });

            for (const ing of proteinIngredients) {
              if (addedCalories >= targetAdd) break;
                    const food = foodsMap[ing.foodId] || foodsMap[resolveToLeanId(ing.foodId) || ''];
                    if (!food || !food.macrosPer100) continue;

              let increment = 20;
              
              // 🔧 FIX: Eggs must always be whole units (60g minimum)
              if (ing.foodId === 'egg' || ing.foodId === 'eggs') {
                const current = ing.amount;
                let newAmount = Math.round((current + increment) / 60) * 60;
                if (newAmount === 0) newAmount = 60;
                if (newAmount <= current) newAmount = current + 60; // Add at least 1 whole egg
                increment = newAmount - current;
              }
              
              const addedCal = (increment / 100) * food.macrosPer100.calories;
              
              if (addedCalories + addedCal <= targetAdd * 1.3) {
                ing.amount += increment;
                addedCalories += addedCal;
              }
            }
          }
        }
      });

      return addedCalories;
    };

    // Recalculate meal macros helper
    const recalculateDayMacros = (day: any) => {
      day.meals.forEach((meal: any) => {
        if (!meal.ingredientsPerPortion) return;

        let calories = 0;
        let protein = 0;
        let carbs = 0;
        let fat = 0;

        meal.ingredientsPerPortion.forEach((ing: any) => {
                  const food = foodsMap[ing.foodId] || foodsMap[resolveToLeanId(ing.foodId) || ''];
                  if (food && food.macrosPer100) {
                    // ✅ FIX: Handle units vs grams correctly
                    const multiplier = calculateMacroMultiplier(food, ing.amount, ing.unit);
                    calories += food.macrosPer100.calories * multiplier;
                    protein += food.macrosPer100.protein_g * multiplier;
                    carbs += food.macrosPer100.carbs_g * multiplier;
                    fat += food.macrosPer100.fat_g * multiplier;
                  }
                });

        meal.macrosPerPortion = {
          calories: Math.round(calories),
          protein_g: Math.round(protein * 10) / 10,
          carbs_g: Math.round(carbs * 10) / 10,
          fat_g: Math.round(fat * 10) / 10
        };
      });

      day.totalCalories = day.meals.reduce((sum: number, meal: any) => 
        sum + (meal.macrosPerPortion?.calories || 0), 0
      );
    };

    // Apply strategy: Add calories to some days (creating surpluses), leave others as-is
    // This creates a mix: some days over target, some days under, but weekly total balanced
    processedMealPlan.days.forEach((day: any, index: number) => {
      if (index < surplusDays) {
        // First half of days get ALL the deficit calories (creating surpluses)
        const targetAdd = caloriesPerSurplusDay;
        addCaloriesToDay(day, targetAdd);
        recalculateDayMacros(day);
      } else {
        // Remaining days stay as-is (they're already at deficit, which creates the balance)
        recalculateDayMacros(day); // Just recalc to ensure macros are accurate
      }
    });

    // Log final totals
    const finalTotal = processedMealPlan.days.reduce((sum: number, day: any) => 
      sum + (day.totalCalories || 0), 0
    );
    const finalDiff = finalTotal - targetTotal;
    
    const finalDayDiffs = processedMealPlan.days.map((day: any) => ({
      day: day.dayIndex,
      total: day.totalCalories,
      diff: day.totalCalories - dailyCalories
    }));
    
    const daysOver = finalDayDiffs.filter(d => d.diff > 50);
    const daysUnder = finalDayDiffs.filter(d => d.diff < -50);
    
  } else {
    // Log if weekly total is close but individual days vary
    const daysUnder = dayTotals.filter(day => day.diff < -50);
    const daysOver = dayTotals.filter(day => day.diff > 50);
    
    if (daysUnder.length > 0 || daysOver.length > 0) {
    }
  }

  return processedMealPlan;
}

/**
 * Validate ingredient caps are not exceeded
 * Checks that the AI didn't exceed the weekly ingredient caps
 */
function validateIngredientCaps(
  parsedMeals: any,
  budgetTier: string,
  foodsMap: Record<string, Food>
): { isValid: boolean; violations: string[] } {
  
  if (!parsedMeals || !parsedMeals.days || !Array.isArray(parsedMeals.days)) {
    return { isValid: false, violations: ['Invalid meal plan structure'] };
  }
  
  const budgetConfig = {
    low: { proteins: 6, carbs: 5, vegetables: 10, fruit: 3, sauces: 5 }, // 5-6 proteins, 4-5 carbs, 8-10 veg (using max values)
    medium: { proteins: 7, carbs: 6, vegetables: 12, fruit: 4, sauces: 6 }, // 6-7 proteins, 5-6 carbs, 10-12 veg (using max values)
    high: { proteins: 8, carbs: 7, vegetables: 15, fruit: 6, sauces: 8 } // 7-8 proteins, 6-7 carbs, 12+ veg (using 15 as max)
  };
  const budget = budgetConfig[budgetTier as keyof typeof budgetConfig] || budgetConfig.medium;
  
  // Collect unique ingredients by category
  const uniqueIngredients = {
    proteins: new Set<string>(),
    carbs: new Set<string>(),
    vegetables: new Set<string>(),
    fruit: new Set<string>(),
    sauces: new Set<string>()
  };
  
  // Helper to categorize food
  function categorizeFood(foodId: string): 'proteins' | 'carbs' | 'vegetables' | 'fruit' | 'sauces' | null {
    const food = foodsMap[foodId];
    if (!food) return null;
    
    const category = food.category?.toLowerCase() || '';
    const displayName = food.displayName?.toLowerCase() || '';
    
    // Proteins
    if (category === 'protein' || category === 'proteins') {
      return 'proteins';
    }
    
    // Carbs
    if (category === 'carb' || category === 'carbs' || category === 'carbohydrate' || category === 'carbohydrates') {
      return 'carbs';
    }
    
    // Vegetables
    if (category === 'vegetable' || category === 'vegetables') {
      return 'vegetables';
    }
    
    // Fruit
    if (category === 'fruit' || category === 'fruits') {
      return 'fruit';
    }
    
    // Sauces/Extras (oils, condiments, spices, etc.)
    if (category === 'fat' || category === 'fats' || 
        displayName.includes('oil') || 
        displayName.includes('sauce') || 
        displayName.includes('vinegar') || 
        displayName.includes('honey') || 
        displayName.includes('syrup') ||
        displayName.includes('butter') ||
        displayName.includes('spice') ||
        displayName.includes('herb')) {
      return 'sauces';
    }
    
    return null;
  }
  
  // Collect all unique ingredients from all meals
  parsedMeals.days.forEach((day: any) => {
    if (!day.meals || !Array.isArray(day.meals)) return;
    
    day.meals.forEach((meal: any) => {
      if (!meal.ingredients || !Array.isArray(meal.ingredients)) return;
      
      meal.ingredients.forEach((ing: any) => {
        const foodId = ing.id || ing.foodId;
        if (!foodId) return;
        
        const resolvedId = resolveToLeanId(foodId);
        if (!resolvedId) return;
        
        const category = categorizeFood(resolvedId);
        if (category) {
          uniqueIngredients[category].add(resolvedId);
        }
      });
    });
  });
  
  // Check violations
  const violations: string[] = [];
  
  if (uniqueIngredients.proteins.size > budget.proteins) {
    violations.push(`Proteins: ${uniqueIngredients.proteins.size} unique (max: ${budget.proteins})`);
  }
  if (uniqueIngredients.carbs.size > budget.carbs) {
    violations.push(`Carbs: ${uniqueIngredients.carbs.size} unique (max: ${budget.carbs})`);
  }
  if (uniqueIngredients.vegetables.size > budget.vegetables) {
    violations.push(`Vegetables: ${uniqueIngredients.vegetables.size} unique (max: ${budget.vegetables})`);
  }
  if (uniqueIngredients.fruit.size > budget.fruit) {
    violations.push(`Fruit: ${uniqueIngredients.fruit.size} unique (max: ${budget.fruit})`);
  }
  if (uniqueIngredients.sauces.size > budget.sauces) {
    violations.push(`Sauces/Extras: ${uniqueIngredients.sauces.size} unique (max: ${budget.sauces})`);
  }
  
  // Log results
  if (violations.length > 0) {
    const violationsList = violations.join(', ');
  }
  
  return {
    isValid: violations.length === 0,
    violations
  };
}

/**
 * Validate grocery list alignment with meal plan ingredients
 * Checks that all meal plan ingredients are represented in the grocery list
 */
function validateGroceryListAlignment(
  planDays: any[],
  groceryList: any,
  foodsMap: Record<string, Food>
): void {
  // Step 1: Collect all ingredients from meal plan
  const mealPlanIngredients = new Map<string, number>(); // foodId -> total grams
  
  planDays.forEach((day: any) => {
    if (!day.meals || !Array.isArray(day.meals)) return;
    
    day.meals.forEach((meal: any) => {
      if (!meal.ingredientsPerPortion || !Array.isArray(meal.ingredientsPerPortion)) return;
      
      meal.ingredientsPerPortion.forEach((ing: any) => {
        const foodId = ing.foodId || ing.id;
        if (!foodId) return;
        
        const resolvedId = resolveToLeanId(foodId);
        if (!resolvedId) return;
        
        const amount = ing.amount || 0;
        if (amount > 0) {
          const current = mealPlanIngredients.get(resolvedId) || 0;
          mealPlanIngredients.set(resolvedId, current + amount);
        }
      });
    });
  });
  
  // Step 2: Collect all items from grocery list using ID-based mapping only
  const groceryListItems = new Map<string, string>(); // foodId -> display name
  
  if (groceryList.grocerySections && Array.isArray(groceryList.grocerySections)) {
    groceryList.grocerySections.forEach((section: any) => {
      if (!section.items || !Array.isArray(section.items)) return;
      
      section.items.forEach((item: any) => {
        // Use foodId directly from item - no reverse lookup by display name
        const foodId = item.foodId;
        if (!foodId) {
          return;
        }
        
        // Resolve foodId to handle aliases/variations
        const resolvedId = resolveToLeanId(foodId);
          if (resolvedId) {
          const displayName = item.name || foodId;
          groceryListItems.set(resolvedId, displayName);
        } else {
        }
      });
    });
  }
  
  // Step 3: Compare - find missing ingredients
  const missingInGrocery: Array<{ foodId: string; displayName: string; totalGrams: number }> = [];
  
  mealPlanIngredients.forEach((totalGrams: number, foodId: string) => {
    if (!groceryListItems.has(foodId)) {
      const food = foodsMap[foodId];
      const displayName = food?.displayName || foodId;
      missingInGrocery.push({ foodId, displayName, totalGrams });
    }
  });
  
  // Step 4: Report results with ALL missing items listed
  if (missingInGrocery.length > 0) {
    const missingItemsList = missingInGrocery.map(({ displayName, totalGrams }) => 
      `${displayName} (${totalGrams.toFixed(0)}g)`
    ).join(', ');
  }
  
  // Also check for extra items in grocery list (list ALL items)
  const extraInGrocery: Array<{ foodId: string; displayName: string }> = [];
  groceryListItems.forEach((displayName: string, foodId: string) => {
    if (!mealPlanIngredients.has(foodId)) {
      extraInGrocery.push({ foodId, displayName });
    }
  });
  
  if (extraInGrocery.length > 0) {
    const extraItemsList = extraInGrocery.map(({ displayName }) => displayName).join(', ');
  }
}

// ============================================================================
// OLD FUNCTIONS (kept for reference but not used in new 2-call system)
// ============================================================================
// The following functions are legacy and not used by the new meal generation:
// - buildLightweightFoodIndex (replaced by foodsLightweight.json)
// - parseStructuredMealPlan (replaced by parseMealConcepts)
// - MEAL_SYSTEM_PROMPT (removed - replaced by generateMealConcepts prompt)
// ============================================================================

// Legacy prompt removed - see generateMealConcepts() for new prompt

// ============================================================================
// STEP 2: CODE MIDDLEWARE FUNCTIONS
// ============================================================================
// Removed unused functions: buildLightweightFoodIndex, buildFoodListForPrompt, buildFilteredFoodList
// (replaced by foodsLightweight.json import)

/**
 * Parse structured meal plan text to JSON
 * Handles format with ===DAY X===, ===MEAL X=== delimiters
 */
function parseStructuredMealPlan(text: string, expectedDays: number, mealsPerDay: number, dietStyle: string, dailyCaloriesTarget: number): any {
  const plan: any = {
    plan_name: '',
    generated_at: new Date().toISOString(),
    dietStyle: dietStyle,
    dailyCaloriesTarget: dailyCaloriesTarget,
    mealsPerDay: mealsPerDay,
    days: []
  };

  // Extract plan metadata
  const planNameMatch = text.match(/PLAN_NAME:\s*(.+)/i);
  if (planNameMatch) {
    plan.plan_name = planNameMatch[1].trim();
  }

  // Split by day delimiters - improved regex to capture all days including last
  // First, find all day markers
  const dayMarkerRegex = /===DAY\s+(\d+)===/gi;
  const dayMarkers: Array<{ number: number; index: number }> = [];
  let match;
  while ((match = dayMarkerRegex.exec(text)) !== null) {
    dayMarkers.push({
      number: parseInt(match[1], 10),
      index: match.index
    });
  }
  
  if (dayMarkers.length === 0) {
    throw new Error('No days found in meal plan text. Expected format: ===DAY 1===, ===DAY 2===, etc.');
  }
  
  
  // Extract day blocks
  const dayBlocks: Array<{ number: number; content: string }> = [];
  for (let i = 0; i < dayMarkers.length; i++) {
    const startIndex = dayMarkers[i].index;
    const endIndex = i < dayMarkers.length - 1 ? dayMarkers[i + 1].index : text.length;
    const content = text.substring(startIndex, endIndex);
    dayBlocks.push({
      number: dayMarkers[i].number,
      content: content
    });
  }

  dayBlocks.forEach((dayBlock, index) => {
    const dayNumber = dayBlock.number;
    const dayLabelMatch = dayBlock.content.match(/DAY_LABEL:\s*(.+)/i);
    const dayLabel = dayLabelMatch ? dayLabelMatch[1].trim() : `Day ${dayNumber}`;

    const day: any = {
      dayIndex: dayNumber,
      label: dayLabel,
      totalCalories: 0,
      meals: []
    };

    // Split by meal delimiters - improved to capture all meals including last one
    // First find all meal markers in this day block
    const mealMarkerRegex = /===MEAL\s+(\d+)===/gi;
    const mealMarkers: Array<{ number: number; index: number }> = [];
    let mealMatch;
    while ((mealMatch = mealMarkerRegex.exec(dayBlock.content)) !== null) {
      mealMarkers.push({
        number: parseInt(mealMatch[1], 10),
        index: mealMatch.index
      });
    }
    
    
    if (mealMarkers.length > 0) {
      // Extract meal blocks
      const mealBlocks: Array<{ number: number; content: string }> = [];
      for (let i = 0; i < mealMarkers.length; i++) {
        const startIndex = mealMarkers[i].index;
        const endIndex = i < mealMarkers.length - 1 ? mealMarkers[i + 1].index : dayBlock.content.length;
        const content = dayBlock.content.substring(startIndex, endIndex);
        mealBlocks.push({
          number: mealMarkers[i].number,
          content: content
        });
      }
      
      mealBlocks.forEach((mealBlockObj) => {
        // Ensure we have a string content
        if (typeof mealBlockObj !== 'object' || typeof mealBlockObj.content !== 'string') {
          return;
        }
        
        const mealBlock = mealBlockObj.content;
        const meal: any = {
          mealType: '',
          name: '',
          prepTimeMin: 0,
          ingredientsPerPortion: [],
          recipeSteps: [],
          macrosPerPortion: {
            calories: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0
          }
        };

        // Extract meal type
        const mealTypeMatch = mealBlock.match(/MEAL_TYPE:\s*(.+)/i);
        if (mealTypeMatch) {
          meal.mealType = mealTypeMatch[1].trim().toLowerCase();
        }

        // Extract name
        const nameMatch = mealBlock.match(/NAME:\s*(.+)/i);
        if (nameMatch) {
          meal.name = nameMatch[1].trim();
        }

        // Extract prep time
        const prepTimeMatch = mealBlock.match(/PREP_TIME:\s*(\d+)/i);
        if (prepTimeMatch) {
          meal.prepTimeMin = parseInt(prepTimeMatch[1], 10);
        }

        // Extract ingredients - more flexible parsing
        const ingredientsSection = mealBlock.match(/INGREDIENTS:([\s\S]*?)(RECIPE:|===MEAL\s+\d+===|===DAY\s+\d+===|===MEAL_PLAN_END===|$)/i);
        if (ingredientsSection) {
          const ingredientsText = ingredientsSection[1].trim();
          const ingredientLines = ingredientsText.split('\n').filter(line => {
            const trimmed = line.trim();
            // Skip empty lines and delimiters
            return trimmed && !trimmed.match(/^===/) && !trimmed.match(/^RECIPE:/i);
          });
          
          ingredientLines.forEach(line => {
            const trimmed = line.trim();
            // More flexible matching:
            // - "Food Name: 200g"
            // - "Food Name:200g"
            // - "Food Name: 200 g"
            // - "Food Name: 200"
            // - "- Food Name: 200g" (with bullet)
            const cleanedLine = trimmed.replace(/^[-•*]\s*/, ''); // Remove bullet points
            const ingredientMatch = cleanedLine.match(/^(.+?):\s*(\d+(?:\.\d+)?)\s*(g|grams?|ml|milliliters?|kg|kilograms?)?$/i);
            if (ingredientMatch) {
              const foodName = ingredientMatch[1].trim();
              let amount = parseFloat(ingredientMatch[2]);
              let unit = (ingredientMatch[3] || 'g').toLowerCase().replace(/s$/, ''); // Normalize
              
              if (unit === 'kg' || unit === 'kilogram') {
                unit = 'g';
                amount = amount * 1000; // Convert kg to g
              }
              
              const foodId = lookupFoodId(foodName);
              
              meal.ingredientsPerPortion.push({
                foodName: foodName,
                foodId: foodId || null, // Include foodId if found
                amount: amount,
                unit: unit === 'ml' ? 'ml' : 'g'
              });
            } else {
              // Try alternative format: "200g Food Name" or "200 g Food Name"
              const altMatch = cleanedLine.match(/^(\d+(?:\.\d+)?)\s*(g|grams?|ml|milliliters?|kg|kilograms?)?\s+(.+)$/i);
              if (altMatch) {
                let amount = parseFloat(altMatch[1]);
                let unit = (altMatch[2] || 'g').toLowerCase().replace(/s$/, '');
                const foodName = altMatch[3].trim();
                if (unit === 'kg' || unit === 'kilogram') {
                  unit = 'g';
                  amount = amount * 1000;
                }
                
                meal.ingredientsPerPortion.push({
                  foodName: foodName,
                  amount: amount,
                  unit: unit === 'ml' ? 'ml' : 'g'
                });
              }
            }
          });
        }
        

        // Extract recipe steps
        const recipeSection = mealBlock.match(/RECIPE:([\s\S]*?)(?===MEAL\s+\d+===|===DAY\s+\d+===|===MEAL_PLAN_END===|$)/i);
        if (recipeSection) {
          const recipeText = recipeSection[1].trim();
          const recipeLines = recipeText.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.match(/^===/) && !trimmed.match(/^INGREDIENTS:/i);
          });
          
          recipeLines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.match(/^===/)) {
              meal.recipeSteps.push(trimmed);
            }
          });
        }

        if (meal.name && meal.mealType) {
          day.meals.push(meal);
        } else {
        }
      });
    } else {
    }
    

    if (day.meals.length > 0) {
      plan.days.push(day);
    }
  });

  // Validate day count
  if (plan.days.length !== expectedDays) {
    if (plan.days.length < expectedDays) {
      throw new Error(`Insufficient days generated: got ${plan.days.length}, expected ${expectedDays}. The AI may have stopped early.`);
    }
    // Truncate if too many
    if (plan.days.length > expectedDays) {
      plan.days = plan.days.slice(0, expectedDays);
    }
  }

  return plan;
}

/**
 * Lookup food ID from food name (displayName)
 * Handles variations and fuzzy matching using resolveToLeanId
 */
function lookupFoodId(foodName: string): string | null {
  if (!foodName) return null;
  const trimmed = foodName.trim();
  if (!trimmed) return null;
  
  // Normalize input: remove brackets, extra spaces, etc.
  const normalized = trimmed
    .replace(/\[.*?\]/g, '') // Remove [vegan], [vegetarian] tags
    .replace(/\(.*?\)/g, '') // Remove (cooked), (raw) tags
    .trim()
    .toLowerCase();
  
  if (!normalized) return null;
  
  // STEP 1: Try exact ID match first (e.g., "almond_butter", "chickpeas")
  const idFromName = normalized.replace(/\s+/g, '_');
  if (FOODS_BY_ID_LEAN[idFromName]) return idFromName;
  
  try {
    const resolved = resolveToLeanId(trimmed);
    if (resolved && FOODS_BY_ID_LEAN[resolved]) return resolved;
  } catch {
    // resolveToLeanId may throw, continue to fallback
  }
  
  for (const food of FOODS_DATA_LEAN) {
    const displayLower = food.displayName.toLowerCase();
    if (displayLower === normalized) return food.id;
  }
  
  // STEP 4: Try word-boundary matching (prevent "almond butter" matching "butter")
  // Only match if the input is a complete word/phrase within the food name
  const inputWords = normalized.split(/\s+/).filter(w => w.length > 0);
  let bestMatch: { food: Food; score: number } | null = null;
  
  for (const food of FOODS_DATA_LEAN) {
    const displayLower = food.displayName.toLowerCase();
    const foodWords = displayLower.split(/\s+/).filter(w => w.length > 0);
    
    // Check if all input words appear in food name (word-boundary aware)
    let matchScore = 0;
    let allWordsMatch = true;
    
    for (const inputWord of inputWords) {
      let wordMatched = false;
      for (const foodWord of foodWords) {
        // Exact word match (best)
        if (foodWord === inputWord) {
          matchScore += 10;
          wordMatched = true;
          break;
        }
        // Word starts with input (e.g., "chickpeas" contains "chickpea")
        if (foodWord.startsWith(inputWord) || inputWord.startsWith(foodWord)) {
          matchScore += 5;
          wordMatched = true;
          break;
        }
      }
      if (!wordMatched) {
        allWordsMatch = false;
        break;
      }
    }
    
    if (allWordsMatch && matchScore > 0) {
      if (!bestMatch || matchScore > bestMatch.score) {
        bestMatch = { food, score: matchScore };
      }
    }
  }
  
  if (bestMatch) {
    return bestMatch.food.id;
  }
  
  // STEP 5: Last resort - substring match ONLY if input is shorter (prevents "butter" matching "almond butter")
  // This is for cases like "yogurt" matching "greek yogurt"
  if (normalized.length < 20) { // Only for short inputs
    for (const food of FOODS_DATA_LEAN) {
      const displayLower = food.displayName.toLowerCase();
      // Only match if food name contains the input as a complete word
      const wordBoundaryRegex = new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordBoundaryRegex.test(displayLower)) {
        return food.id;
      }
    }
  }
  
  return null;
}

/**
 * Calculate multiplier for macro calculations
 * Handles unit-based foods (eggs, bananas) vs weight-based foods (chicken, rice)
 */
function calculateMacroMultiplier(food: Food, amount: number, unit?: string): number {
  // 🔧 FIX: If unit is explicitly 'g' or 'ml', ALWAYS treat as weight-based
  // This fixes bananas showing 10,680 cal when AI outputs "banana: 120g"
  // Only treat as unit-based if unit is explicitly 'units' or 'count'
  if (unit === 'g' || unit === 'ml' || unit === 'grams' || unit === 'milliliters') {
    // Weight-based: divide by 100 to get multiplier
    return amount / 100;
  } else if (unit === 'units' || unit === 'count' || unit === 'unit') {
    // Explicitly unit-based: amount is per-item
    return amount;
  } else if (food.defaultUnit === 'units') {
    // No unit specified but food has defaultUnit='units': treat as unit-based
    // This handles cases where AI doesn't specify unit for unit-based foods
    return amount;
  } else {
    // Default: treat as weight-based (grams)
    return amount / 100;
  }
}

/**
 * Calculate accurate macros from ingredients using FOODS_BY_ID_LEAN
 * Now accepts food names and looks them up automatically
 */
function calculateMacros(ingredients: any[]): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  
  ingredients.forEach(ing => {
    // Support both foodId (legacy) and foodName (new)
    let foodId = ing.foodId;
    if (!foodId && ing.foodName) {
      foodId = lookupFoodId(ing.foodName);
      if (!foodId) return;
    }
    
    const food = getFoodWithOverrides(foodId) || FOODS_BY_ID_LEAN[foodId];
    if (!food) return;
    
    const multiplier = calculateMacroMultiplier(food, ing.amount, ing.unit);
    calories += food.macrosPer100.calories * multiplier;
    protein += food.macrosPer100.protein_g * multiplier;
    carbs += food.macrosPer100.carbs_g * multiplier;
    fat += food.macrosPer100.fat_g * multiplier;
  });
  
  return {
    calories: Math.round(calories),
    protein_g: Math.round(protein * 10) / 10,
    carbs_g: Math.round(carbs * 10) / 10,
    fat_g: Math.round(fat * 10) / 10
  };
}

// REMOVED: aggregateGroceryList - replaced by inline regex parsing in Step 3 (new architecture)

/**
 * Get food category from FOODS_BY_ID_LEAN
 */
function getFoodCategory(foodId: string): string {
  const food = FOODS_BY_ID_LEAN[foodId];
  if (!food) return 'other';
  
  const category = food.category || 'other';
  // Normalize category names
  if (category === 'protein' || category === 'proteins') return 'proteins';
  if (category === 'carb' || category === 'carbs') return 'carbs';
  if (category === 'vegetable' || category === 'vegetables') return 'vegetables';
  if (category === 'fruit' || category === 'fruits') return 'fruits';
  if (category === 'fat' || category === 'fats') return 'fats';
  if (category === 'dairy' || category === 'dairy_alternatives') return 'dairy';
  return 'other';
}

/**
 * Convert groceryItems to grocerySections format (expected by renderer)
 * Input format: [{ingredient, buy, total_price, category, needed}]
 * Renderer format: { grocerySections: [{label, items: [{name, quantity, estimatedPriceGBP, priceBand}]}] }
 */
function convertGroceryItemsToSections(groceryItems: any[], budgetTier: string): any[] {
  if (!groceryItems || !Array.isArray(groceryItems)) {
    return [];
  }

  // Group by category
  const categoryMap: Record<string, any[]> = {};
  
  groceryItems.forEach((item: any) => {
    const category = item.category || 'other';
    if (!categoryMap[category]) {
      categoryMap[category] = [];
    }

    categoryMap[category].push({
      name: item.ingredient,
      quantity: item.buy,
      estimatedPriceGBP: parseFloat(item.total_price.replace(/[£,]/g, '')) || 0,
      priceBand: budgetTier
    });
  });
  
  // Convert to sections array
  return Object.entries(categoryMap).map(([label, items]) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    items: items
  }));
}

// ============================================================================
// REMOVED: Old architecture functions (not used in new 2-call architecture)
// ============================================================================
// These functions were replaced by:
// - Step 3: Inline regex parsing (no function needed)
// - Step 4: Combined Nano call (does both JSON + pricing in one call)
//
// OLD FUNCTIONS REMOVED:
// - convertGroceryToUKPacks() - replaced by combined Nano call
// - convertStructuredTextToJSON() - replaced by combined Nano call
// - aggregateGroceryList() - replaced by inline regex parsing
// ============================================================================

// ============================================================================
// WORKOUT SYSTEM PROMPT (from docs/chatgptpromptworkout.md)
// ============================================================================
const WORKOUT_SYSTEM_PROMPT = `You are an elite personal trainer generating weekly workout plans as STRICT JSON for the Milo app.

INPUTS include:
daysPerWeek, workoutType (Strength | Cardio | Hypertrophy | Calisthenics | combos),
sessionLengthMin, equipment, experience, workoutSplit, presetStyle,
coachNotes, restrictions, goals, sex, age, weight, height.

========================
GLOBAL HARD RULES
========================
- Output VALID JSON ONLY. No text outside JSON.
- JSON MUST match the schema exactly.
- Respect equipment, injuries, restrictions, and experience level.
- Never invent unsupported equipment.
- Place compound movements before accessory/isolation work.
- Use realistic volume for ONE person.

========================
PRIORITY ORDER (NON-NEGOTIABLE)
========================
1. Valid JSON structure
2. Session duration rule
3. Safety (injuries, restrictions, experience)
4. Split & workoutType logic
5. Everything else

========================
SESSION DURATION RULE (TOP-LEVEL)
========================
Each day MUST contain EXACTLY round(sessionLengthMin / 12) exercises.

Examples:
- 30 min → 3
- 45 min → 4
- 60 min → 5
- 90 min → 8

estimatedSessionMin must be within ±10 minutes of sessionLengthMin.
If any day violates this rule, the plan is INVALID and must be internally corrected before output.

========================
EXPERIENCE BIAS
========================
- BEGINNER:
- Prioritise safety, confidence, and learning movement patterns
- Prefer machines, supported movements, or simple dumbbell exercises over complex barbell lifts
- Avoid advanced variations (paused reps, tempos beyond basic control, unstable setups)
- Exercise selection should be easy to understand and repeat week-to-week
- Notes MUST emphasise setup, control, and purpose in plain language

INTERMEDIATE:
- Balanced mix of compound and accessory movements
- Introduce moderate variation while maintaining core lift consistency
- Can include standard barbell lifts and free-weight compounds
- Notes should focus on technical execution and muscle intent
- Avoid unnecessary complexity or advanced methods

ADVANCED:
- Prioritise movement quality, load management, and intelligent variation
- Include unilateral movements, challenging free-weight patterns, and secondary planes of motion
- Reduce reliance on machines unless used intentionally
- Exercise selection should challenge control, strength, and coordination
- Notes should be technical and performance-oriented

ATHLETE:
- Programming must reflect performance, robustness, and control — not simplicity
- Prioritise unilateral, multi-planar, and stability-demanding movements
- Include at least ONE per session:
  • Unilateral upper or lower movement
  • Anti-rotation or core stability demand
  • Explosive or athletic intent (even with moderate loads)
- Avoid overly basic isolation-only exercises unless clearly intentional
- Exercise selection should never resemble beginner or generic bodybuilding routines

========================
COACH NOTES & RESTRICTIONS
========================
- Injuries and pain override all other preferences.
- Substitute safer movements where required.
- Personal preferences are secondary to safety.

========================
EXERCISE NOTES (MANDATORY)
========================
Every strength or accessory exercise MUST include a notes string with numbered points separated by line breaks.

BASE STRUCTURE (ALL USERS):
1. Tempo — Eccentric-Pause-Concentric (e.g. "2-1-2")
2. Primary coaching cue
3. Focus — primary muscle group

BEGINNER ADJUSTMENT (CRITICAL):
If experience is Beginner:
- Point 2 MUST be a simple setup or safety cue (e.g. stance, range, control)
- Point 3 MAY briefly explain the purpose of the movement in plain language
- Avoid jargon and advanced biomechanics

INTERMEDIATE+:
- Point 2 should be a technical form cue
- Point 3 should be purely muscle-focused

OPTIONAL POINT 4:
Only include if coachNotes or restrictions directly apply.

========================
WORKOUT TYPE LOGIC
========================
Strength:
- Compounds: 3–5 sets, 3–6 reps, 90–180s rest
- Accessories: 2–4 sets, 6–10 reps

Hypertrophy:
- Compounds: 3–4 sets, 8–12 reps
- Accessories: 2–3 sets, 10–15 reps

Calisthenics:
- Bodyweight movements scaled to experience

Mixed plans mean separate strength/hypertrophy/calisthenics days PLUS cardio days — never combined.

========================
CARDIO RULES (NON-NEGOTIABLE)
========================
- Cardio days are session-level summaries.
- A cardio day MUST contain:
  • Exactly ONE block of type "cardio"
  • Exactly ONE item named "Cardio Day"
- Cardio is time-based only (durationMin + intensity).
- No sets or reps.

CARDIO FREQUENCY:
- Mixed plans:
  • 1–5 days/week → exactly 1 cardio day
  • 6–7 days/week → exactly 2 cardio days
- Cardio-primary plans:
  • Cardio most days with varied intensity and recovery

========================
SPLIT LOGIC
========================
push/pull/legs:
- Push day = chest, shoulders, triceps
- Pull day = back, biceps
- Leg day = quads, hamstrings, glutes
- DO NOT COMBINE THEY ARE FOR SEPERATE DAYS: push, pull, legs

Arnold Split:
- chest & back
- Shoulders & arms 
- Legs

upper/lower:
- Alternate upper and lower body

full-body:
- Full-body compounds every session

bro-split:
- Chest, Back, Shoulders, Arms, Legs

custom:
- Follow user labels while maintaining weekly balance

MOVEMENT CLASSIFICATION:
- Deadlifts are hip hinge movements.
- Place them on leg, lower-body, or full-body days only.

========================
WEEKLY BALANCE RULE (CRITICAL)
========================
If a split includes Push, Pull, and Legs:
- Each must appear at least once across the week
- No type may repeat until all others have appeared
- Cardio days do NOT replace missing Push, Pull, or Legs days

========================
FOCUS PRESET ADJUSTMENTS
========================
Feminine:
- Higher lower-body and glute volume
- Reduced chest isolation

Masculine:
- Higher upper push/pull volume
- Reduced glute isolation

Neutral:
- Balanced volume

========================
OUTPUT SHAPE (STRICT)
========================
Return EXACTLY one JSON object with this structure:

{
  "plan_name": string,
  "generated_at": string,
  "daysPerWeek": number,
  "workoutType": string,
  "sessionLengthMinTarget": number,
  "split": string,
  "days": [
    {
      "dayIndex": number,
      "label": string,
      "primaryFocus": string,
      "estimatedSessionMin": number,
      "blocks": [
        {
          "blockType": "strength" | "accessory" | "cardio",
          "items": [
            {
              "name": string,
              "muscleGroup": string,
              "equipment": string,
              "sets": number | null,
              "reps": string | number | null,
              "durationMin": number | null,
              "restSec": number | null,
              "intensity": string | null,
              "notes": string
            }
          ]
        }
      ]
    }
  ]
}

Constraints:
- reps must exist (null or "N/A" allowed for cardio).
- durationMin must exist for cardio items.
- Never add or remove fields.`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface MealInputs {
  dietaryPreference?: string;
  dietType?: string;
  caloriesTargetPerDay?: number;
  calorieGoal?: number;
  dietGoal?: string;
  goal?: string;
  budgetTier?: string;
  budget?: string;
  mealsPerDay?: number;
  days?: number;
  daysPerWeek?: number;
  preferredProteins?: string;
  proteinSources?: string | string[];
  allergies?: string | string[];
  avoid?: string | string[];
  dislikes?: string;
  restrictions?: string[];
  bulkStyle?: string;
  cookingStyle?: string;
  cookingTime?: string;
  timeAvailablePerDay?: string;
}

interface WorkoutInputs {
  daysPerWeek?: number;
  workoutType?: string;
  sessionLengthMin?: number;
  equipment?: string;
  experience?: string;
  workoutSplit?: string;
  preset?: string;
  coachNotes?: string;
  goals?: string;
  restrictions?: string[];
}

function buildMealUserPrompt(inputs: MealInputs): string {
  const dietaryPreference = inputs.dietaryPreference || inputs.dietType || 'balanced';
  const caloriesTargetPerDay = inputs.caloriesTargetPerDay || inputs.calorieGoal || 2000;
  const dietGoal = inputs.dietGoal || inputs.goal || 'maintain';
  const budgetTier = inputs.budgetTier || inputs.budget || 'medium';
  const mealsPerDay = inputs.mealsPerDay || 4;
  const days = inputs.days || inputs.daysPerWeek || 7;
  
  let preferredProteins = '';
  if (inputs.preferredProteins) {
    preferredProteins = Array.isArray(inputs.preferredProteins) 
      ? inputs.preferredProteins.join(', ') 
      : inputs.preferredProteins;
  } else if (inputs.proteinSources) {
    preferredProteins = Array.isArray(inputs.proteinSources)
      ? inputs.proteinSources.join(', ')
      : inputs.proteinSources;
  }
  
  const allergies = inputs.allergies || '';
  const avoid = inputs.avoid || inputs.dislikes || '';

  const intent = {
    dietaryPreference,
    caloriesTargetPerDay,
    dietGoal,
    budgetTier,
    mealsPerDay,
    days,
    preferredProteins,
    allergies,
    avoid,
    locationHint: 'UK'
  };

  if (inputs.bulkStyle) {
    (intent as any).bulkStyle = inputs.bulkStyle;
  }

  let userMessage = JSON.stringify(intent);
  
  if (inputs.restrictions && inputs.restrictions.length > 0) {
    const restrictionsText = inputs.restrictions.join('\n\n');
    userMessage = restrictionsText + '\n\n=== MEAL PLAN REQUEST ===\n' + userMessage;
  }

  return userMessage;
}

function buildWorkoutUserPrompt(inputs: WorkoutInputs): string {
  const {
    daysPerWeek = 4,
    workoutType = 'Strength',
    sessionLengthMin = 45,
    equipment = 'Full Gym',
    experience = 'Intermediate',
    workoutSplit = 'full-body',
    preset = 'neutral',
    coachNotes = '',
    goals = 'hypertrophy',
    restrictions = []
  } = inputs;

  // Fix: Handle null/undefined workoutSplit before calling .replace()
  let workoutFocus = (workoutSplit || 'full-body').replace(/-/g, ' ') || 'Full Body';
  
  // Handle workoutType as string or array (for combo workouts)
  let workoutTypeStr: string;
  let workoutTypesArray: string[] = [];
  let includesCardio = false;
  
  if (Array.isArray(workoutType)) {
    workoutTypesArray = workoutType.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    workoutTypeStr = workoutTypesArray.join(' + ');
    includesCardio = workoutTypesArray.some(w => w.toLowerCase() === 'cardio');
  } else {
    workoutTypeStr = typeof workoutType === 'string' ? workoutType : 'Strength';
    // Check if string contains multiple types (e.g., "Strength + Cardio" or "Strength, Cardio")
    const workoutTypeLower = workoutTypeStr.toLowerCase();
    if (workoutTypeLower.includes('+') || workoutTypeLower.includes(',')) {
      // Split by + or , and clean up
      workoutTypesArray = workoutTypeStr.split(/[+,]/).map(w => w.trim()).filter(Boolean);
      includesCardio = workoutTypesArray.some(w => w.toLowerCase() === 'cardio');
    } else {
      workoutTypesArray = [workoutTypeStr];
      includesCardio = workoutTypeLower === 'cardio' || workoutTypeLower.includes('cardio');
    }
  }
  
  let presetInstructions = '';
  if (preset === 'feminine') {
    presetInstructions = 'CRITICAL: FEMININE FOCUS - Prioritize glutes, legs, toning. ';
  } else if (preset === 'masculine') {
    presetInstructions = 'CRITICAL: MASCULINE FOCUS - Prioritize upper body strength and size. ';
  }

  let userRequests = '';
  if (coachNotes) {
    userRequests += `\nCRITICAL USER REQUESTS: ${coachNotes}. You MUST incorporate these specific exercises/requests.`;
  }
  if (restrictions.length > 0) {
    userRequests += `\nRESTRICTIONS: ${restrictions.join('; ')}.`;
  }

  // Add cardio distribution reminder if cardio is included
  let cardioInstructions = '';
  if (includesCardio) {
    if (workoutTypesArray.length > 1) {
      // Cardio combined with another type - use distribution rules
      let distributionRule = '';
      if (daysPerWeek === 2) distributionRule = 'Day 1 = other type, Day 2 = cardio';
      else if (daysPerWeek === 3) distributionRule = 'Days 1-2 = other type, Day 3 = cardio';
      else if (daysPerWeek === 4) distributionRule = 'Days 1-3 = other type, Day 4 = cardio';
      else if (daysPerWeek === 5) distributionRule = 'Days 1-3,5 = other type, Day 4 = cardio';
      else if (daysPerWeek === 6) distributionRule = 'Days 1-2,4-5 = other type, Days 3,6 = cardio';
      else if (daysPerWeek === 7) distributionRule = 'Days 1-2,4-5,7 = other type, Days 3,6 = cardio';
      
      cardioInstructions = `\n\n🚨🚨🚨 CRITICAL: CARDIO DISTRIBUTION RULES (MUST FOLLOW - DO NOT IGNORE) 🚨🚨🚨
- ${distributionRule}
- Cardio days MUST use the "Cardio Day" format (single exercise with duration/intensity in notes).
- You MUST follow this exact distribution pattern. DO NOT skip cardio days.
- If you ignore these rules, the workout plan is INVALID.`;
    } else {
      // Cardio-only workout
      cardioInstructions = `\n\n🚨🚨🚨 CRITICAL: CARDIO-ONLY WORKOUT 🚨🚨🚨
- ALL days must be cardio days using the "Cardio Day" format (single exercise with duration/intensity in notes).
- DO NOT include strength, hypertrophy, or calisthenics exercises.
- Each day must have exactly ONE "Cardio Day" exercise.`;
    }
  }

  // DURATION–EXERCISE RATIO (100% MANDATORY): 12 min per exercise. Always use formula.
  const exerciseCount = Math.max(1, Math.round(sessionLengthMin / 12));
  const exerciseCountRequirement = `${exerciseCount} exercises (REQUIRED - exactly ${exerciseCount} exercises)`;

  return `${daysPerWeek}-day ${workoutTypeStr} plan for a ${experience} user training with ${equipment}, ${sessionLengthMin}min/day. Primary focus: ${workoutFocus}. Goal: ${goals}.
${presetInstructions}${userRequests}${cardioInstructions}

🚨🚨🚨 DURATION–EXERCISE RATIO (100% MANDATORY – NO EXCEPTIONS) 🚨🚨🚨
- Session length: ${sessionLengthMin} minutes → EXACTLY ${exerciseCount} exercises per day
- Formula: round(sessionLengthMin / 12) = exercise count. 12 minutes per exercise. 60 min = 5 exercises ALWAYS.
- REQUIRED: ${exerciseCountRequirement}
- Each day MUST have exactly ${exerciseCount} exercises – no more, no less. If you generate any other count, the plan is INVALID.

SCIENTIFIC PRINCIPLES:
- Start each day with 2-3 compound movements (Squat, Deadlift, Bench Press, Overhead Press, Barbell Row, Pull-ups, Dips) before isolation/accessory work.
- For ${daysPerWeek} days/week, ensure appropriate training frequency.
- Hypertrophy: 8-12 reps, 3-4 sets, 60-90s rest. Strength: 4-6 reps, 4-5 sets, 2-3min rest.

EXERCISE STRUCTURE (REQUIRED):
- Every strength and accessory exercise MUST include:
  * name: Exercise name
  * muscleGroup: Primary muscle worked
  * equipment: Equipment needed
  * sets: Number of sets
  * reps: Reps (number or range like "8-10")
  * restSec: Rest time in seconds
  * notes: String with 3 base points (or 4 if coachNotes are provided and relevant, format with line breaks or newlines):
    1. Tempo: Eccentric-Pause-Concentric format (e.g., "2-1-2", "3-0-1")
    2. Form: Key form tip (e.g., "Keep shoulder blades retracted throughout")
    3. Focus: Primary muscle targeted (format: "Focus: [muscle name]", e.g., "Focus: Medial delt", "Focus: Chest, anterior delts")
    4. (OPTIONAL - only if coachNotes are provided and relevant): Personalization addressing user's coachNotes (e.g., "Injury note: Use lighter weight due to shoulder pain", "Preference: Focus on controlled movement as requested")
  
  Example notes format (3 points): "1. Tempo: 2-1-2\n2. Form: Keep shoulder blades retracted throughout\n3. Focus: Medial delt"
  Example notes format (4 points with coachNotes): "1. Tempo: 2-1-2\n2. Form: Keep shoulder blades retracted throughout\n3. Focus: Medial delt\n4. Injury note: Reduce weight if shoulder pain occurs"

VOLUME GUIDANCE (CRITICAL - MUST FOLLOW):
- DURATION–EXERCISE RATIO is 100% MANDATORY: 12 min per exercise. round(sessionLengthMin/12) = exercise count.
- Examples: 45 min = 4, 60 min = 5, 75 min = 6, 90 min = 8. ALWAYS use this ratio – no exceptions.
- Each day MUST have exactly the required number of exercises (see above) – no more, no less.
- Start with compound movements, then add accessory/isolation exercises.
- Keep sessions realistic and achievable within the target session length.

RULES:
- Output ONLY JSON, no extra text.
- The 'days' array MUST contain EXACTLY ${daysPerWeek} objects.
- Each day label: "Training Day N - ${workoutFocus.charAt(0).toUpperCase() + workoutFocus.slice(1)}" where N = 1..${daysPerWeek}.
- Use only exercises that match the focus, equipment and restrictions.
- ALWAYS respect injuries and safety inside restrictions.`;
}

function parseJSONResponse(content: string): any {
  let cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/g, '')
    .trim();
  
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in response');
  }
  
  let jsonString = jsonMatch[0];
  jsonString = jsonString
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  
  return JSON.parse(jsonString);
}

// ============================================================================
// MAIN HANDLER - NEW 3-STEP ARCHITECTURE
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get API keys
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (FOODS_DATA_LEAN.length === 0) {
    return new Response(JSON.stringify({ error: "Food database not loaded" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  

  // Parse request body
  let body: any;
  try {
    body = await req.json();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { mealInputs, workoutInputs, model } = body;

  if (!mealInputs && !workoutInputs) {
    return new Response(JSON.stringify({ error: "Must provide mealInputs or workoutInputs" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Initialize clients
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Track overall generation time and costs
  const overallStartTime = Date.now();
  let mealCost = 0;
  let workoutCost = 0;
  let mealTokens = { input: 0, output: 0, total: 0 };
  let workoutTokens = { input: 0, output: 0, total: 0 };

  // Pricing per 1M tokens (as of 2025)
  const PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4.1': { input: 2.00, output: 8.00 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4.1-mini': { input: 0.40, output: 1.60 },
    'gpt-4.1-nano': { input: 0.10, output: 0.40 },
    'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 }, // Approximate
    'claude-sonnet-4-5': { input: 3.00, output: 15.00 }
  };

  // Run both in parallel (supports generating one or both plans)
  const promises: Promise<any>[] = [];

  if (mealInputs) {
    promises.push(
      (async () => {
        try {
          const startTime = Date.now();
          console.log('🚀 NEW DEPLOYMENT - Meal Plan Generator Starting');
          console.log('⏰ Timestamp:', new Date().toISOString());

          // Extract inputs
          const diet = mealInputs.dietaryPreference || mealInputs.dietType || 'balanced';
          
          // ============================================
          // ALLERGY PROCESSING (FIXED)
          // ============================================
          // Support both allergies and avoid (some clients send avoid)
          const rawAllergies = mealInputs.allergies ?? mealInputs.avoid ?? '';

          // Step 1: Convert to array if string
          const userAllergies = Array.isArray(rawAllergies)
            ? rawAllergies.map((a: string) => a.toLowerCase().trim()).filter(Boolean)
            : (typeof rawAllergies === 'string' && rawAllergies.trim()
                ? rawAllergies.toLowerCase().split(/[,;]/).map((a: string) => a.trim()).filter((a: string) => a)
                : []);

          // Step 2: Map user-friendly names to database codes
          const allergenMapping: Record<string, string[]> = {
            'dairy': ['dairy'],
            'gluten': ['gluten', 'wheat', 'barley', 'rye'],
            'nuts': ['tree_nut', 'peanut'],
            'eggs': ['egg'],
            'fish': ['fish'],
            'shellfish': ['shellfish'],
            'soy': ['soy'],
            'sesame': ['sesame'],
            // Common variations
            'milk': ['dairy'],
            'cheese': ['dairy'],
            'lactose': ['dairy'],
            'coeliac': ['gluten', 'wheat', 'barley', 'rye'],
            'celiac': ['gluten', 'wheat', 'barley', 'rye'],
            'tree nuts': ['tree_nut'],
            'peanuts': ['peanut'],
            'egg': ['egg'],
            'soya': ['soy']
          };

          // Step 3: Expand to database codes
          const expandedAllergies: string[] = [];
          userAllergies.forEach(userAllergy => {
            const normalized = userAllergy.toLowerCase().trim();
            if (allergenMapping[normalized]) {
              expandedAllergies.push(...allergenMapping[normalized]);
            } else {
              expandedAllergies.push(normalized);
            }
          });

          // Step 4: Remove duplicates and assign
          const allergies = [...new Set(expandedAllergies)];

          console.log('🔍 ALLERGY FILTER TEST');
          console.log('📥 Raw allergies input:', JSON.stringify(rawAllergies));
          console.log('👤 User allergies processed:', JSON.stringify(userAllergies));
          console.log('🗂️ Expanded database codes:', JSON.stringify(allergies));
          
          const dislikes = Array.isArray(mealInputs.restrictions) 
            ? mealInputs.restrictions 
            : (mealInputs.restrictions ? [mealInputs.restrictions] : []);
          const dailyCalories = mealInputs.caloriesTargetPerDay || mealInputs.calorieGoal || 2000;
          const mealsPerDay = mealInputs.mealsPerDay || 4;
          const days = mealInputs.days || mealInputs.daysPerWeek || 7;
          const dietGoal = mealInputs.dietGoal || mealInputs.goal || 'maintain';
          const budgetTier = mealInputs.budgetTier || mealInputs.budget || 'medium';

          // Calculate meal targets (MATCH AI PROMPT)
          // AI prompt says: 2 meals = 50/50 split (equal calories)
          //                  3 meals = 30-35% each (equal split = 33.33% each)
          //                  4 meals = 30% each for breakfast/lunch/dinner + 10% for snack
          const mealTargets: Record<string, number> = {};
          if (mealsPerDay === 2) {
            // 2 meals: 50/50 split (equal calories per meal)
            const half = Math.round(dailyCalories / 2);
            mealTargets.breakfast = half;
            mealTargets.lunch = dailyCalories - half; // Ensures sum equals dailyCalories exactly
          } else if (mealsPerDay === 4) {
            // 4 meals: 30% each for breakfast/lunch/dinner, 10% for snack
            mealTargets.breakfast = Math.round(dailyCalories * 0.30);
            mealTargets.lunch = Math.round(dailyCalories * 0.30);
            mealTargets.dinner = Math.round(dailyCalories * 0.30);
            mealTargets.snack = Math.round(dailyCalories * 0.10);
          } else if (mealsPerDay === 3) {
            // 3 meals: Equal split (33.33% each, with rounding: 33%, 33%, 34%)
            const oneThird = Math.round(dailyCalories / 3);
            mealTargets.breakfast = oneThird;
            mealTargets.lunch = oneThird;
            mealTargets.dinner = dailyCalories - (oneThird * 2); // Ensures sum equals dailyCalories exactly
          }


            // ============================================================================
          // CALL 1: Generate meal concepts with portions
            // ============================================================================
          // Extract Week 2+ parameters if provided
          const previousMealTitles = mealInputs.previousMealTitles || mealInputs.previousWeekMeals || [];
          const previousGroceryList = mealInputs.previousGroceryList || mealInputs.previousWeekGroceryList;
          const week1Feedback = mealInputs.week1Feedback || mealInputs.weekFeedback || ''; // Legacy support
          const feedback2 = mealInputs.feedback2 || '';
          const feedback3 = mealInputs.feedback3 || '';
          const isContinuationWeek = mealInputs.isContinuationWeek || 
            (previousMealTitles && previousMealTitles.length > 0) ||
            (week1Feedback && week1Feedback.trim().length > 0) ||
            (feedback2 && feedback2.trim().length > 0) ||
            (feedback3 && feedback3.trim().length > 0);

          const conceptsText = await generateMealConcepts(openai, {
            dietType: diet,
            dailyCalories,
                days,
                mealsPerDay,
            dietGoal,
            allergies,
            dislikes,
            budgetTier,
            // Week 2+ parameters
            isContinuationWeek,
            previousMealTitles,
            previousGroceryList,
            week1Feedback, // Legacy support
            feedback2,
            feedback3
          });

          // Track tokens from Call 1
          // Note: We'd need to capture usage from generateMealConcepts, but for now we'll estimate

              // ============================================================================
          // PARSE: Extract structured meal data
              // ============================================================================
          const parsedMeals = parseMealConcepts(conceptsText, days, mealsPerDay);

          // 🔧 FIX: Safety check - ensure parsedMeals is valid before proceeding
          if (!parsedMeals || !parsedMeals.days || !Array.isArray(parsedMeals.days) || parsedMeals.days.length === 0) {
            throw new Error(`Failed to parse meal plan: ${parsedMeals ? 'Invalid structure' : 'No data returned'}`);
          }

          // ============================================================================
          // BUILD FOOD MAP: Create map with macro overrides applied (e.g., egg calories)
          // ============================================================================
          const foodsMapWithOverrides = buildFoodMapWithOverrides();
          // ============================================================================
          // VALIDATE: Check ingredient caps compliance
          // ============================================================================
          const capValidation = validateIngredientCaps(parsedMeals, budgetTier, foodsMapWithOverrides);
          if (!capValidation.isValid) {
            // TODO: Consider retry logic here if caps are exceeded
          }

              // ============================================================================
          // SCALE: Scale portions to hit calorie targets
              // ============================================================================
          const scaledMeals = scalePortionsToTargets(parsedMeals, mealTargets, foodsMapWithOverrides);

              // ============================================================================
          // MIDDLEWARE: Apply portion caps and rebalance calories (BEFORE recipe generation)
              // ============================================================================
          const cappedMealPlan = applyPortionCapsAndRebalance(
            scaledMeals,
            {
              dailyCalories,
              mealsPerDay,
              budgetTier
            },
            foodsMapWithOverrides
          );

          // ============================================================================
          // VALIDATION: Ensure minimum ingredients per meal (after capping)
          // ============================================================================
          function ensureMinimumIngredients(mealPlan: any): void {
            const violations: Array<{ meal: string; day: number; count: number; ingredients: string[] }> = [];
            
            mealPlan.days.forEach((day: any) => {
              day.meals.forEach((meal: any) => {
                const ingredientCount = meal.ingredientsPerPortion?.length || meal.ingredients?.length || 0;
                const ingredientIds = meal.ingredientsPerPortion?.map((i: any) => i.foodId || i.id) || 
                                     meal.ingredients?.map((i: any) => i.id || i.foodId) || [];
                
                if (ingredientCount < 3) {
                  violations.push({
                    meal: meal.name || 'Unknown',
                    day: day.dayIndex || 0,
                    count: ingredientCount,
                    ingredients: ingredientIds
                  });
                }
              });
            });
            
            if (violations.length > 0) {
              // Don't throw - continue, but violations are tracked
            }
          }
          
          ensureMinimumIngredients(cappedMealPlan);

          // ============================================================================
          // CALL 2: Generate recipes (AFTER capping so recipe matches ingredient amounts)
          // ============================================================================
          const finalMealPlan = await generateRecipes(openai, cappedMealPlan, foodsMapWithOverrides);

          // ============================================================================
          // GROCERY LIST: Build deterministically from meal plan (no AI)
          // ============================================================================
          const groceryList = buildGroceryListFromPlan(
            finalMealPlan.days,
            foodsMapWithOverrides,
            groceryRules,
            budgetTier
          );

              // ============================================================================
          // VALIDATION: Check grocery list alignment with meal plan ingredients
              // ============================================================================
          validateGroceryListAlignment(cappedMealPlan.days, groceryList, FOODS_BY_ID_LEAN);

          // Build final response
              const finalResponse = {
            plan_name: "Balanced Performance Plan",
            generated_at: new Date().toISOString(),
            dietStyle: diet,
            dailyCaloriesTarget: dailyCalories,
            mealsPerDay: mealsPerDay,
            days: finalMealPlan.days, // Use finalMealPlan (has recipes and ingredientsPerPortion), not cappedMealPlan
            grocerySections: groceryList.grocerySections,
            groceryTotals: groceryList.groceryTotals
          };


              return finalResponse;
        } catch (error: any) {
          return { 
            error: error?.message || String(error),
            errorType: error?.name || 'UnknownError',
            stack: error?.stack
          };
        }
      })()
    );
  } else {
    promises.push(Promise.resolve(null));
  }

  if (workoutInputs) {
    const workoutUserPrompt = buildWorkoutUserPrompt(workoutInputs);
    
    
    promises.push(
      (async () => {
        try {
          const workoutModel = model || "gpt-4.1-mini";
          
          const workoutStartTime = Date.now();
          const response = await openai.chat.completions.create({
            model: workoutModel,
            max_tokens: 16000,
            temperature: 0.3,
            messages: [
              {
                role: "system",
                content: WORKOUT_SYSTEM_PROMPT
              },
              {
                role: "user",
                content: workoutUserPrompt
              }
            ],
            response_format: { type: "json_object" }
          });
          
          // Track usage and cost for workout generation
          if (response.usage) {
            workoutTokens.input = response.usage.prompt_tokens || 0;
            workoutTokens.output = response.usage.completion_tokens || 0;
            workoutTokens.total = response.usage.total_tokens || 0;
            
            const pricing = PRICING[workoutModel] || PRICING['gpt-4.1-mini'];
            workoutCost = (workoutTokens.input / 1_000_000) * pricing.input + 
                         (workoutTokens.output / 1_000_000) * pricing.output;
          }
          
          const workoutDuration = Date.now() - workoutStartTime;
          
          const content = response.choices[0]?.message?.content;
          if (!content) {
            throw new Error('No content in OpenAI response');
          }
          return parseJSONResponse(content);
        } catch (error: any) {
          return { error: error?.message || String(error) };
        }
      })()
    );
  } else {
    promises.push(Promise.resolve(null));
  }

  // Wait for both to complete
  let mealPlan, workoutPlan;
  try {
    [mealPlan, workoutPlan] = await Promise.all(promises);
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error?.message || String(error),
        errorType: 'PromiseAllError'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }

  // Check for errors in responses
  if (mealInputs && mealPlan?.error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: mealPlan.error,
        errorType: mealPlan.errorType || 'MealGenerationError'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }

  if (workoutInputs && workoutPlan?.error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: workoutPlan.error,
        errorType: workoutPlan.errorType || 'WorkoutGenerationError'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }

  // Build response (no grocery data)
  const data: any = {};
  if (mealInputs) {
    data.mealPlan = mealPlan;
    // Grocery list removed - generated on-demand via separate endpoint
  }
  if (workoutInputs) {
    data.workoutPlan = workoutPlan;
  }

  // Calculate total time and cost
  const totalTime = Date.now() - overallStartTime;
  const totalCost = mealCost + workoutCost;
  const totalTokens = {
    input: mealTokens.input + workoutTokens.input,
    output: mealTokens.output + workoutTokens.output,
    total: mealTokens.total + workoutTokens.total
  };

  console.log('✅ Generation complete');
  console.log('💰 Estimated cost: $' + totalCost.toFixed(2));
  console.log('⏱️ Total time: ' + totalTime + 'ms');

  return new Response(
    JSON.stringify({
      success: true,
      data
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
});