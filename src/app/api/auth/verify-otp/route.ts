import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~;]/.test(password))
    return "Password must include at least one special character.";
  return null;
}

export async function POST(req: Request) {
  const body = await req.json();

  const email = String(body?.email ?? "").trim().toLowerCase();
  const token = String(body?.code ?? "").trim();
  const password = String(body?.password ?? "");

  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  const businessName = String(body?.businessName ?? "").trim();
  const coachingFocus = String(body?.coachingFocus ?? "general").trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!/^\d{6,8}$/.test(token)) {
    return NextResponse.json({ error: "Enter a valid 6–8 digit code." }, { status: 400 });
  }

  const pwErr = validatePassword(password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  console.log("[supabase api/auth/verify-otp] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  const supabase = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore
          }
        },
      },
    }
  );

  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 400 });
  }

  const { error: updUserErr } = await supabase.auth.updateUser({ password });
  if (updUserErr) return NextResponse.json({ error: updUserErr.message }, { status: 400 });

  const fullName = `${firstName} ${lastName}`.trim();

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      business_name: businessName || null,
      coaching_focus: coachingFocus || null,
    })
    .eq("id", verifyData.user!.id);

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
