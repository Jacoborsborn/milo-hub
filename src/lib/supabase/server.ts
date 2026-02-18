import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { assertSupabaseEnv } from "./env";

/**
 * Server Supabase client. Only creates client when called (at request time).
 * Does not throw at import time; throws only when invoked and env is missing.
 */
export const supabaseServer = async () => {
  const { url, anonKey } = assertSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
};
