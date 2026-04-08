"use client";

import { Suspense } from "react";
import PtLoginForm, { LoginFormFallback } from "@/components/pt/PtLoginForm";

export default function PtLoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <PtLoginForm />
    </Suspense>
  );
}
