import { getClientById } from "@/lib/services/clients";
import { redirect } from "next/navigation";
import Link from "next/link";
import EditClientForm from "../EditClientForm";
import { parsePresets } from "@/types/presets";

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const searchParamsResolved = await searchParams;
  const error = searchParamsResolved.error;

  let client;
  try {
    client = await getClientById(id);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    return (
      <div className="px-4 py-6">
        <p className="text-red-600">{err instanceof Error ? err.message : "Failed to load client"}</p>
        <Link href="/pt/app/clients" className="text-sm text-neutral-600 hover:text-neutral-900 mt-4 inline-block">
          ← Back to Clients
        </Link>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="px-4 py-6">
        <p className="text-neutral-700">The client you're looking for doesn't exist or you don't have permission to edit it.</p>
        <Link href="/pt/app/clients" className="text-sm text-neutral-600 hover:text-neutral-900 mt-4 inline-block">
          ← Back to Clients
        </Link>
      </div>
    );
  }

  const initialPresets = parsePresets(
    client.presets_json ?? {
      meal: (client as { inputs_json?: { mealInputs?: unknown } }).inputs_json?.mealInputs ?? {},
      workout: (client as { inputs_json?: { workoutInputs?: unknown } }).inputs_json?.workoutInputs ?? {},
    }
  );

  return (
    <EditClientForm
      clientId={id}
      initialName={client.name}
      initialEmail={client.email}
      initialNotes={client.notes}
      initialPresets={initialPresets}
      error={error}
    />
  );
}
