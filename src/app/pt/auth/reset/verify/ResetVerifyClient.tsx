"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[!@#$%^&*(),.?\":{}|<>_\-+=/\\[\]`~;]/.test(password))
    return "Password must include at least one special character.";
  return null;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function ResetVerifyClient() {
  const router = useRouter();
  const params = useSearchParams();

  const email = params.get("email") || "";

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const codeValid = useMemo(() => /^\d{6,8}$/.test(code), [code]);

  async function verify() {
    setErr(null);
    if (!email) return setErr("Missing email. Go back and request a new code.");
    if (!codeValid) return setErr("Enter a valid 6–8 digit code.");

    const pwErr = validatePassword(password);
    if (pwErr) return setErr(pwErr);
    if (password !== confirm) return setErr("Passwords do not match.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          password,
          confirmPassword: confirm,
        }),
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.error ?? "Reset failed.");
      }

      router.push("/pt/login?error=Password%20updated.%20Please%20log%20in.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Reset failed.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[760px] px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.06)]">
          <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-slate-600">
            VERIFY RESET CODE
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Set a new password
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter the 6–8 digit code sent to <span className="font-semibold text-slate-900">{email}</span>.
          </p>

          {err && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
          >
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Code</div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                inputMode="numeric"
                className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Enter code"
              />
              <div className="mt-2 text-xs text-slate-500">Code can be 6 to 8 digits.</div>
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">New password</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="••••••••"
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Confirm password</div>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Updating password..." : "Update password"}
            </button>

            <div className="text-center text-xs text-slate-500">
              Need a new code?{" "}
              <Link href="/pt/auth/reset" className="font-semibold text-blue-600 hover:text-blue-700">
                Resend code
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
