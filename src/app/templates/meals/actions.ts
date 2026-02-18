"use server";

import { redirect } from "next/navigation";
import { getSubscriptionStatus } from "@/lib/services/subscription";
import { getMealTemplateById } from "@/lib/services/meal-templates";
import { getClientById } from "@/lib/services/clients";
import { generateMeal } from "@/lib/services/generator";
import { createPlan } from "@/lib/services/plans";

/** Required keys for pt-meal-generator. Template provides structure; client provides constraints. */
const REQUIRED_MEAL_INPUTS_KEYS = [
  "dietaryPreference",
  "mealsPerDay",
  "days",
  "dietGoal",
  "caloriesTargetPerDay",
  "budgetTier",
  "allergies",
  "restrictions",
] as const;

export type CanonicalMealInputs = {
  dietaryPreference: string;
  mealsPerDay: number;
  days: number;
  dietGoal: string;
  caloriesTargetPerDay: number;
  budgetTier: string;
  allergies: string[];
  restrictions: string[];
};

/** Normalize merged object so generator receives correct types (string[] for allergies/restrictions, number for calories, lowercase budgetTier). */
function normalizeMealInputsPayload(raw: Record<string, unknown>): CanonicalMealInputs {
  const allergies = Array.isArray(raw.allergies)
    ? raw.allergies.map(String).filter(Boolean)
    : typeof raw.allergies === "string"
      ? raw.allergies.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [];
  const restrictions = Array.isArray(raw.restrictions)
    ? raw.restrictions.map(String).filter(Boolean)
    : typeof raw.restrictions === "string"
      ? raw.restrictions.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [];
  const budgetTier = String(raw.budgetTier ?? "medium").toLowerCase();
  const validBudget = ["low", "medium", "high"].includes(budgetTier) ? budgetTier : "medium";
  return {
    dietaryPreference: String(raw.dietaryPreference ?? "balanced"),
    mealsPerDay: Number(raw.mealsPerDay) || 4,
    days: Number(raw.days) || 7,
    dietGoal: String(raw.dietGoal ?? "maintain"),
    caloriesTargetPerDay: Number(raw.caloriesTargetPerDay) || 2000,
    budgetTier: validBudget,
    allergies,
    restrictions,
  };
}

/** Dev-safe: throw if any required key is missing; log mealInputs once in development. */
function assertMealInputs(mealInputs: Record<string, unknown>): asserts mealInputs is CanonicalMealInputs {
  const missing = REQUIRED_MEAL_INPUTS_KEYS.filter((k) => mealInputs[k] === undefined || mealInputs[k] === null);
  if (missing.length > 0) {
    throw new Error(`Invalid mealInputs: missing keys: ${missing.join(", ")}`);
  }
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.log("[meal generation] mealInputs payload:", JSON.stringify(mealInputs, null, 2));
  }
}

/** Structure keys: from program only. Constraint keys: from client only. */
const MEAL_STRUCTURE_DEFAULTS = {
  dietaryPreference: "balanced",
  mealsPerDay: 4,
  days: 7,
  dietGoal: "maintain",
} as const;

const MEAL_CONSTRAINT_DEFAULTS = {
  caloriesTargetPerDay: 2000,
  budgetTier: "medium",
  allergies: [] as string[],
  restrictions: [] as string[],
};

function mergeMealInputs(
  templateDefaults: Record<string, unknown>,
  clientPresets: Record<string, unknown> | undefined,
  overrides: Record<string, unknown> | undefined
): Record<string, unknown> {
  // Structure from program (template) only
  const structure = { ...MEAL_STRUCTURE_DEFAULTS };
  if (templateDefaults?.dietaryPreference != null) structure.dietaryPreference = String(templateDefaults.dietaryPreference);
  if (templateDefaults?.mealsPerDay != null) structure.mealsPerDay = Number(templateDefaults.mealsPerDay) || 4;
  if (templateDefaults?.days != null) structure.days = Number(templateDefaults.days) || 7;
  if (templateDefaults?.dietGoal != null) structure.dietGoal = String(templateDefaults.dietGoal);

  // Constraints from client only (with defaults)
  const constraints = { ...MEAL_CONSTRAINT_DEFAULTS };
  const client = clientPresets && typeof clientPresets === "object" ? clientPresets : {};
  if (client.caloriesTargetPerDay != null) constraints.caloriesTargetPerDay = Number(client.caloriesTargetPerDay) || 2000;
  if (client.budgetTier != null) constraints.budgetTier = String(client.budgetTier);
  if (client.allergies != null) constraints.allergies = Array.isArray(client.allergies) ? client.allergies.map(String) : [];
  if (client.restrictions != null) constraints.restrictions = Array.isArray(client.restrictions) ? client.restrictions.map(String) : [];

  // Optional overrides can override either (e.g. one-off generation tweaks)
  const merged = { ...structure, ...constraints };
  if (overrides && typeof overrides === "object") {
    if (overrides.dietaryPreference != null) merged.dietaryPreference = String(overrides.dietaryPreference);
    if (overrides.mealsPerDay != null) merged.mealsPerDay = Number(overrides.mealsPerDay) || 4;
    if (overrides.days != null) merged.days = Number(overrides.days) || 7;
    if (overrides.dietGoal != null) merged.dietGoal = String(overrides.dietGoal);
    if (overrides.caloriesTargetPerDay != null) merged.caloriesTargetPerDay = Number(overrides.caloriesTargetPerDay) || 2000;
    if (overrides.budgetTier != null) merged.budgetTier = String(overrides.budgetTier);
    if (overrides.allergies != null) merged.allergies = Array.isArray(overrides.allergies) ? overrides.allergies.map(String) : [];
    if (overrides.restrictions != null) merged.restrictions = Array.isArray(overrides.restrictions) ? overrides.restrictions.map(String) : [];
  }
  return merged;
}

export async function assignMealTemplateToClient(
  templateId: string,
  clientId: string,
  overrides?: Record<string, unknown>
) {
  const subscription = await getSubscriptionStatus();
  if (!subscription.allowed) {
    redirect("/pt/app/billing?reason=subscription_required");
  }

  const [template, client] = await Promise.all([
    getMealTemplateById(templateId),
    getClientById(clientId),
  ]);

  if (!template) throw new Error("Meal template not found");
  if (!client) throw new Error("Client not found");

  const merged = mergeMealInputs(
    template.defaults as Record<string, unknown>,
    client.presets_json?.meal as Record<string, unknown> | undefined,
    overrides
  );
  const mealInputs = normalizeMealInputsPayload(merged);
  assertMealInputs(mealInputs);

  const result = await generateMeal(mealInputs);
  const mealPlan = result.mealPlan ?? result;
  const grocerySections = result.grocerySections ?? [];
  const groceryTotals = result.groceryTotals ?? {};

  const contentJson = {
    ...mealPlan,
    grocerySections,
    groceryTotals,
    meta: { coachMessage: "" },
  };

  const plan = await createPlan({
    client_id: clientId,
    plan_type: "meal",
    content_json: contentJson,
  });

  return { planId: plan.id };
}

/**
 * Single canonical entry for meal plan generation. Template-only: requires client.assigned_meal_program_id.
 * Merges template.defaults (structure) + client.presets_json.meal (constraints) → generateMeal → createPlan.
 */
export async function generateMealPlanForClient(clientId: string, overrides?: Record<string, unknown>) {
  const client = await getClientById(clientId);
  if (!client) throw new Error("Client not found");
  const assignedId = (client as { assigned_meal_program_id?: string | null }).assigned_meal_program_id;
  if (!assignedId) {
    throw new Error("Assign a Meal Program to this client before generating.");
  }
  const { planId } = await assignMealTemplateToClient(assignedId, clientId, overrides);
  redirect(`/pt/app/plans/${planId}`);
}

/** Form action wrapper: reads clientId from form and runs generateMealPlanForClient. */
export async function generateMealPlanFormAction(formData: FormData) {
  "use server";
  const clientId = formData.get("clientId");
  if (typeof clientId === "string" && clientId) await generateMealPlanForClient(clientId);
}
