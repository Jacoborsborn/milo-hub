"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PlanTypeBadge from "@/components/PlanTypeBadge";
import type { Plan } from "@/types/database";

function planSummary(plan: Plan): string {
  const c = plan.content_json;
  if (!c || typeof c !== "object") return `${plan.plan_type} plan`;
  if (plan.plan_type === "meal") {
    const days = c.days as { day_label?: string }[] | undefined;
    if (Array.isArray(days) && days.length > 0) {
      return `${days.length} day(s)`;
    }
    return "Meal plan";
  }
  const weeks = c.weeks as { week?: number; days?: { day_index?: number; focus?: string }[] }[] | undefined;
  const firstWeek = Array.isArray(weeks) ? weeks[0] : undefined;
  const firstDay = firstWeek?.days?.[0];
  if (firstWeek != null && firstDay != null) {
    const w = firstWeek.week ?? 1;
    const d = firstDay.day_index ?? 1;
    const focus = firstDay.focus ? ` • ${String(firstDay.focus)}` : "";
    return `Week ${w} • Day ${d}${focus}`;
  }
  return "Workout plan";
}

type FilterTab = "all" | "workouts" | "meals";

export default function ClientPlansList({ plans }: { plans: Plan[] }) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filteredPlans = useMemo(() => {
    if (filter === "all") return plans;
    if (filter === "workouts") return plans.filter((p) => p.plan_type === "workout");
    return plans.filter((p) => p.plan_type === "meal");
  }, [plans, filter]);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "#666", textTransform: "uppercase" }}>Plans</h3>
        <div role="tablist" aria-label="Filter plans" style={{ display: "flex", gap: 4 }}>
          {(["all", "workouts", "meals"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filter === tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                border: "1px solid #ccc",
                borderRadius: 4,
                background: filter === tab ? "#0070f3" : "#fff",
                color: filter === tab ? "#fff" : "#333",
                cursor: "pointer",
              }}
            >
              {tab === "all" ? "All" : tab === "workouts" ? "Workouts" : "Meals"}
            </button>
          ))}
        </div>
      </div>
      {filteredPlans.length === 0 ? (
        <p style={{ padding: 12, background: "#f9f9f9", borderRadius: 4, color: "#666", margin: 0 }}>
          {plans.length === 0 ? "No plans yet." : `No ${filter === "workouts" ? "workout" : "meal"} plans.`}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              style={{
                padding: 12,
                background: "#f9f9f9",
                borderRadius: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <PlanTypeBadge planType={plan.plan_type} />
                <span style={{ fontSize: 12, color: "#666" }}>
                  {new Date(plan.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </span>
                <span style={{ color: "#333" }}>{planSummary(plan)}</span>
              </div>
              <Link
                href={`/pt/app/plans/${plan.id}`}
                style={{
                  padding: "6px 12px",
                  background: "#0070f3",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: 4,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                View
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
