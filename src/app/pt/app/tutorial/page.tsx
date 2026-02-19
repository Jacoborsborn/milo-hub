// src/app/pt/app/tutorial/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import TutorialStepImage from "@/components/tutorial/TutorialStepImage";
import TrialSuccessBanner from "@/components/pt/TrialSuccessBanner";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = {
  title: "Tutorial | Milo Hub",
};

export const dynamic = "force-dynamic";

type Step = {
  title: string;
  description: string;
  imageAlt: string;
  // Use local assets later; for now this is a placeholder path you can replace.
  imageSrc: string;
  ctaLabel?: string;
  ctaHref?: string;
};

const steps: Step[] = [
  {
    title: "1) Check Access / Trial",
    description:
      "Confirm your subscription status, tier, and trial end date so nothing blocks generation.",
    imageAlt: "Profile or billing status screenshot placeholder",
    imageSrc: "/tutorial/step-1.png",
    ctaLabel: "Go to Profile",
    ctaHref: "/profile",
  },
  {
    title: "2) Create Client + Inputs",
    description:
      "Add a client and fill their goals, preferences, restrictions, and other inputs used for generation.",
    imageAlt: "Create client and inputs screenshot placeholder",
    imageSrc: "/tutorial/step-2.png",
    ctaLabel: "Go to Clients",
    ctaHref: "/clients",
  },
  {
    title: "3) Create / Choose Template (Program)",
    description:
      "Use a template you can reuse. Templates define structure so outputs stay consistent and professional.",
    imageAlt: "Templates library screenshot placeholder",
    imageSrc: "/tutorial/step-3.png",
    ctaLabel: "Go to Programs",
    ctaHref: "/programs",
  },
  {
    title: "4) Assign Template to Client",
    description:
      "Attach a program to a client so the generator combines structure (template) + details (inputs).",
    imageAlt: "Assign template to client screenshot placeholder",
    imageSrc: "/tutorial/step-4.png",
  },
  {
    title: "5) Review Plan",
    description:
      "Open the generated plan, check structure, make quick edits, and confirm everything looks professional.",
    imageAlt: "Review plan screenshot placeholder",
    imageSrc: "/tutorial/step-5.png",
  },
  {
    title: "6) Send to Client (Email)",
    description:
      "Use the share or email feature to send the plan directly to your client. They receive a mobile-friendly link instantly.",
    imageAlt: "Send to client screenshot placeholder",
    imageSrc: "/tutorial/step-6.png",
    ctaLabel: "Go to Clients",
    ctaHref: "/clients",
  },
];

export default async function TutorialPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; session_id?: string }> | { success?: string; session_id?: string };
}) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect("/signup");
  }

  const params = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const sessionId = params?.session_id?.trim();
  if (sessionId) {
    const h = await headers();
    const host = h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
    const baseUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "";
    const cookie = h.get("cookie") ?? "";
    try {
      const syncRes = await fetch(`${baseUrl}/api/billing/sync-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!syncRes.ok) {
        const errBody = await syncRes.text();
        console.error("[tutorial] sync-session failed", syncRes.status, errBody);
      }
    } catch (e) {
      console.error("[tutorial] sync-session fetch error", e);
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", userData.user.id)
    .single();

  const status = profile?.subscription_status;
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const now = new Date();
  const hasAccess =
    status === "active" ||
    (status === "trial" && trialEndsAt && trialEndsAt > now);

  if (!hasAccess) {
    redirect("/pt/app/billing");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <Suspense fallback={null}>
        <TrialSuccessBanner />
      </Suspense>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Tutorial</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          6 steps. From setup to client delivery.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/clients"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Start: Create a Client
          </Link>
          <Link
            href="/programs"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Browse Programs
          </Link>
          <Link
            href="/review-plans"
            className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Review Plans
          </Link>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {steps.map((step) => (
          <article key={step.title} className="rounded-2xl border bg-card p-5">
            <div className="flex flex-col gap-4">
              <TutorialStepImage src={step.imageSrc} alt={step.imageAlt} />

              <div>
                <h2 className="text-base font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step.description}
                </p>

                {step.ctaLabel && step.ctaHref && (
                  <div className="mt-4">
                    <Link
                      href={step.ctaHref}
                      className="inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      {step.ctaLabel}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border bg-card p-6">
        <h2 className="text-base font-semibold">Common Questions</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">Why can’t I generate?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check your subscription status and trial end date on the Profile page. If generation is gated,
              you’ll see it there.
            </p>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">What does the client see?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The client gets a public share link that works on mobile. You can resend it anytime from the plan view.
            </p>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">Templates vs Inputs — what matters most?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Both. Templates define structure (format + split). Inputs define accuracy (goals, constraints, preferences).
            </p>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">Need help?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Email <span className="font-medium">support@meetmilo.app</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Images: public/tutorial/step-1.png … step-6.png. TutorialStepImage shows placeholder if missing. */}
    </main>
  );
}
