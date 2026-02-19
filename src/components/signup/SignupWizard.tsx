"use client";

import { useMemo, useState } from "react";
import { LegalModal, type LegalModalVariant } from "@/components/ui/LegalModal";
import EmailCodeModal from "@/components/signup/EmailCodeModal";

type Step = 1 | 2;

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;

  // Optional PT context (keep minimal)
  businessName: string; // optional
  coachingFocus: "general" | "hypertrophy" | "fatloss" | "sport" | "other";

  heardFrom:
    | "tiktok"
    | "instagram"
    | "google"
    | "friend"
    | "reddit"
    | "youtube"
    | "other";
  clientsCount: number; // drives plan recommendation
};

const DEFAULT_STATE: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
  businessName: "",
  coachingFocus: "general",
  heardFrom: "tiktok",
  clientsCount: 5,
};

type RecommendedPlan = "starter" | "pro" | "elite";

function recommendPlan(clientsCount: number): RecommendedPlan {
  if (clientsCount <= 10) return "starter";
  if (clientsCount <= 30) return "pro";
  return "elite";
}

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~;]/.test(password)) {
    return "Password must include at least one special character.";
  }
  return null;
}

function planCopy(plan: RecommendedPlan) {
  if (plan === "starter")
    return {
      name: "Starter",
      limit: "Up to 10 clients",
      note: "Best if you're building systems and keeping delivery tight.",
    };
  if (plan === "pro")
    return {
      name: "Pro",
      limit: "Up to 30 clients",
      note: "Best for consistent weekly delivery + batching workflows.",
    };
  return {
    name: "Elite",
    limit: "Up to 100 clients",
    note: "Best for high-volume remote coaching and scale.",
  };
}

export default function SignupWizard() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<FormState>(DEFAULT_STATE);
  const [legalModal, setLegalModal] = useState<LegalModalVariant | null>(null);
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [verified, setVerified] = useState(false);

  const recommended = useMemo(() => recommendPlan(state.clientsCount), [state.clientsCount]);
  const plan = useMemo(() => planCopy(recommended), [recommended]);

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

  async function startTrialCheckout() {
    // Wire: Stripe Checkout Session (trial_period_days: 3) via /api/stripe/checkout
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tier: recommended,
        heardFrom: state.heardFrom,
        clientsCount: state.clientsCount,
      }),
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

    if (step === 1) {
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
      return;
    }
  }

  async function onStartTrial() {
    setErr(null);
    setLoading(true);
    try {
      await startTrialCheckout();
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
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Step {step} of 2</span>
          <span>{progressPct}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
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
        <StepOne state={state} update={update} />
      ) : (
        <StepTwo state={state} update={update} recommended={recommended} plan={plan} />
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
            className="h-11 flex-1 rounded-[10px] bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Continue"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={loading || !agreedToLegal || !verified}
            className="h-11 flex-1 rounded-[10px] bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Starting checkout..." : "Start 3-day trial"}
          </button>
        )}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={agreedToLegal}
          onChange={(e) => setAgreedToLegal(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          I agree to the{" "}
          <button
            type="button"
            onClick={() => setLegalModal("terms")}
            className="cursor-pointer text-blue-600 underline hover:text-blue-700"
          >
            Terms
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => setLegalModal("privacy")}
            className="cursor-pointer text-blue-600 underline hover:text-blue-700"
          >
            Privacy Policy
          </button>
        </span>
      </label>

      <div className="mt-2 text-xs text-slate-500">
        By starting your trial, you agree to our{" "}
        <button
          type="button"
          onClick={() => setLegalModal("terms")}
          className="cursor-pointer text-xs text-blue-600 underline hover:text-blue-700"
        >
          Terms
        </button>{" "}
        and{" "}
        <button
          type="button"
          onClick={() => setLegalModal("privacy")}
          className="cursor-pointer text-xs text-blue-600 underline hover:text-blue-700"
        >
          Privacy Policy
        </button>
        .
      </div>

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
          businessName: state.businessName,
          coachingFocus: state.coachingFocus,
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

function StepOne({
  state,
  update,
}: {
  state: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Account details" desc="Create your coach account. This will be used for billing + client ownership." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" value={state.firstName} onChange={(v) => update("firstName", v)} autoComplete="given-name" />
        <Field label="Surname" value={state.lastName} onChange={(v) => update("lastName", v)} autoComplete="family-name" />
      </div>

      <Field label="Email" value={state.email} onChange={(v) => update("email", v)} type="email" autoComplete="email" />

      <label className="block">
        <div className="text-sm font-semibold text-slate-900">Password</div>
        <input
          className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          value={state.password}
          type="password"
          autoComplete="new-password"
          onChange={(e) => update("password", e.target.value)}
        />
        <div className="mt-2 space-y-1 text-xs">
          <PasswordRule valid={state.password.length >= 8}>
            At least 8 characters
          </PasswordRule>
          <PasswordRule valid={/[A-Z]/.test(state.password)}>
            One uppercase letter
          </PasswordRule>
          <PasswordRule valid={/[a-z]/.test(state.password)}>
            One lowercase letter
          </PasswordRule>
          <PasswordRule valid={/[0-9]/.test(state.password)}>
            One number
          </PasswordRule>
          <PasswordRule valid={/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~;]/.test(state.password)}>
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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Business name (optional)"
          value={state.businessName}
          onChange={(v) => update("businessName", v)}
          autoComplete="organization"
        />

        <Select
          label="Coaching focus"
          value={state.coachingFocus}
          onChange={(v) => update("coachingFocus", v as FormState["coachingFocus"])}
          options={[
            { value: "general", label: "General coaching" },
            { value: "hypertrophy", label: "Hypertrophy" },
            { value: "fatloss", label: "Fat loss" },
            { value: "sport", label: "Sport performance" },
            { value: "other", label: "Other" },
          ]}
        />
      </div>
    </div>
  );
}

function StepTwo({
  state,
  update,
  recommended,
  plan,
}: {
  state: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  recommended: RecommendedPlan;
  plan: { name: string; limit: string; note: string };
}) {
  return (
    <div className="space-y-5">
      <SectionTitle
        title="Quick setup"
        desc="We'll recommend the right plan and tailor defaults later."
      />

      <Select
        label="Where did you hear about us?"
        value={state.heardFrom}
        onChange={(v) => update("heardFrom", v as FormState["heardFrom"])}
        options={[
          { value: "tiktok", label: "TikTok" },
          { value: "instagram", label: "Instagram" },
          { value: "google", label: "Google" },
          { value: "friend", label: "Friend / referral" },
          { value: "reddit", label: "Reddit" },
          { value: "youtube", label: "YouTube" },
          { value: "other", label: "Other" },
        ]}
      />

      <NumberField
        label="How many clients do you manage?"
        value={state.clientsCount}
        onChange={(n) => update("clientsCount", n)}
        min={0}
        max={999}
        hint="Used to recommend the right plan tier."
      />

      {/* Recommendation panel */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Recommended plan</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{plan.name}</div>
            <div className="mt-1 text-sm text-slate-600">{plan.limit}</div>
          </div>

          <div className="inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
            {recommended === "pro" ? "Most popular" : "Recommended"}
          </div>
        </div>

        <div className="mt-3 text-sm text-slate-700">{plan.note}</div>

        <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-700">
          <Bullet>Generate unlimited structured plans back-to-back</Bullet>
          <Bullet>Automate weekly plan creation schedules</Bullet>
          <Bullet>Deliver clean client-ready layouts instantly</Bullet>
          <Bullet>Scale remote clientele without losing control</Bullet>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold tracking-[0.08em] text-slate-500">TRIAL</div>
          <div className="mt-1 text-sm text-slate-700">
            Includes <span className="font-semibold text-slate-900">3-day free trial</span>. Cancel anytime.
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordRule({ valid, children }: { valid: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 ${valid ? "text-green-600" : "text-slate-500"}`}>
      <div
        className={`h-2 w-2 rounded-full ${valid ? "bg-green-600" : "bg-slate-300"}`}
      />
      <span>{children}</span>
    </div>
  );
}

function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-600">{desc}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <input
        className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        type={type}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  const displayValue = value === 0 ? "" : String(value);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 3);
    if (raw === "") {
      onChange(0);
      return;
    }
    const n = Number(raw);
    if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <label className="block">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <input
        className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={displayValue}
        onChange={handleChange}
        placeholder="0"
      />
      {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <select
        className="mt-2 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-blue-600" />
      <div>{children}</div>
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
