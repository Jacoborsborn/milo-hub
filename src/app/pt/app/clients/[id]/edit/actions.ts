"use server";

import { updateClient } from "@/lib/services/clients";
import { redirect } from "next/navigation";
import type { ClientPresets } from "@/types/presets";
import { presetsToConstraintsOnly } from "@/types/presets";

export async function updateClientAction(
  id: string,
  payload: {
    name: string;
    email: string | null;
    notes: string | null;
    presets: ClientPresets;
  }
) {
  try {
    await updateClient(id, {
      name: payload.name,
      email: payload.email,
      notes: payload.notes,
      presets_json: presetsToConstraintsOnly(payload.presets),
    });
    redirect(`/pt/app/clients/${id}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    const errorMsg = err instanceof Error ? err.message : "Failed to update client";
    redirect(`/pt/app/clients/${id}/edit?error=${encodeURIComponent(errorMsg)}`);
  }
}
