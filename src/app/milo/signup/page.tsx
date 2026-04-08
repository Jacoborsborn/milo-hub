import { Suspense } from "react";
import Link from "next/link";
import MiloSignupWizard from "@/components/signup/MiloSignupWizard";

function MiloSignupWizardFallback() {
  return (
    <div className="animate-pulse space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-6">
      <div className="h-10 rounded bg-slate-200" />
      <div className="h-10 rounded bg-slate-200" />
      <div className="h-10 rounded bg-slate-200" />
    </div>
  );
}

export const metadata = {
  title: "Sign up | Milo+",
  description: "Create your account and start your 7-day free trial of Milo+.",
};

export default function MiloSignupPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1100px] px-6 py-12">
        <div className="mb-8">
          <Link
            href="/milo"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Milo+
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-orange-700">
                START YOUR TRIAL
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Get your plan in under 2 minutes
              </h1>
              <p className="mt-2 max-w-[52ch] text-sm leading-6 text-slate-600">
                Create your account, then start your 7-day free trial. You&apos;ll get instant access to
                personalized meal plans and workouts.
              </p>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <Suspense fallback={<MiloSignupWizardFallback />}>
                <MiloSignupWizard />
              </Suspense>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_20px_40px_rgba(15,23,42,0.06)] lg:mt-16">
            <div className="flex flex-col space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">What you get</h2>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Full weekly plans</div>
                    <div className="text-sm leading-6 text-slate-600">
                      Meals and workouts tailored to your goals.
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Grocery lists & prices</div>
                    <div className="text-sm leading-6 text-slate-600">
                      UK supermarket costs so you can shop smart.
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">7-day free trial</div>
                    <div className="text-sm leading-6 text-slate-600">
                      Then £7.99/month. Cancel anytime.
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                After checkout you&apos;ll be taken to the App Store to download Milo+.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
