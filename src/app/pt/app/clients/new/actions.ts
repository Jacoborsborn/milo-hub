"use server";

import { createClient } from "@/lib/services/clients";
import { redirect } from "next/navigation";
import type { ClientPresets } from "@/types/presets";
import { presetsToConstraintsOnly } from "@/types/presets";

export async function createClientAction(payload: {
  name: string;
  email: string | null;
  notes: string | null;
  presets: ClientPresets;
}) {
  try {
    const client = await createClient({
      name: payload.name,
      email: payload.email,
      notes: payload.notes,
      presets_json: presetsToConstraintsOnly(payload.presets),
    });
    redirect(`/pt/app/clients/${client.id}?created=1`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    const errorMsg = err instanceof Error ? err.message : "Failed to create client";
    redirect(`/pt/app/clients/new?error=${encodeURIComponent(errorMsg)}`);
  }
}
