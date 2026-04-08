import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./lib/supabase/env";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const env = getSupabaseEnv();

  if (!env) {
    if (path.startsWith("/pt/app")) {
      const url = request.nextUrl.clone();
      url.pathname = "/pt/auth/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const response = await updateSession(request);

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

  const { data } = await supabase.auth.getUser();
  const isAuthed = !!data.user;

  // Protect app routes (billing gate comes later)
  if (path.startsWith("/pt/app") && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/pt/auth/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

// Only protect /pt/app. Do NOT match /pt/auth/login so that route is never touched
// (no cookie/session access on load — safe for iOS Safari and in-app browsers).
export const config = {
  matcher: ["/pt/app/:path*"],
};
