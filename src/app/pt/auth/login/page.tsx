import { Suspense } from "react";
import PtLoginForm, { LoginFormFallback } from "@/components/pt/PtLoginForm";

/**
 * Login form only. No server-side auth check, no auto-redirect on load.
 * Safe for iOS Safari and in-app browsers (Meta, etc.).
 * Navigation happens only after user submits the form (API then returns redirect).
 */
export default function PtAuthLoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <PtLoginForm />
    </Suspense>
  );
}
