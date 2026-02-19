"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const clean = email.trim().toLowerCase();
    if (!clean || !/^\S+@\S+\.\S+$/.test(clean)) {
      setErr("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "Failed to send code. Try again.");
        setLoading(false);
        return;
      }
      router.push(`/pt/auth/reset/verify?email=${encodeURIComponent(clean)}`);
    } catch {
      setErr("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[480px] px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
          <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-slate-600">
            RESET PASSWORD
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            Forgot your password?
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter your email and we’ll send you a code to set a new password.
          </p>

          {err && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="you@company.com"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset code"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            <Link href="/pt/login" className="font-semibold text-blue-600 hover:text-blue-700">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
