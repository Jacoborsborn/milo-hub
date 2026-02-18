"use client";

import { statusColors, type StatusKey } from "@/styles/design-tokens";
import { radii } from "@/styles/design-tokens";

type TagProps = {
  label: string;
  status?: StatusKey;
  /** Neutral badge when status not provided */
  variant?: "status" | "neutral";
};

export default function Tag({ label, status, variant = "neutral" }: TagProps) {
  const styles =
    variant === "status" && status
      ? `${statusColors[status].bg} ${statusColors[status].text} border ${statusColors[status].border}`
      : "bg-neutral-100 text-neutral-600 border border-neutral-200";

  return (
    <span className={`inline-flex shrink-0 ${radii.badge} px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}
