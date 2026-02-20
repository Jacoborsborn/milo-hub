// src/app/pt-hub/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Milo PT Hub — Build client plans in minutes",
  description:
    "Start your 3-day free trial on your phone. Build plans properly on your laptop.",
};

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.414.003l-3.25-3.25a1 1 0 1 1 1.414-1.414l2.542 2.542 6.543-6.586a1 1 0 0 1 1.409-.009Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 shadow-sm">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      {children}
    </div>
  );
}

function BenefitRow({
  title,
  proof,
}: {
  title: string;
  proof: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mt-0.5 text-emerald-600">
        <CheckIcon />
      </div>
      <div>
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="mt-1 text-sm text-neutral-600">{proof}</div>
      </div>
    </div>
  );
}

function StepPill({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="min-w-[240px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-neutral-500">Step {n}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{title}</div>
      <div className="mt-1 text-sm text-neutral-600">{sub}</div>
    </div>
  );
}

function PlanCard({
  name,
  cap,
  bullets,
  highlight,
  cta,
  href,
}: {
  name: string;
  cap: string;
  bullets: string[];
  highlight?: string;
  cta: string;
  href: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl border bg-white p-6 shadow-sm",
        highlight ? "border-neutral-900" : "border-neutral-200",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-neutral-900">{name}</div>
          <div className="mt-1 text-sm text-neutral-600">{cap}</div>
        </div>
        {highlight ? (
          <div className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
            {highlight}
          </div>
        ) : null}
      </div>

      <ul className="mt-5 space-y-2 text-sm text-neutral-700">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-0.5 text-neutral-900">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={[
          "mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold",
          highlight
            ? "bg-neutral-900 text-white hover:bg-neutral-800"
            : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
        ].join(" ")}
      >
        {cta}
      </Link>

      <div className="mt-2 text-center text-xs text-neutral-500">
        Start on phone • build on laptop
      </div>
    </div>
  );
}

export default function PtHubLandingPage() {
  // Keep tracking param
  const signupHref = "/auth/signup?from=pt-hub-ad";

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header: logo + ONE action only */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/brand/milo-logo.svg"
            alt="Milo Hub"
            width={34}
            height={34}
            className="h-[34px] w-[34px] rounded-xl object-contain"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Milo Hub</div>
            <div className="text-xs text-neutral-500">PT Hub</div>
          </div>
        </Link>

        <Link
          href={signupHref}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Start free trial
        </Link>
      </header>

      {/* HERO: one message, one CTA, one proof */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-8 pt-2">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <SmallLabel>Built for independent coaches</SmallLabel>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Build client plans in minutes.
              <span className="block text-neutral-700">Get your weekend back.</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600">
              Start your trial on your phone. Then use the email link to open Milo Hub on your laptop —
              that’s where plan building is fastest.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={signupHref}
                className="inline-flex items-center justify-center rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Start 3-day free trial
              </Link>

              <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm text-neutral-700 shadow-sm">
                After signup: <span className="font-semibold text-neutral-900">check email</span> → open on{" "}
                <span className="font-semibold text-neutral-900">laptop</span>
              </div>
            </div>

            {/* Benefits: benefit-first, feature-second */}
            <div className="mt-7 grid gap-3">
              <BenefitRow
                title="Stop rewriting the same plans every week"
                proof="Templates + presets keep structure consistent, even when clients change."
              />
              <BenefitRow
                title="Turn plan building into a quick review step"
                proof="Generate structured drafts fast, then tweak and send."
              />
              <BenefitRow
                title="Scale clients without scaling admin"
                proof="Handle more clients with the same hours — clean workflow, less chaos."
              />
            </div>

            <div className="mt-6 text-xs text-neutral-500">
              Best experience on laptop/desktop for building plans. Mobile is for quick checks.
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between px-2 pt-2">
              <div className="text-sm font-semibold text-neutral-900">Dashboard preview</div>
              <div className="text-xs text-neutral-500">What you’ll use on laptop</div>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
              <img
                src="/demo/dashboarddemo.jpeg"
                alt="Milo PT Hub dashboard demo"
                className="h-auto w-full object-contain"
                loading="eager"
              />
            </div>

            {/* Keep this tiny, no extra reading */}
            <div className="mt-3 text-xs text-neutral-500">
              Ads show the desktop UI (zoomed). Signup is phone-simple.
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS: mobile horizontal scroll (low effort to parse) */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-10">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">How it works</h2>
          <div className="text-xs text-neutral-500">Designed for fast setup</div>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <StepPill n="01" title="Add a client" sub="Create a profile in seconds." />
          <StepPill n="02" title="Choose template / preset" sub="Start from structure, not scratch." />
          <StepPill n="03" title="Generate & share" sub="Draft fast, review, send clean." />
        </div>

        <div className="mt-6">
          <Link
            href={signupHref}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Start 3-day free trial
          </Link>
          <div className="mt-2 text-center text-xs text-neutral-500">
            Sign up on phone → check email → open on laptop
          </div>
        </div>
      </section>

      {/* Pricing: keep it, but make it the LAST major thing */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="text-center">
            <div className="text-xs text-neutral-500">Simple pricing. No contracts.</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
              Scale your coaching without hiring.
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Choose a tier based on client volume. Everything is built around time saved.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <PlanCard
              name="Starter"
              cap="Up to 10 clients"
              bullets={[
                "Structured plan generation",
                "Templates + presets workflow",
                "Clean client-ready delivery",
                "3-day free trial",
              ]}
              cta="Start 3-day trial"
              href={signupHref}
            />
            <PlanCard
              name="Pro"
              cap="Up to 30 clients"
              bullets={[
                "Everything in Starter",
                "Faster back-to-back drafting",
                "Multi-client efficiency",
                "3-day free trial",
              ]}
              highlight="Most popular"
              cta="Start 3-day trial"
              href={signupHref}
            />
            <PlanCard
              name="Elite"
              cap="Up to 100 clients"
              bullets={[
                "Everything in Pro",
                "High-volume remote scaling",
                "Priority performance",
                "3-day free trial",
              ]}
              cta="Start 3-day trial"
              href={signupHref}
            />
          </div>

          <div className="mt-8 text-center text-xs text-neutral-400">
            © {new Date().getFullYear()} Milo Hub
          </div>
        </div>
      </section>

      {/* Sticky mobile CTA (big conversion lift) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/90 backdrop-blur sm:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-neutral-900">
              Start free trial
            </div>
            <div className="truncate text-[11px] text-neutral-500">
              Sign up on phone → open on laptop via email
            </div>
          </div>
          <Link
            href={signupHref}
            className="ml-auto inline-flex shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Start
          </Link>
        </div>
      </div>

      {/* Spacer so sticky bar doesn't cover content */}
      <div className="h-16 sm:hidden" />
    </main>
  );
}