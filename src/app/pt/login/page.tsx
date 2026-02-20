"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

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

function LoginFormFallback() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
          <div className="inline-flex h-11 w-64 animate-pulse rounded-[10px] bg-slate-200" />
          <div className="mt-4 inline-flex h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-6 space-y-4">
            <div className="h-11 w-full animate-pulse rounded-[10px] bg-slate-100" />
            <div className="h-11 w-full animate-pulse rounded-[10px] bg-slate-100" />
            <div className="h-11 w-full animate-pulse rounded-[10px] bg-slate-100" />
          </div>
        </div>
      </div>
    </main>
  );
}

function PtLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = searchParams?.get("next")?.trim() ?? "";
  const sessionId = searchParams?.get("session_id")?.trim() ?? "";
  const successParam = searchParams?.get("success") ?? "";

  const urlError = searchParams?.get("error");
  const initialError = urlError ? decodeURIComponent(urlError) : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  const nextValue =
    nextPath && sessionId && nextPath.startsWith("/pt/app/tutorial")
      ? `/pt/app/tutorial?success=${encodeURIComponent(successParam || "true")}&session_id=${encodeURIComponent(sessionId)}`
      : nextPath ||
        (successParam && sessionId
          ? `/pt/app/tutorial?success=${encodeURIComponent(successParam || "true")}&session_id=${encodeURIComponent(sessionId)}`
          : "") ||
        "";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/pt/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            ...(nextValue ? { next: nextValue } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? "Login failed.");
          setLoading(false);
          return;
        }
        if (data?.redirect) {
          router.push(data.redirect);
          return;
        }
        router.push("/pt/app");
      } catch {
        setError("Login failed.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, nextValue, router]
  );

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-6 py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
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

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <div className="text-sm font-semibold text-slate-900">Email</div>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="••••••••"
                />
              </label>

              {nextValue ? <input type="hidden" name="next" value={nextValue} /> : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Logging in…" : "Log in"}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                New here?{" "}
                <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
                  Start free trial
                </Link>
              </div>
            </form>
          </div>

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

export default function PtLoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <PtLoginForm />
    </Suspense>
  );
}
