// src/app/pt-hub/success/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Signup complete — Milo PT Hub",
  description: "Your trial has started. Open the link in your email on your laptop/desktop to continue.",
};

export default function PtHubSuccessPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-center border-b border-neutral-100 px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/assets/MiloMetal.png"
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
      </header>

      <section className="mx-auto w-full max-w-2xl px-5 py-12">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Signup complete. Trial started.
          </h1>

          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            Check your email and open the link on laptop/desktop to continue.
          </p>

          <div className="mt-8">
            <a
              href="mailto:"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-neutral-800 sm:w-auto"
            >
              Open email app
            </a>
          </div>

          <p className="mt-6 text-sm text-neutral-500">
            Check spam/junk if not received.
          </p>
        </div>
      </section>
    </main>
  );
}
