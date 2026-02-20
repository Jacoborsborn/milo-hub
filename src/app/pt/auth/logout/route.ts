import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL("/pt/auth/login", req.url));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  console.log("[supabase pt/auth/logout] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  const supabase = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  );

  await supabase.auth.signOut();
  return response;
}
