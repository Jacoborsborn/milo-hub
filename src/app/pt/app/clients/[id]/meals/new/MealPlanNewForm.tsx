"use client";

import { useState } from "react";
import Link from "next/link";
import { generateMealPlanForClient } from "@/app/templates/meals/actions";

/**
 * Template-only meal plan generation.
 * Requires client.assigned_meal_program_id. No direct pt-meal-generator invoke.
 */
export default function MealPlanNewForm({
  clientId,
  hasAssignedMealProgram,
}: {
  clientId: string;
  hasAssignedMealProgram: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      await generateMealPlanForClient(clientId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate meal plan");
    } finally {
      setLoading(false);
    }
  };

  if (!hasAssignedMealProgram) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-medium text-amber-900">
          Assign a Meal Program to this client before generating.
        </p>
        <p className="mt-2 text-sm text-amber-800">
          Go to <strong>Programs → Meals</strong> to assign a meal program to this client, or set one from the client page.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/templates?tab=meals"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Programs → Meals
          </Link>
          <Link
            href={`/pt/app/clients/${clientId}`}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Back to Client
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-neutral-600">
        Generate a meal plan using this client&apos;s assigned meal program and their saved defaults (calories, budget, allergies, restrictions).
      </p>
      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="min-h-[48px] rounded-lg bg-neutral-800 px-6 py-3 text-white font-medium disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate meal plan"}
      </button>
    </div>
  );
}
