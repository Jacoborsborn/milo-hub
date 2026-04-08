"use client";

import { useState } from "react";
import { LegalModal, type LegalModalVariant } from "@/components/ui/LegalModal";
import EmailCodeModal from "@/components/signup/EmailCodeModal";

type Step = 1 | 2;

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  heardFrom: string;
};

const DEFAULT_STATE: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  heardFrom: "other",
};

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~;]/.test(password))
    return "Password must include at least one special character.";
  return null;
}

const HEARD_FROM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "google", label: "Google" },
  { value: "friend", label: "Friend / referral" },
  { value: "reddit", label: "Reddit" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Other" },
];

export default function MiloSignupWizard() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<FormState>(DEFAULT_STATE);
  const [legalModal, setLegalModal] = useState<LegalModalVariant | null>(null);
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [verified, setVerified] = useState(false);

  const progressPct = step === 1 ? 50 : 100;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function validateStep1(): string | null {
    if (!state.firstName.trim()) return "First name is required.";
    if (!state.lastName.trim()) return "Last name is required.";
    if (!state.email.trim()) return "Email is required.";
    if (!/^\S+@\S+\.\S+$/.test(state.email)) return "Enter a valid email.";
    const passwordError = validatePassword(state.password);
    if (passwordError) return passwordError;
    if (state.password !== state.confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function sendOtp(): Promise<void> {
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: state.email }),
    });
    if (!res.ok) {
      const data = await safeJson(res);
      const msg = data?.error ?? data?.message ?? `Failed to send code (${res.status}).`;
      throw new Error(msg);
    }
  }

  async function startMiloCheckout() {
    const res = await fetch("/api/stripe/checkout-milo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ heardFrom: state.heardFrom.trim() || null }),
    });
    if (!res.ok) {
      const data = await safeJson(res);
      throw new Error(data?.error ?? "Failed to start checkout.");
    }
    const data = await res.json();
    if (!data?.url) throw new Error("Checkout URL missing.");
    window.location.href = data.url;
  }

  async function onNext() {
    setErr(null);
    if (step !== 1) return;
    const msg = validateStep1();
    if (msg) return setErr(msg);
    setLoading(true);
    try {
      await sendOtp();
      setPendingEmail(state.email);
      setCodeModalOpen(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function onStartTrial() {
    setErr(null);
    setLoading(true);
    try {
      await startMiloCheckout();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) onNext();
    else onStartTrial();
  }

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Step {step} of 2</span>
          <span>{progressPct}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-orange-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {step === 1 ? (
        <MiloStepOne state={state} update={update} />
      ) : (
        <MiloStepTwo state={state} update={update} />
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (step === 1 ? null : setStep(1))}
          disabled={step === 1 || loading}
          className="h-11 rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Back
        </button>
        {step === 1 ? (
          <button
            type="submit"
            disabled={loading || !agreedToLegal}
            className="h-11 flex-1 rounded-[10px] bg-orange-500 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? "Sending code..." : "Continue"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading || !agreedToLegal || !verified}
            className="h-11 flex-1 rounded-[10px] bg-orange-500 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-orange-600 disabled:opacity-60"
          >
            {loading ? "Starting checkout..." : "Start 7-day trial"}
          </button>
        )}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={agreedToLegal}
          onChange={(e) => setAgreedToLegal(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
        />
        <span>
          I agree to the{" "}
          <button
            type="button"
            onClick={() => setLegalModal("terms")}
            className="cursor-pointer text-orange-600 underline hover:text-orange-700"
          >
            Terms
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => setLegalModal("privacy")}
            className="cursor-pointer text-orange-600 underline hover:text-orange-700"
          >
            Privacy Policy
          </button>
        </span>
      </label>

      <LegalModal
        isOpen={legalModal !== null}
        onClose={() => setLegalModal(null)}
        variant={legalModal ?? "terms"}
      />

      <EmailCodeModal
        open={codeModalOpen}
        email={pendingEmail}
        password={state.password}
        payload={{
          firstName: state.firstName,
          lastName: state.lastName,
          businessName: "",
          coachingFocus: "general",
        }}
        onClose={() => setCodeModalOpen(false)}
        onVerified={() => {
          setCodeModalOpen(false);
          setVerified(true);
          setStep(2);
        }}
      />
    </form>
  );
}

function MiloStepOne({
  state,
  update,
}: {
  state: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">Account details</div>
        <div className="mt-1 text-sm leading-6 text-slate-600">
          Create your account for Milo+. Used for billing and app login.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="First name"
          value={state.firstName}
          onChange={(v) => update("firstName", v)}
          autoComplete="given-name"
        />
        <Field
          label="Surname"
          value={state.lastName}
          onChange={(v) => update("lastName", v)}
          autoComplete="family-name"
        />
      </div>
      <Field
        label="Email"
        value={state.email}
        onChange={(v) => update("email", v)}
        type="email"
        autoComplete="email"
      />
      <label className="block">
        <div className="text-sm font-semibold text-slate-900">Password</div>
        <input
          className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          value={state.password}
          type="password"
          autoComplete="new-password"
          onChange={(e) => update("password", e.target.value)}
        />
        <div className="mt-2 space-y-1 text-xs">
          <PasswordRule valid={state.password.length >= 8}>At least 8 characters</PasswordRule>
          <PasswordRule valid={/[A-Z]/.test(state.password)}>One uppercase letter</PasswordRule>
          <PasswordRule valid={/[a-z]/.test(state.password)}>One lowercase letter</PasswordRule>
          <PasswordRule valid={/[0-9]/.test(state.password)}>One number</PasswordRule>
          <PasswordRule
            valid={/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~;]/.test(state.password)}
          >
            One special character
          </PasswordRule>
        </div>
      </label>
      <Field
        label="Confirm password"
        value={state.confirmPassword}
        onChange={(v) => update("confirmPassword", v)}
        type="password"
        autoComplete="new-password"
      />
    </div>
  );
}

function MiloStepTwo({
  state,
  update,
}: {
  state: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-semibold text-slate-900">Almost there</div>
        <div className="mt-1 text-sm leading-6 text-slate-600">
          Start your 7-day free trial. You&apos;ll be redirected to secure checkout, then to the app.
        </div>
      </div>
      <label className="block">
        <div className="text-sm font-semibold text-slate-900">Where did you hear about us?</div>
        <select
          className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          value={state.heardFrom}
          onChange={(e) => update("heardFrom", e.target.value)}
        >
          {HEARD_FROM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="text-sm font-semibold text-slate-900">Milo+ trial</div>
        <div className="mt-1 text-sm text-slate-700">
          7-day free trial. Then £7.99/month. Cancel anytime. After checkout you&apos;ll get the App
          Store link to download.
        </div>
      </div>
    </div>
  );
}

function PasswordRule({ valid, children }: { valid: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 ${valid ? "text-green-600" : "text-slate-500"}`}>
      <div className={`h-2 w-2 rounded-full ${valid ? "bg-green-600" : "bg-slate-300"}`} />
      <span>{children}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <input
        className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
        value={value}
        type={type}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
