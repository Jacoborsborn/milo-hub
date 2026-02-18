"use client";

import { typography } from "@/styles/design-tokens";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className={typography.cardTitle}>{title}</h2>
      {subtitle && <p className={`${typography.muted} mt-0.5`}>{subtitle}</p>}
    </div>
  );
}
