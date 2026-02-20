"use client";

import { useEffect, useMemo, useState } from "react";
import { trackMetaEvent } from "@/lib/meta";

export default function EmailCodeModal({
  open,
  email,
  onClose,
  onVerified,
  password,
  payload,
}: {
  open: boolean;
  email: string;
  password: string;
  payload: Record<string, string | null>;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = useMemo(() => /^\d{6,8}$/.test(code), [code]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setCode("");
      setErr(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  async function verify() {
    setErr(null);
    if (!valid) return setErr("Enter a valid 6–8 digit code.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          password,
          ...payload,
        }),
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.error ?? "Verification failed.");
      }

      trackMetaEvent("Lead");
      onVerified();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-slate-600">
              VERIFY EMAIL
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Enter the code</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              We sent a {`6–8`} digit code to <span className="font-semibold text-slate-900">{email}</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            ✕
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <label className="mt-5 block">
          <div className="text-sm font-semibold text-slate-900">Code</div>
          <input
            inputMode="numeric"
            pattern="\d*"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="Enter code"
            className="mt-2 h-12 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <div className="mt-2 text-xs text-slate-500">Code can be 6 to 8 digits.</div>
        </label>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={verify}
            disabled={!valid || loading}
            className="h-11 flex-1 rounded-[10px] bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
