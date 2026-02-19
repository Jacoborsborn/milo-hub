import { Suspense } from "react";
import ResetVerifyClient from "./ResetVerifyClient";

export default function ResetVerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-sm text-slate-500">Loading...</p>
        </main>
      }
    >
      <ResetVerifyClient />
    </Suspense>
  );
}
