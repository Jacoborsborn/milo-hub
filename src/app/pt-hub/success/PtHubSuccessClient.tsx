"use client";

import { useEffect } from "react";

export default function PtHubSuccessClient() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fbq = (window as unknown as { fbq?: (a: string, b: string) => void }).fbq;
    if (typeof fbq === "function") {
      fbq("track", "CompleteRegistration");
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/brand/milo-logo.svg"
              alt="Milo Hub"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl object-contain"
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-neutral-900">Milo Hub</div>
              <div className="text-xs text-neutral-500">PT Hub</div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm text-center">

          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            You&apos;re in.
          </h1>
          <p className="mt-2 text-base text-neutral-500 leading-relaxed">
            Your 7-day trial is active and ready to go.
          </p>

          {/* Divider */}
          <div className="my-6 border-t border-neutral-100" />

          {/* Steps */}
          <div className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white mt-0.5">1</div>
              <div>
                <div className="text-sm font-semibold text-neutral-900">Check your email</div>
                <div className="text-sm text-neutral-500">We&apos;ve sent you a link to open Milo Hub.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white mt-0.5">2</div>
              <div>
                <div className="text-sm font-semibold text-neutral-900">Open on your laptop</div>
                <div className="text-sm text-neutral-500">Plan building works best on a bigger screen.</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white mt-0.5">3</div>
              <div>
                <div className="text-sm font-semibold text-neutral-900">Build your first plan</div>
                <div className="text-sm text-neutral-500">Add a client, pick a template, generate in minutes.</div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-neutral-100" />

          <p className="text-xs text-neutral-400">
            Can&apos;t find the email? Check your spam folder.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          Questions? <a href="mailto:support@meetmilo.app" className="text-neutral-600 underline underline-offset-2">support@meetmilo.app</a>
        </p>
      </div>
    </div>
  );
}