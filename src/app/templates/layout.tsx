import type { ReactNode } from "react";
import PtShell from "@/components/pt/PtShell";

export default function TemplatesLayout({ children }: { children: ReactNode }) {
  return <PtShell>{children}</PtShell>;
}
