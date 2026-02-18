import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip if env vars are missing
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // If trying to access protected route without env vars, redirect to login
    if (path.startsWith("/pt/app")) {
      const url = request.nextUrl.clone();
      url.pathname = "/pt/auth/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // keep session fresh + cookies synced
  const response = await updateSession(request);

  // create supabase client using the *updated* response cookie handler
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

  // If already authed, keep them out of login
  if (path === "/pt/auth/login" && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/pt/app";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/pt/app/:path*",
    "/pt/auth/login",
  ],
};
