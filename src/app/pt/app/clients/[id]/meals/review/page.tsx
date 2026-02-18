"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

/**
 * Meal plan generation is template-only and saves directly to a plan.
 * There is no draft-in-sessionStorage flow. This page directs users to generate from the client's assigned program.
 */
export default function MealPlanReviewPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id;

  return (
    <div style={{ padding: "0 0 24px", maxWidth: 640 }}>
      <p className="text-neutral-600">
        Meal plans are generated from the client&apos;s assigned meal program and saved directly. There is no draft review step.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Use <strong>Generate meal plan</strong> on the client page or <strong>New Meal Plan</strong> to create a plan from the assigned program.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {clientId && (
          <Link
            href={`/pt/app/clients/${clientId}/meals/new`}
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New Meal Plan
          </Link>
        )}
        {clientId && (
          <Link
            href={`/pt/app/clients/${clientId}`}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Back to Client
          </Link>
        )}
        <Link
          href="/templates?tab=meals"
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Programs → Meals
        </Link>
      </div>
    </div>
  );
}
