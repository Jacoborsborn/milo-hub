/**
 * Canonical grocery ingredient allowlist (from FOOD_MAP_PACKS_AND_PRICES_WITH_CATEGORIES_AND_UNITS.txt).
 * Use isAllowedIngredientName() and resolveIngredientAlias() to align AI output with the lean grocery list.
 */

// Canonical display names from TXT (item header before [Category])
export const CANONICAL_GROCERY_NAMES: readonly string[] = ["Almond butter","Almond milk (unsweetened)","Almonds","Apple cider vinegar","Apple","Apricots (dried)","Asparagus","Aubergine","Avocado oil","Avocado","Baking powder","Balsamic vinegar","Banana","Basil","Basmati rice","Bay leaves","BBQ sauce","Beef (lean)","Beef mince 10% fat","Beef mince 5% fat","Beef stock","Beetroot","Bell peppers","Black beans","Black pepper","Blackberries","Blueberries","Bok choy","Broccoli","Brown rice","Butter beans","Butter","Butternut squash","Cabbage","Caesar dressing","Cannellini beans","Canola oil","Carrots","Cashew butter","Cashew milk (unsweetened)","Cashews","Cauliflower","Cayenne pepper","Celeriac","Cheddar cheese","Cherries","Chia seeds","Chicken breast","Chicken stock","Chicken thigh skinless","Chickpeas","Chili powder","Cinnamon","Cocoa powder (unsweetened)","Coconut milk (tin)","Coconut Milk","Coconut oil","Coconut shavings","Coconut yogurt","Coriander","Cottage cheese","Courgette","Couscous","Cranberries","Cucumber","Cumin","Curry leaves","Curry powder","Dark chocolate 70%","Dill","Dragon fruit","Dried mixed herbs","Edamame (soy beans)","Egg","Enoki mushrooms","Extra virgin olive oil","Falafel","Fennel","Feta cheese","Figs (dried)","Fish sauce","Flax seeds","Focaccia bread","Frozen mixed vegetables","Garam masala","Garlic","Ginger","Goat cheese","Gochujang","Granola","Grapefruit","Grapes","Greek yogurt 0% fat","Greek yogurt 5% fat","Greek yogurt with honey","Greek yogurt","Green beans","Green bell pepper","Green curry paste","Ground beef","Haddock","Halloumi","Harissa paste","Hazelnuts","Herb mix","Hoisin sauce","Honey","Honeydew melon","Hot sauce","Hummus","Iceberg lettuce","Jasmine rice","Kale","Kidney beans","Kimchi","Kiwi","Lamb","Leek","Lemon","Lemongrass","Lentils","Lettuce","Lupin beans","Mackerel","Mango","Maple syrup","Masa harina","Mayonnaise","Miso paste","Mixed fruit","Mixed mushrooms","Mixed salad leaves","Mixed vegetables","Mozzarella","Muesli","Mung beans (sprouted)","Mushrooms","Mustard","Navy beans","Nectarine","Oat milk (unsweetened)","Oat yogurt (plain)","Okra","Olive oil","Onion","Onion powder","Orange juice","Orange","Oregano","Oyster sauce","Pak choi","Paneer","Papaya","Paprika","Parmesan","Parsley","Parsnip","Passata","Passion fruit","Pea milk (unsweetened)","Peanut butter","Peanuts","Pear","Peas (Frozen)","Peas Tin","Pepper","Pesto","Pickled beets","Pickled cucumbers","Pineapple","Pistachios","Pita bread (white)","Plantain","Plum","Poblano pepper","Pomegranate molasses","Pomegranate seeds","Pork","Potatoes","Prawns","Prosciutto","Pumpkin seeds","Quark","Quinoa","Radish kimchi","Radish","Raisins","Ras el hanout","Raspberries","Red bell pepper","Red currants","Red curry paste","Red lentils","Red miso paste","Red onion","Rice milk (unsweetened)","Rice paper wrappers","Rice snack cake (flavoured)","Rice vinegar","Ricotta","Rocket (arugula)","Rolled oats","Romaine lettuce","Rosemary","Sage","Salami","Salmon","Salsa","Salt","Sardines (canned in oil)","Sardines (canned in water)","Seeded bread","Seitan","Semi-skimmed milk","Sesame oil","Sesame seeds","Shiitake mushrooms","Shrimp","Skimmed milk","Smoked mackerel","Sourdough bread","Soy chunks (TVP)","Soy cream (single)","Soy milk (unsweetened)","Soy sauce","Soy yogurt (plain)","Spinach","Spring onions","Sriracha","Strawberries","Sumac","Sunflower oil","Sunflower seeds","Sushi rice","Sweet potato","Sweetcorn","Tahini","Tamari (gluten-free soy sauce)","Tempeh bacon","Tempeh","Thai basil","Thyme","Tofu","Tomato sauce","Tomatoes","Trout","Tuna (canned)","Tuna (fresh)","Turkey ham","Turkey mince 5% fat","Turkey sausage (lean)","Turkey slices (deli)","Turkey","Turmeric","Turnip","Udon noodles","Vegan cheese (coconut oil base)","Vegetable oil","Vegetable stock","Venison (lean)","Vinegar","Walnuts","Water spinach","Watercress","Watermelon","White beans","White bread","White miso paste","White rice","White wine vinegar","Whole wheat couscous","Wholegrain pasta","Wholemeal bread","Worcestershire sauce","Yellow bell pepper"];

function normalizeForMatch(name: string): string {
  let s = (name || "").trim().toLowerCase();
  // Strip ignorable parentheticals for matching only
  s = s.replace(/\s*\((raw|single|baked|canned|tin|frozen)\)\s*$/i, "").trim();
  // Tin/canned equivalent
  s = s.replace(/\s*\((tin|canned)\)\s*$/i, "").trim();
  // Singularize for plural equivalence (strip trailing s, not ss)
  if (s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  return s.replace(/\s+/g, " ").trim();
}

const CANONICAL_SET = new Set(CANONICAL_GROCERY_NAMES.map(normalizeForMatch));

// Map variant (normalized) -> canonical display name (exact from TXT)
const DISPLAY_NAME_ALIASES: Record<string, string> = {
  "chicken thigh skinless (raw)": "Chicken thigh skinless",
  "bell pepper": "Bell peppers",
  "onion (single)": "Onion",
  "falafel (baked)": "Falafel",
  "coconut milk (canned)": "Coconut milk (tin)",
  "coconut milk": "Coconut milk (tin)", // when stripped
  "mixed vegetables": "Frozen mixed vegetables",
  "peas (frozen)": "Peas (Frozen)",
  "peas tin": "Peas Tin",
  "sardines (canned in water)": "Sardines (canned in water)", // already canonical
  "sardines": "Sardines (canned in water)", // AI may say "Sardines" without qualifier
  "coconut milk (tin)": "Coconut milk (tin)",
};
// Also map "Coconut Milk" (with space) -> same
DISPLAY_NAME_ALIASES["coconut milk"] = "Coconut milk (tin)";

/**
 * Returns true only if the canonical grocery list contains this ingredient (after normalization and alias resolution).
 */
export function isAllowedIngredientName(name: string): boolean {
  const canonical = resolveIngredientAlias(name);
  return CANONICAL_SET.has(normalizeForMatch(canonical));
}

/**
 * Maps non-canonical names (AI/output variants) to canonical display name from the grocery TXT.
 * Returns the input if no alias is defined.
 */
export function resolveIngredientAlias(name: string): string {
  if (!name || typeof name !== "string") return name;
  const n = normalizeForMatch(name);
  return DISPLAY_NAME_ALIASES[n] ?? name.trim();
}

export function getCanonicalSet(): Set<string> {
  return new Set(CANONICAL_SET);
}
