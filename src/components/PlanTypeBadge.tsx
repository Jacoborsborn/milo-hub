type PlanType = "workout" | "meal";

export default function PlanTypeBadge({ planType }: { planType: PlanType }) {
  const isWorkout = planType === "workout";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isWorkout
          ? "bg-sky-100 text-sky-800 border border-sky-200"
          : "bg-amber-100 text-amber-800 border border-amber-200"
      }`}
      aria-label={`Plan type: ${planType}`}
    >
      {isWorkout ? "Workout" : "Meal"}
    </span>
  );
}
