// src/app/pt-hub/page.tsx
import Link from "next/link";
import ExpandableDashboardVideo from "./ExpandableDashboardVideo";

export const metadata = {
  title: "Milo PT Hub — Stop rewriting the same plans every week",
  description:
    "AI-powered plan generation for personal trainers. Build a full week of client plans in minutes, not hours. Start your 7-day free trial.",
};

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.414.003l-3.25-3.25a1 1 0 1 1 1.414-1.414l2.542 2.542 6.543-6.586a1 1 0 0 1 1.409-.009Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BenefitRow({ title, proof }: { title: string; proof: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mt-0.5 text-emerald-500">
        <CheckIcon />
      </div>
      <div>
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <div className="mt-0.5 text-sm text-neutral-500">{proof}</div>
      </div>
    </div>
  );
}

function StepPill({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="min-w-[220px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-neutral-400">Step {n}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{title}</div>
      <div className="mt-1 text-sm text-neutral-500">{sub}</div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  cap,
  bullets,
  highlight,
  cta,
  href,
}: {
  name: string;
  price: string;
  cap: string;
  bullets: string[];
  highlight?: string;
  cta: string;
  href: string;
}) {
  return (
    <div
      className={[
        "flex flex-col rounded-3xl border bg-white p-6 shadow-sm",
        highlight ? "border-neutral-900" : "border-neutral-200",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-neutral-900">{name}</div>
          <div className="mt-0.5 text-sm text-neutral-500">{cap}</div>
        </div>
        {highlight && (
          <div className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
            {highlight}
          </div>
        )}
      </div>

      <div className="mt-4">
        <span className="text-3xl font-bold tracking-tight text-neutral-900">{price}</span>
        <span className="ml-1 text-sm text-neutral-500">/mo</span>
      </div>

      <ul className="mt-5 flex-1 space-y-2 text-sm text-neutral-600">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-0.5 text-emerald-500 shrink-0">
              <CheckIcon />
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={[
          "mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
          highlight
            ? "bg-neutral-900 text-white hover:bg-neutral-800"
            : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
        ].join(" ")}
      >
        {cta}
      </Link>
      <div className="mt-2 text-center text-xs text-neutral-400">7 days free, cancel anytime</div>
    </div>
  );
}

export default function PtHubLandingPage() {
  const signupHref = "/auth/signup?from=pt-hub-ad";

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header */}
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
          className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
        >
          Start free trial
        </Link>
      </header>

      {/* HERO */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-8 pt-2">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            {/* Social-proof-style label */}
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Built for independent PTs &amp; online coaches
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl leading-tight">
              Your clients deserve
              <span className="block text-neutral-500">great plans every week.</span>
              <span className="block">You deserve your time back.</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-neutral-600">
              Milo builds structured workout and meal plans for your clients in minutes — not hours.
              Templates, presets, AI generation. You review, tweak, and send. That's it.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={signupHref}
                className="inline-flex items-center justify-center rounded-2xl bg-neutral-900 px-6 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
              >
                Start 7-day free trial
              </Link>
              <div className="text-sm text-neutral-500">
                Cancel anytime.
              </div>
            </div>

            {/* One-liner about mobile — brief, no apology */}
            <p className="mt-4 text-xs text-neutral-400">
              Sign up on your phone → we email you a link → open on laptop to build plans.
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              Can&apos;t find it? Check your spam and add hello@meetmilo.app to your contacts.
            </p>

            {/* Benefits */}
            <div className="mt-7 grid gap-3">
              <BenefitRow
                title="Plans that used to take 2 hours take 10 minutes"
                proof="Generate full structured drafts from templates — then just review and send."
              />
              <BenefitRow
                title="Scheduled plans that build themselves"
                proof="Set automation once. Milo generates next week's drafts automatically — you just approve."
              />
              <BenefitRow
                title="More clients, same hours"
                proof="Clean workflow means you can grow without burning out on admin."
              />
            </div>
          </div>

          {/* Dashboard image */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-md">
            <div className="flex items-center justify-between px-1 pb-3">
              <div className="text-sm font-semibold text-neutral-900">How it works</div>
              <div className="text-xs text-neutral-400">What you'll use on laptop</div>
            </div>
            <ExpandableDashboardVideo />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-12">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">How it works</h2>
          <div className="text-xs text-neutral-500">Up and running in minutes</div>
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <StepPill n="01" title="Add your client" sub="Name, goals, restrictions. Done in 30 seconds." />
          <StepPill n="02" title="Pick a template" sub="Start from structure, not a blank page." />
          <StepPill n="03" title="Generate the plan" sub="Milo builds the draft. You review and send." />
          <StepPill n="04" title="Client gets a link" sub="Clean, shareable plan view. No app needed." />
        </div>
        <div className="mt-6">
          <Link
            href={signupHref}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            Try it free for 7 days
          </Link>
          <div className="mt-2 text-center text-xs text-neutral-400">
            Sign up on phone → open on laptop via email link
          </div>
          <p className="mt-2 text-center text-xs text-neutral-400">
            Can&apos;t find it? Check your spam and add hello@meetmilo.app to your contacts.
          </p>
        </div>
      </section>

      {/* AUTOMATION CALLOUT */}
      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-10">
          <div className="rounded-3xl bg-neutral-900 px-8 py-8 text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Automation
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Plans that generate themselves.
            </h2>
            <p className="mt-3 max-w-lg text-base text-neutral-300 leading-relaxed">
              Set a schedule once. Milo generates your client's next week of plans automatically every week — workout and meal. You wake up to a draft ready to review, not a blank page to fill.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-neutral-300">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400"><CheckIcon /></span>
                Runs overnight while you sleep
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400"><CheckIcon /></span>
                You always review before it sends
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400"><CheckIcon /></span>
                Works across all your clients at once
              </div>
            </div>
            <Link
              href={signupHref}
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              Start 7-day free trial
            </Link>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="bg-neutral-50">
        <div className="mx-auto w-full max-w-6xl px-5 py-12">
          <div className="text-center">
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pricing</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
              Simple pricing. No surprises.
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Pay based on how many clients you manage. Everything included in every tier.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <PlanCard
              name="Starter"
              price="£29.99"
              cap="Up to 10 clients"
              bullets={[
                "AI workout + meal plan generation",
                "Templates & client presets",
                "Shareable plan links for clients",
                "Review before you send — always",
              ]}
              cta="Start free trial"
              href={signupHref}
            />
            <PlanCard
              name="Pro"
              price="£49.99"
              cap="Up to 30 clients"
              bullets={[
                "Everything in Starter",
                "Scheduled auto-generation",
                "Wake up to drafts ready to send",
                "Built for growing coaching businesses",
              ]}
              highlight="Most popular"
              cta="Start free trial"
              href={signupHref}
            />
            <PlanCard
              name="Elite"
              price="£99.99"
              cap="Up to 100 clients"
              bullets={[
                "Everything in Pro",
                "High-volume client management",
                "Full automation at scale",
                "For serious online coaching operations",
              ]}
              cta="Start free trial"
              href={signupHref}
            />
          </div>

          <p className="mt-6 text-center text-xs text-neutral-400">
            All plans include a 7-day free trial.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Stop spending your evenings writing plans.
          </h2>
          <p className="mt-3 text-base text-neutral-500 max-w-md mx-auto">
            Try Milo PT Hub free for 7 days. If it doesn't save you time, cancel in seconds.
          </p>
          <Link
            href={signupHref}
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-neutral-900 px-8 py-4 text-base font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            Start 7-day free trial — it's free
          </Link>
          <div className="mt-3 text-xs text-neutral-400">
            Sign up on phone → we email you a link → open on laptop to build plans
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Can&apos;t find it? Check your spam and add hello@meetmilo.app to your contacts.
          </p>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto w-full max-w-6xl px-5 py-5 text-center text-xs text-neutral-400">
          © {new Date().getFullYear()} Milo Hub · <a href="mailto:support@meetmilo.app" className="hover:text-neutral-600 transition-colors">support@meetmilo.app</a>
        </div>
      </footer>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-neutral-900">7-day free trial</div>
          </div>
          <Link
            href={signupHref}
            className="ml-auto inline-flex shrink-0 items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Start free
          </Link>
        </div>
      </div>

      <div className="h-16 sm:hidden" />

      {/* Meta pixel */}
      <img
        src="https://www.facebook.com/tr?id=1419316019660548&ev=PageView&noscript=1"
        height="1"
        width="1"
        style={{ display: "none" }}
        alt=""
      />
    </main>
  );
}