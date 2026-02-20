/**
 * Centralized Supabase env access. Never throws at import time.
 * Use getSupabaseEnv() for optional checks; use assertSupabaseEnv() only inside
 * request handlers/actions when you need a client (throws at runtime, not build).
 *
 * Safety: No module in src/lib/supabase or callers should throw on import.
 * Build must succeed without NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY set.
 */

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

/**
 * Returns Supabase env vars or null if missing. Safe to call at build time.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.log("[supabase env.ts getSupabaseEnv] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Returns env or throws. Only call this at runtime inside request handlers/actions,
 * never at module load or during build/prerender.
 */
export function assertSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return env;
}
