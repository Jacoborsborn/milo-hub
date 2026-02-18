import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

// Singleton Supabase client for browser use (lazy; never created at import time)
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseClient() {
  if (typeof window === "undefined") {
    throw new Error("Browser Supabase client should not be used on the server");
  }
  if (supabaseInstance) return supabaseInstance;

  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[Supabase Config] URL:", env.url);
  }

  supabaseInstance = createBrowserClient(env.url, env.anonKey);
  return supabaseInstance;
}

// Export lazy singleton - only created when accessed in browser
// Use Proxy to intercept property access and create client on-demand
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    // If it's a function, bind it to the client
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  }
});
