# Meal plan generation vs templates vs client presets — Audit report

**Date:** 2025-02  
**Scope:** End-to-end meal generation, template library, client presets, and where they connect.

---

## PART 1 — Inventory: source-of-truth objects

### 1) Client presets

| Item | Detail |
|------|--------|
| **Stored** | Table: `public.clients` · Column: `presets_json` (JSONB) |
| **Shape** | `ClientPresetsJson`: `{ meal?: MealPreset, workout?: WorkoutPreset }`. When using constraints-only model, only constraint fields are persisted (see below). |
| **MealPreset (full)** | `dietaryPreference`, `caloriesTargetPerDay`, `mealsPerDay`, `days`, `dietGoal`, `budgetTier`, `allergies[]`, `restrictions[]`, `cookingTime?` |
| **Persisted meal (constraints only)** | `MealConstraintsOnly`: `caloriesTargetPerDay`, `budgetTier`, `allergies`, `restrictions` (see `presetsToConstraintsOnly` in `src/types/presets.ts`). Client create/edit actions strip to this. |
| **Read** | `src/types/presets.ts` (`parseMealPreset`, `parseClientPresets`), `src/app/templates/meals/actions.ts` (mergeMealInputs reads `client.presets_json?.meal`), `src/app/pt/app/clients/[id]/meals/new/page.tsx` (initialMealInputs from `client.presets_json?.meal` or `meal_inputs_last_used`), `ClientPresetsEditor.tsx`, `ClientPresetsFormFields.tsx` |
| **Write** | `src/app/pt/app/clients/[id]/edit/actions.ts`, `src/app/pt/app/clients/new/actions.ts` (both call `presetsToConstraintsOnly` before writing), `src/lib/services/clients.ts` (insert/update with `presets_json`) |

**Search terms used:** `presets_json`, `MealPreset`, `presets.meal`, `MealConstraintsOnly`, `presetsToConstraintsOnly`

---

### 2) Meal templates (library)

| Item | Detail |
|------|--------|
| **Table** | `public.pt_meal_templates` |
| **Columns** | `id`, `pt_user_id`, `name`, `defaults` (JSONB), `created_at` (from types and service usage; no migration file in repo). |
| **Template object shape** | `MealTemplate`: `id`, `pt_user_id`, `name`, `defaults: Record<string, unknown>`, `created_at`. No `structure_json` or `content_json`; only `defaults`. |
| **Defaults keys used in merge** | `dietaryPreference`, `mealsPerDay`, `days`, `dietGoal` (structure). Optional in defaults: `caloriesTargetPerDay`, `budgetTier`, `allergies`, `restrictions` (see `mergeMealInputs` and built-in templates). |
| **Create** | `src/lib/services/meal-templates.ts` (`createMealTemplate`), `src/lib/services/mealTemplates.ts` (browser RLS test). UI: `TemplatesMealsContent.tsx` (create form + “Add to my library” from built-ins). |
| **Edit** | `src/lib/services/meal-templates.ts` (`updateMealTemplate`). UI: `TemplatesMealsContent.tsx` (Edit modal). |
| **List** | `src/lib/services/meal-templates.ts` (`listMealTemplates`). |
| **Get by id** | `src/lib/services/meal-templates.ts` (`getMealTemplateById`) — used by `assignMealTemplateToClient`. |

**Search terms used:** `pt_meal_templates`, `MealTemplate`, `meal.*template`, `getMealTemplateById`, `listMealTemplates`

---

### 3) Meal plan output (generated plan)

| Item | Detail |
|------|--------|
| **Stored** | Table: `public.plans` · Column: `content_json` (JSONB). Also: `id`, `pt_user_id`, `client_id`, `plan_type` ('meal' \| 'workout'), `created_at`. |
| **Output shape used by UI** | From `src/components/MealPlanRenderer.tsx` and consumers: `days[]` (each: `dayIndex`, `meals[]`, `totalCalories`); each meal: `mealType`, `name`, `cuisine`, `ingredientsPerPortion[]` (`foodId`, `amount`, `unit`), `macrosPerPortion`, `recipe`, `preparationSteps[]`; top-level: `grocerySections[]` (`label`, `items[]`), `groceryTotals` (`totalPriceGBP`, `breakdownGBP`, `estimatedTotalWeek`), `plan_name`, `dailyCaloriesTarget`, `mealsPerDay`. Optional: `meta.coachMessage`. |
| **Saved as** | `content_json = { ...mealPlan, grocerySections, groceryTotals, meta: { coachMessage: "" } }` in `src/app/templates/meals/actions.ts`, `src/app/pt/app/clients/[id]/meals/review/page.tsx`, and `src/app/plans/review/actions.ts`. |

**Search terms used:** `content_json`, `createPlan`, `plans`, `MealPlanRenderer`, `grocerySections`, `groceryTotals`

---

## PART 2 — Entry points that trigger meal generation

| Entry Point (UI) | Component / Route | Service Function | Edge Function | Saves To |
|------------------|-------------------|------------------|---------------|----------|
| Templates → Meals → “Assign” then “Generate & save plan” | `TemplatesMealsContent.tsx` (Assign modal: assign template to client + generate) | `assignMealTemplateToClient(templateId, clientId)` in `src/app/templates/meals/actions.ts` | `pt-meal-generator` (via `generateMeal()` from `src/lib/services/generator.ts`) | `plans` via `createPlan()` |
| Client page → “Generate meal plan” button | `src/app/pt/app/clients/[id]/page.tsx` (form action) | `generateMealPlanForClient(clientId)` in `src/app/templates/meals/actions.ts` (uses client’s `assigned_meal_program_id`, then calls `assignMealTemplateToClient`) | `pt-meal-generator` (via `generateMeal()`) | `plans` via `createPlan()` |
| Client → New Meal Plan → form submit | `MealPlanNewForm.tsx` at `src/app/pt/app/clients/[id]/meals/new/MealPlanNewForm.tsx` | None (client-side invoke) | `pt-meal-generator` (direct `supabase.functions.invoke("pt-meal-generator", { body: { mealInputs } })`) | Draft in sessionStorage → review page → `createPlan()` on confirm (no template) |
| Generate drawer → Single → meal/both + “Run” | `GenerateDrawer.tsx` at `src/components/pt/GenerateDrawer.tsx` | None (creates job) | Indirect: `POST /api/jobs` then `POST /api/jobs/[id]/process` → `assignMealTemplateToClient(mealTemplateId, job.client_id)` → `generateMeal()` → `pt-meal-generator` | `plans` via `createPlan()` in actions |
| Generate drawer → Batch → meal/both | Same drawer, batch tab | Same: job creation then process route | Same chain as single | `plans` via `createPlan()` in process route |

**Search terms used:** `assignMealTemplateToClient`, `generateMealPlanForClient`, `pt-meal-generator`, `generateMeal`, `createPlan`

---

## PART 3 — Generator engine: meal generator pipeline

### Pipeline (template-based path: Assign or “Generate meal plan” or job process)

```
1. UI action
   - Templates Meals: "Assign" → pick client → "Generate & save plan"
     OR Client page: "Generate meal plan" (uses assigned_meal_program_id)
     OR Generate drawer: Single/Batch with meal_template_id → job created then process
   →
2. Service fn
   - assignMealTemplateToClient(templateId, clientId, overrides?)
     File: src/app/templates/meals/actions.ts
   - Fetches: getMealTemplateById(templateId), getClientById(clientId)
   - mergeMealInputs(template.defaults, client.presets_json?.meal, overrides)
     → structure from template: dietaryPreference, mealsPerDay, days, dietGoal
     → constraints from client: caloriesTargetPerDay, budgetTier, allergies, restrictions
     → overrides can override any
   →
3. generateMeal(mealInputs)
   File: src/lib/services/generator.ts
   - supabase.functions.invoke("pt-meal-generator", { body: { mealInputs } })
   →
4. Edge fn: pt-meal-generator
   File: supabase/functions/pt-meal-generator/index.ts
   - POST body: { mealInputs, model? }
   - Normalizes mealInputs (dietaryPreference, caloriesTargetPerDay, mealsPerDay, days, dietGoal, budgetTier, allergies, restrictions, etc.)
   - Allergy expansion (user terms → DB codes), diet filtering
   - AI: 2-call flow (meal concepts + scaling, then recipes); uses FOODS_DATA_LEAN / food-map.lean, grocery_rules_uk.json
   - budgetTier and unit conversion in grocery builder (buildGroceryListFromPlan, _shared/grocery-builder.ts)
   - Returns: { mealPlan, grocerySections, groceryTotals, notes }
   →
5. actions.ts builds contentJson = { ...mealPlan, grocerySections, groceryTotals, meta: { coachMessage: "" } }
   →
6. createPlan({ client_id, plan_type: "meal", content_json: contentJson })
   File: src/lib/services/plans.ts → inserts into public.plans
```

### Pipeline (non-template path: New Meal Plan form)

```
1. UI: Client → "New Meal Plan" → MealPlanNewForm
   File: src/app/pt/app/clients/[id]/meals/new/MealPlanNewForm.tsx
   - initialMealInputs from client.presets_json?.meal or meal_inputs_last_used (new page passes from getClientById)
   →
2. No service fn; client builds mealInputs from form (dietaryPreference, caloriesTargetPerDay, mealsPerDay, days, dietGoal, budgetTier, allergies, restrictions)
   →
3. supabase.functions.invoke("pt-meal-generator", { body: { mealInputs } }) (browser)
   →
4. Same edge fn as above
   →
5. Response → sessionStorage (mealPlan, grocerySections, groceryTotals, mealInputs)
   →
6. router.push to .../meals/review → user confirms → createPlan() with same content shape (review page)
```

---

## PART 4 — Templates: what they are today

### A) Are templates used only for metadata (diet / meals/day / days / goal)?

**Yes.** Templates are used only as preset metadata. The only JSON on a meal template is `defaults`. There is no `structure_json` or `content_json` on `pt_meal_templates`. The merge in `mergeMealInputs` uses:

- From template: `dietaryPreference`, `mealsPerDay`, `days`, `dietGoal` (and in practice built-ins also store `caloriesTargetPerDay`, `budgetTier`, `allergies`, `restrictions` in defaults, but the canonical “structure” in code is the four above).
- From client: `caloriesTargetPerDay`, `budgetTier`, `allergies`, `restrictions`.

So templates are “preset selectors” for diet, meals/day, days, and goal; they do not contain pre-baked meal structure or content.

### B) Do templates contain structure_json / content_json that affect generation?

**No.** The table has only `defaults`. No code reads `structure_json` or `content_json` from meal templates. Generation is driven entirely by the merged `mealInputs` object passed to `pt-meal-generator`.

### C) Where is template JSON merged with client presets?

**Single place:** `src/app/templates/meals/actions.ts`, function `mergeMealInputs(templateDefaults, clientPresets, overrides)`:

- Structure defaults: `MEAL_STRUCTURE_DEFAULTS` (dietaryPreference, mealsPerDay, days, dietGoal); overridden by `templateDefaults.*`.
- Constraint defaults: `MEAL_CONSTRAINT_DEFAULTS` (caloriesTargetPerDay, budgetTier, allergies, restrictions); overridden by `clientPresets.*` (client’s `presets_json.meal`).
- Optional `overrides` can override any key.

The result is passed to `generateMeal(mealInputs)` and then to `pt-meal-generator`. So templates are used only as one input to this merge; they do not bypass the generator.

**If templates were not used in generation:** The only integration point that would be missing is: “when generating for a client who has an assigned meal program, use that program’s defaults as the structure.” That is exactly what `assignMealTemplateToClient` does today.

---

## PART 5 — Recommended architecture (single source of truth)

- **Template** = preset selector: diet, mealsPerDay, days, goal; optional style (e.g. budget tier) in defaults. No meal structure or pre-generated content.
- **Client presets** = personal constraints: caloriesTargetPerDay, budgetTier, allergies, restrictions (and optionally cookingTime). Persist constraints-only in `presets_json.meal` where desired.
- **Generator** = single engine: accepts one merged `mealInputs` object; produces plan + grocerySections + groceryTotals.
- **Plan** = saved instance in `plans.content_json`.

### Canonical input to meal generator

`MealGenerationInput = merge(templatePreset, clientPreset, overrides)`

| Key | Source | Notes |
|-----|--------|--------|
| dietaryPreference | Template | Required; from template.defaults |
| mealsPerDay | Template | Required; from template.defaults |
| days | Template | Required; from template.defaults |
| dietGoal | Template | Required; from template.defaults |
| caloriesTargetPerDay | Client | From client.presets_json.meal (or default 2000) |
| budgetTier | Client | From client.presets_json.meal |
| allergies | Client | From client.presets_json.meal |
| restrictions | Client | From client.presets_json.meal |
| (any of above) | Overrides | Optional runtime overrides when calling assign/generate |

### Proposed single service function

- **Name:** `generateMealDraftFromTemplate({ clientId, mealTemplateId, overrides? })`
- **Behaviour:** Load template and client; merge with `mergeMealInputs(template.defaults, client.presets_json?.meal, overrides)`; call `generateMeal(merged)`; return generator result (and optionally save plan in same function or let caller call `createPlan`). This is effectively what `assignMealTemplateToClient` already does; the main improvement is to expose one clearly named API and ensure all template-based entry points use it.

---

## PART 6 — Fix list (prioritized)

1. **Single named API for template-based generation**  
   - **Files:** `src/app/templates/meals/actions.ts`  
   - **Change:** Keep `assignMealTemplateToClient` as the implementation but add (or rename to) `generateMealDraftFromTemplate({ clientId, mealTemplateId, overrides? })` that returns `{ planId }` after creating the plan, and have all callers use this name in docs/comments. Optionally add a variant that returns the draft without saving, for a future “preview” flow.  
   - **Why:** One clear entry point for “generate meal from template + client.”

2. **Non-template path: use server-side generateMeal for consistency**  
   - **Files:** `src/app/pt/app/clients/[id]/meals/new/MealPlanNewForm.tsx`  
   - **Change:** Replace direct `supabase.functions.invoke("pt-meal-generator", ...)` with a server action that calls `generateMeal(mealInputs)` (from `src/lib/services/generator.ts`), so auth and error handling are consistent and the generator is only called from the server for logged-in PTs.  
   - **Why:** Single path to the edge function from the app; no duplicate client-side invoke.

3. **Align client presets persistence with merge expectations**  
   - **Files:** `src/types/presets.ts`, `src/app/pt/app/clients/[id]/edit/actions.ts`, `src/app/pt/app/clients/new/actions.ts`  
   - **Current:** Client create/edit persist `presetsToConstraintsOnly` (meal: only caloriesTargetPerDay, budgetTier, allergies, restrictions). Merge in actions uses `client.presets_json?.meal` for those four; structure always comes from template when using assign.  
   - **Change:** Document that when no template is used (e.g. New Meal Plan form), structure comes from form/initialMealInputs; when template is used, structure comes from template. No schema change required if this contract is explicit. Optionally allow storing full MealPreset for clients who are edited in ClientPresetsEditor (so UI can show diet/mealsPerDay/days/dietGoal) while still merging so template wins for structure when present.  
   - **Why:** Clear single source of truth: template = structure, client = constraints for template-based flow.

4. **Schema / column naming**  
   - **Finding:** No `structure_json` on `pt_meal_templates`; only `defaults` exists. No change needed for meal templates.  
   - **Note:** For workout templates, `structure_json` was removed in a prior fix; `pt_templates` uses `blueprint_json` only.

5. **Duplicate generation paths to consolidate**  
   - **Current:** (a) Template-based: `assignMealTemplateToClient` → `generateMeal` → edge function → `createPlan`. (b) New Meal Plan form: direct invoke from browser → sessionStorage → review → `createPlan`.  
   - **Change:** After fix #2, both paths call the same server-side `generateMeal`; only (a) uses template + client merge, (b) uses form + optional client presets as initial. No second code path for calling the edge function.

6. **Optional: assign modal overrides**  
   - **Files:** `src/app/templates/meals/TemplatesMealsContent.tsx`, `src/app/templates/meals/actions.ts`  
   - **Change:** If the Assign modal does not already pass overrides, add optional overrides (e.g. calories, diet) into the modal and pass them to `assignMealTemplateToClient(templateId, clientId, overrides)`.  
   - **Why:** Lets PT tweak the merged input without editing the client preset.

---

## Summary for Cursor output

**Current flow in 5 lines**

1. Template-based: Assign (or “Generate meal plan” / job) → `assignMealTemplateToClient` merges template.defaults + client.presets_json.meal → `generateMeal(merged)` → `pt-meal-generator` → `createPlan`.  
2. Non-template: New Meal Plan form → form inputs (prefilled from client presets or last used) → direct browser invoke of `pt-meal-generator` → sessionStorage → review → `createPlan`.

**Where templates plug in today**

Templates plug in only in the template-based path. `mergeMealInputs` in `src/app/templates/meals/actions.ts` takes template.defaults (diet, mealsPerDay, days, dietGoal) and client presets (calories, budget, allergies, restrictions), and optionally overrides. The result is the single input to the meal generator. Templates do not hold meal structure or content; they only supply preset fields.

**Top 3 fixes**

1. **Single named API:** Expose/rename to `generateMealDraftFromTemplate({ clientId, mealTemplateId, overrides? })` and document it as the only template-based meal generation entry point.  
2. **No direct browser invoke:** Route New Meal Plan form through a server action that calls `generateMeal(mealInputs)` so all generation goes through the server and one path to `pt-meal-generator`.  
3. **Document and align presets:** Document that template = structure, client = constraints for template-based generation; keep persisting constraints-only for client presets where appropriate, and ensure merge logic and UI are aligned.
