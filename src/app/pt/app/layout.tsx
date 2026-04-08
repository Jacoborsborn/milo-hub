import type { ReactNode } from "react";
import { Suspense } from "react";
import PtShell from "@/components/pt/PtShell";

// Avoid prerendering auth-dependent pages at build time (no Supabase env required).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PtAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
      <PtShell>{children}</PtShell>
    </Suspense>
  );
}
