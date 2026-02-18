"use client";

import { useState } from "react";
import Link from "next/link";
import { createClientAction } from "./new/actions";
import ClientPresetsFormFields from "./ClientPresetsFormFields";
import { DEFAULT_PRESETS } from "@/types/presets";

const inputClass =
  "w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400";
const labelClass = "block text-sm font-medium text-neutral-700 mb-1";

export default function NewClientForm({ error }: { error?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await createClientAction({
        name: name.trim(),
        email: email.trim() || null,
        notes: notes.trim() || null,
        presets,
      });
    } catch (err) {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900 sm:text-2xl">Add Client</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Create a client profile and set their default preferences.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Client Profile */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-4">Client Profile</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className={labelClass}>
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="notes" className={labelClass}>Notes</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Client Defaults */}
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <ClientPresetsFormFields value={presets} onChange={setPresets} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-neutral-200 pt-6">
          <button
            type="submit"
            disabled={pending}
            className="min-h-[44px] rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save client"}
          </button>
          <Link
            href="/pt/app/clients"
            className="min-h-[44px] inline-flex items-center rounded-lg border border-neutral-300 bg-white px-6 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="mt-6">
        <Link href="/pt/app/clients" className="text-sm text-neutral-600 hover:text-neutral-900">
          ← Back to Clients
        </Link>
      </div>
    </div>
  );
}
