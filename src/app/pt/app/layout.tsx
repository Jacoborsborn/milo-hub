import type { ReactNode } from "react";
import { Suspense } from "react";
import PtShell from "@/components/pt/PtShell";

export default function PtAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
      <PtShell>{children}</PtShell>
    </Suspense>
  );
}
