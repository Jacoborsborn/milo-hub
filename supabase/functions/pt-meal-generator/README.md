# PT-Meal-Generator Edge Function

Meal-only generator for PT Hub. Generates structured meal plans and UK grocery lists from dietary preferences. No database calls; no auth required (use `--no-verify-jwt` if needed). Deterministic and stable (static prices from `grocery_rules_uk.json`, no real-time supermarket pricing).

## Input

**POST** JSON body:

```json
{
  "mealInputs": {
    "dietaryPreference": "balanced",
    "caloriesTargetPerDay": 2000,
    "mealsPerDay": 4,
    "days": 7,
    "dietGoal": "maintain",
    "budgetTier": "medium",
    "allergies": [],
    "restrictions": [],
    "preferredProteins": []
  }
}
```

| Field | Type | Default |
|-------|------|---------|
| `dietaryPreference` | string | `"balanced"` |
| `caloriesTargetPerDay` | number | `2000` |
| `mealsPerDay` | number | `4` |
| `days` | number | `7` |
| `dietGoal` | string | `"maintain"` |
| `budgetTier` | string | `"medium"` (`low` \| `medium` \| `high`) |
| `allergies` | string[] or string | `[]` |
| `restrictions` | string[] or string | `[]` |
| `preferredProteins` | string[] (optional) | — |

Aliases accepted in code: `dietType`, `calorieGoal`, `daysPerWeek`, `goal`, `budget`, `avoid`.

## Output

**200** JSON:

```json
{
  "mealPlan": {
    "plan_name": string,
    "generated_at": "ISO8601",
    "dietStyle": string,
    "dailyCaloriesTarget": number,
    "mealsPerDay": number,
    "days": [
      {
        "dayIndex": number,
        "meals": [
          {
            "mealType": "breakfast" | "lunch" | "dinner" | "snack",
            "name": string,
            "cuisine": string,
            "ingredientsPerPortion": [{ "foodId", "amount", "unit" }],
            "macrosPerPortion": { "calories", "protein_g", "carbs_g", "fat_g" },
            "recipeSteps": string[],
            "prepTimeMin": number
          }
        ],
        "totalCalories": number
      }
    ]
  },
  "grocerySections": [
    { "label": string, "items": [{ "foodId", "name", "buy", "needed", "estimatedPriceGBP", "priceBand" }] }
  ],
  "groceryTotals": {
    "totalPriceGBP": number,
    "breakdownGBP": { "<category>": number },
    "estimatedTotalWeek": number
  },
  "notes": null
}
```

Error (e.g. **500**): `{ "success": false, "error": string, "errorType": string }`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for meal concept and recipe generation. |

Optional: `MEAL_PROMPT_VERSION` (e.g. `new`), and any `*_AUDIT` / `DEBUG_*` flags for dev-only audits.

## Dependencies (shared)

Uses `../_shared/` only (no DB):

- **Lean food map**: `food-map-lean-data.ts`, `food-map.lean.ts`, `food-map.ts` (Food type)
- **Grocery rules UK + pack selection**: `grocery_rules_uk.json`, `grocery-builder.ts`; optionally `pack_catalog.json`, `pack-selector.ts`
- **Unit / dry–cooked conversion**: handled inside `grocery-builder.ts` (and macro logic in this function)

## CORS

Response includes:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
- `Access-Control-Allow-Methods: POST, OPTIONS`

## Deployment

```bash
supabase functions deploy pt-meal-generator --no-verify-jwt
```

Local:

```bash
supabase functions serve pt-meal-generator --env-file .env.local --no-verify-jwt
```
