"use client";

import { typography } from "@/styles/design-tokens";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 px-5 py-8 text-center">
      <p className={`${typography.cardTitle} text-neutral-700`}>{title}</p>
      {description && <p className={`${typography.muted} mt-1 max-w-sm mx-auto`}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
