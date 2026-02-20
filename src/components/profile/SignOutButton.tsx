"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const LANDING_ROUTE = "/";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await supabaseBrowser().auth.signOut();
      router.replace(LANDING_ROUTE);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="inline-flex w-full items-center justify-center rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 sm:w-auto"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
