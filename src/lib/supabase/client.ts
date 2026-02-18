import { supabase } from "./browser";

/**
 * Single Supabase client for browser. Re-exports the same instance as browser.ts
 * so the app uses only one GoTrueClient (avoids "Multiple GoTrueClient instances" warning).
 */
export function supabaseBrowser() {
  return supabase;
}
