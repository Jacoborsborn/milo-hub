import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function supa() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  console.log("[supabase api/auth/reset/send supa] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  return createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const clean = String(email ?? "").trim().toLowerCase();

    if (!clean || !/^\S+@\S+\.\S+$/.test(clean)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const supabase = await supa();

    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to send code";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
