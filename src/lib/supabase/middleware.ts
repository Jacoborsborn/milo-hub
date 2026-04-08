import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const env = getSupabaseEnv();
  console.log("[supabase middleware.ts updateSession] NEXT_PUBLIC_SUPABASE_URL:", env?.url ?? "undefined");
  if (!env) return response;

  const supabase = createServerClient(
    env.url,
    env.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // refresh session if expired (required for server-side auth)
  await supabase.auth.getUser();

  return response;
}
