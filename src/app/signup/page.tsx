import { Suspense } from "react";
import SignupWizard from "@/components/signup/SignupWizard";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1100px] px-6 py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          {/* Left: Wizard */}
          <div className="flex flex-col">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-slate-600">
                START YOUR TRIAL
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Get set up in under 2 minutes
              </h1>
              <p className="mt-2 max-w-[52ch] text-sm leading-6 text-slate-600">
                Create your account, tell us your client load, and we&apos;ll recommend the right plan for how you coach.
              </p>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <Suspense fallback={<SignupWizardFallback />}>
                <SignupWizard />
              </Suspense>
            </div>
          </div>

          {/* Right: Value panel */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.06)] lg:mt-16">
            <div className="flex flex-col space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">What you get</h2>

              <div className="space-y-3">
                <ValueRow title="Back-to-back plan drafting" desc="Queue plans without waiting. Keep working while drafts generate." />
                <ValueRow title="Automation scheduling" desc="Set weekly creation day. Drafts appear ready for review and sending." />
                <ValueRow title="Remote scale without chaos" desc="Structured layouts clients understand. Less admin, more coaching." />
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                <p className="text-sm font-semibold text-neutral-900">Typical outcomes</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-medium text-neutral-900">Faster drafts</div>
                    <div className="mt-1 text-xs text-neutral-600">template → draft quickly</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-medium text-neutral-900">Cleaner delivery</div>
                    <div className="mt-1 text-xs text-neutral-600">consistent weeks, consistent format</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-medium text-neutral-900">More headspace</div>
                    <div className="mt-1 text-xs text-neutral-600">less admin / less rework</div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-neutral-500">
                  Illustrative outcomes. Exact results vary by workflow and client load.
                </p>
              </div>

              <div className="text-xs text-slate-500">
                By starting a trial you agree to our terms and privacy policy.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SignupWizardFallback() {
  return (
    <div className="animate-pulse space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-6">
      <div className="h-10 rounded bg-slate-200" />
      <div className="h-10 rounded bg-slate-200" />
      <div className="h-10 rounded bg-slate-200" />
    </div>
  );
}

function ValueRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-sm leading-6 text-slate-600">{desc}</div>
      </div>
    </div>
  );
}

