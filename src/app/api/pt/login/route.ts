import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { assertSupabaseEnv } from "@/lib/supabase/env";

function isTrialActive(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  const t = Date.parse(trialEndsAt);
  if (!Number.isFinite(t)) return false;
  return t > Date.now();
}

export async function POST(req: Request) {
  let body: { email?: string; password?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Missing email or password" },
      { status: 400 }
    );
  }

  const { url, anonKey } = assertSupabaseEnv();
  const cookieStore = await cookies();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: "Invalid login details" },
      { status: 400 }
    );
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", data.user.id)
    .single();

  if (profErr || !profile) {
    return NextResponse.json(
      { success: true, redirect: "/pt/app/tutorial" },
      { status: 200 }
    );
  }

  const status = String(profile.subscription_status ?? "");
  const trialOk = isTrialActive(profile.trial_ends_at ?? null);
  const hasAccess =
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    trialOk;

  const next = String(body?.next ?? "").trim();
  if (next && next.startsWith("/pt/app") && hasAccess) {
    return NextResponse.json({ success: true, redirect: next }, { status: 200 });
  }

  const redirectTo = hasAccess ? "/pt/app/tutorial" : "/pt/app/billing";
  return NextResponse.json({ success: true, redirect: redirectTo }, { status: 200 });
}
