import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function supa() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[!@#$%^&*(),.?\":{}|<>_\-+=/\\[\]`~;]/.test(password))
    return "Password must include at least one special character.";
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body?.email ?? "").trim().toLowerCase();
    const token = String(body?.code ?? "").trim();
    const password = String(body?.password ?? "");
    const confirm = String(body?.confirmPassword ?? "");

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (!/^\d{6,8}$/.test(token)) {
      return NextResponse.json({ error: "Enter a valid 6–8 digit code." }, { status: 400 });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    if (password !== confirm) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const supabase = await supa();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "recovery",
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data?.user) return NextResponse.json({ error: "Verification failed." }, { status: 400 });

    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Reset failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
