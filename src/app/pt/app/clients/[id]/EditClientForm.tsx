"use client";

import { useState } from "react";
import Link from "next/link";
import { updateClientAction } from "./edit/actions";
import ClientPresetsFormFields from "../ClientPresetsFormFields";
import type { ClientPresets } from "@/types/presets";

const inputClass =
  "w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400";
const labelClass = "block text-sm font-medium text-neutral-700 mb-1";

type Props = {
  clientId: string;
  initialName: string;
  initialEmail: string | null;
  initialNotes: string | null;
  initialPresets: ClientPresets;
  error?: string;
};

export default function EditClientForm({
  clientId,
  initialName,
  initialEmail,
  initialNotes,
  initialPresets,
  error,
}: Props) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [presets, setPresets] = useState(initialPresets);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await updateClientAction(clientId, {
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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="notes" className={labelClass}>
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={inputClass}
          />
        </div>

        <ClientPresetsFormFields value={presets} onChange={setPresets} />

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="min-h-[44px] rounded-lg bg-neutral-800 text-white px-6 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save Changes"}
          </button>
          <Link
            href={`/pt/app/clients/${clientId}`}
            className="min-h-[44px] inline-flex items-center rounded-lg border border-neutral-300 bg-white px-6 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div>
        <Link href={`/pt/app/clients/${clientId}`} className="text-sm text-neutral-600 hover:text-neutral-900">
          ← Back to Client
        </Link>
      </div>
    </div>
  );
}
