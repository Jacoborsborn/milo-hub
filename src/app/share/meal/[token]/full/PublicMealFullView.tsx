"use client";

import { useEffect } from "react";
import Link from "next/link";
import MealPlanRenderer from "@/components/MealPlanRenderer";
import PublicMealShoppingView from "../shopping/PublicMealShoppingView";

type Plan = {
  id: string;
  content_json: Record<string, unknown>;
  created_at: string;
};

export default function PublicMealFullView({
  plan,
  token,
  coachDisplayName,
  weekCommencing,
}: {
  plan: Plan;
  token: string;
  coachDisplayName: string;
  weekCommencing: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      window.print();
    }
  }, []);

  return (
    <div className="min-h-screen bg-white print:bg-white">
      <div className="max-w-xl mx-auto px-4 py-6 print:py-6">
        <h1 className="text-xl font-semibold text-neutral-900 mb-1">Your Meal Plan</h1>
        <p className="text-sm text-neutral-500">Week commencing: {weekCommencing}</p>
        <p className="text-sm text-neutral-500 mb-4">Prepared by: {coachDisplayName}</p>

        <div className="text-base" style={{ fontSize: "14px" }}>
          <MealPlanRenderer data={plan.content_json} hideGrocery shareToken={token} />
        </div>

        <div className="break-before-page mt-8 pt-8" style={{ pageBreakBefore: "always" }}>
          <PublicMealShoppingView plan={plan} token={token} hideBackLink embedded />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pb-8 print:hidden">
        <Link
          href={`/share/meal/${token}`}
          className="text-sm font-medium text-neutral-700 underline hover:no-underline"
        >
          ← Back to meal plan
        </Link>
      </div>
    </div>
  );
}
