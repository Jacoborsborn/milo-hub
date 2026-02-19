import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );
}

function isTrialActive(trialEndsAt: string | null) {
  if (!trialEndsAt) return false;
  const t = Date.parse(trialEndsAt);
  if (!Number.isFinite(t)) return false;
  return t > Date.now();
}

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/pt/login?error=Missing%20email%20or%20password");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    redirect("/pt/login?error=Invalid%20login%20details");
  }

  // After login, route based on access.
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", data.user.id)
    .single();

  if (profErr || !profile) {
    redirect("/pt/app/tutorial");
  }

  const status = String(profile.subscription_status ?? "");
  const trialOk = isTrialActive(profile.trial_ends_at ?? null);

  const hasAccess =
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    trialOk;

  const next = String(formData.get("next") ?? "").trim();
  if (next && next.startsWith("/pt/app") && hasAccess) {
    redirect(next);
  }
  redirect(hasAccess ? "/pt/app/tutorial" : "/pt/app/billing");
}

export default async function PtLoginPage({
  searchParams,
}: {
  searchParams?: { error?: string; next?: string; success?: string; session_id?: string } | Promise<{ error?: string; next?: string; success?: string; session_id?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  const params = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const nextPath = params?.next?.trim();
  const sessionId = params?.session_id?.trim();
  const successParam = params?.success;

  if (userData?.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, trial_ends_at")
      .eq("id", userData.user.id)
      .single();

    const status = String(profile?.subscription_status ?? "");
    const trialOk = isTrialActive(profile?.trial_ends_at ?? null);

    const hasAccess =
      status === "active" || status === "trialing" || status === "past_due" || trialOk;

    if (hasAccess && nextPath?.startsWith("/pt/app")) {
      redirect(nextPath);
    }
    redirect(hasAccess ? "/pt/app/tutorial" : "/pt/app/billing");
  }

  const error = params?.error ? decodeURIComponent(params.error) : null;
  const nextValue =
    nextPath && sessionId && nextPath.startsWith("/pt/app/tutorial")
      ? `/pt/app/tutorial?success=${encodeURIComponent(successParam || "true")}&session_id=${encodeURIComponent(sessionId)}`
      : nextPath || (successParam && sessionId ? `/pt/app/tutorial?success=${encodeURIComponent(successParam || "true")}&session_id=${encodeURIComponent(sessionId)}` : "") || "";

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-6 py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          {/* Left: Login card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
            <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-slate-600">
              PT LOGIN
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Log in to manage clients, generate plans, and run automations.
            </p>

            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form action={loginAction} className="mt-6 space-y-4">
              {nextValue ? <input type="hidden" name="next" value={nextValue} /> : null}
              <label className="block">
                <div className="text-sm font-semibold text-slate-900">Email</div>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="you@company.com"
                />
              </label>

              <label className="block">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Password</div>
                  <Link
                    href="/pt/auth/reset"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Forgot?
                  </Link>
                </div>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="••••••••"
                />
              </label>

              <button
                type="submit"
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-blue-700"
              >
                Log in
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                New here?{" "}
                <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
                  Start free trial
                </Link>
              </div>
            </form>
          </div>

          {/* Right: Value panel (matches signup styling) */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
            <h2 className="text-lg font-semibold text-slate-900">What you get</h2>

            <div className="mt-4 space-y-3">
              <ValueRow
                title="Back-to-back plan drafting"
                desc="Queue multiple plans without waiting. Keep moving while drafts generate."
              />
              <ValueRow
                title="Automation scheduling"
                desc="Set weekly creation day. Drafts appear ready for review and sending."
              />
              <ValueRow
                title="Remote scale without chaos"
                desc="Structured layouts clients understand. Less admin, more coaching."
              />
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Fast path after login</p>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                If your trial is active, you&apos;ll land straight in the tutorial and start building your first client plan.
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500">
              Need help? Check the Tutorial after login or contact support.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ValueRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-sm leading-6 text-slate-600">{desc}</div>
      </div>
    </div>
  );
}
