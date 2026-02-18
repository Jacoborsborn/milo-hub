import { createBrowserClient } from "@supabase/ssr";

// Singleton Supabase client for browser use
// This ensures only one GoTrueClient instance exists in the browser context
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseClient() {
  // Only create client in browser environment
  if (typeof window === "undefined") {
    throw new Error("Browser Supabase client should not be used on the server");
  }

  // Return existing instance if already created
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Create new instance
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  // Dev-only: Log Supabase URL to verify configuration
  if (process.env.NODE_ENV === "development") {
    console.log("[Supabase Config] URL:", supabaseUrl);
    console.log("[Supabase Config] Expected:", "https://cbufoyjjjmaimmzmwrpr.supabase.co");
    if (supabaseUrl !== "https://cbufoyjjjmaimmzmwrpr.supabase.co") {
      console.warn("[Supabase Config] ⚠️ URL mismatch! Check .env.local");
    }
  }

  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
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
