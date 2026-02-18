import type { ReactNode } from "react";
import PtShell from "@/components/pt/PtShell";

export default function PtAppLayout({ children }: { children: ReactNode }) {
  return <PtShell>{children}</PtShell>;
}
