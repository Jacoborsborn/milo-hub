import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Sends an email OTP for signup. For users to receive a 6-digit code (not a magic link),
 * in Supabase Dashboard go to: Authentication → Email Templates → "Magic Link"
 * and use {{ .Token }} in the body (e.g. "Your code: {{ .Token }}") instead of
 * {{ .ConfirmationURL }}. Our verify-otp route uses type: "email" to verify the token.
 */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch (e) {
    console.error("[send-otp] Body parse error:", e);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  console.log("[send-otp] Request for email:", email.replace(/(.{2}).*@/, "$1***@"));

  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  console.log("[supabase api/auth/send-otp] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
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

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.error("[send-otp] Supabase error:", error.message, error.status);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send OTP failed";
    console.error("[send-otp] Unexpected error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
