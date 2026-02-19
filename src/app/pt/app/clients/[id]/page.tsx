import { getClientById, deleteClient } from "../../../../../lib/services/clients";
import { listPlansForClient } from "../../../../../lib/services/plans";
import { listPtTemplates } from "../../../../../lib/services/ptTemplatesServer";
import { listMealTemplates } from "../../../../../lib/services/meal-templates";
import { listProgramAssignmentsByClient } from "../../../../../lib/services/program-assignments";
import { generateMealPlanFormAction } from "../../../../templates/meals/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import Breadcrumbs from "@/components/pt/Breadcrumbs";
import { DeleteButton } from "./DeleteButton";
import ClientPlansList from "./ClientPlansList";
import ClientPresetsEditor from "./ClientPresetsEditor";
import ClientAssignedPrograms from "./ClientAssignedPrograms";

async function deleteClientAction(id: string) {
  "use server";
  try {
    await deleteClient(id);
    redirect("/pt/app/clients");
  } catch (err) {
    if ((err as any)?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    const errorMsg = err instanceof Error ? err.message : "Failed to delete client";
    redirect(`/pt/app/clients/${id}?error=${encodeURIComponent(errorMsg)}`);
  }
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { id } = await params;
  const searchParamsResolved = await searchParams;
  const error = searchParamsResolved.error;
  const created = searchParamsResolved.created === "1";

  let client;
  let recentPlans: Awaited<ReturnType<typeof listPlansForClient>> = [];
  let workoutPrograms: Awaited<ReturnType<typeof listPtTemplates>> = [];
  let mealPrograms: Awaited<ReturnType<typeof listMealTemplates>> = [];
  let assignments: Awaited<ReturnType<typeof listProgramAssignmentsByClient>> = [];
  try {
    const [clientRes, plansRes, workoutRes, mealRes, assignmentsRes] = await Promise.all([
      getClientById(id),
      listPlansForClient(id),
      listPtTemplates(),
      listMealTemplates(),
      listProgramAssignmentsByClient(id),
    ]);
    client = clientRes;
    recentPlans = plansRes ?? [];
    workoutPrograms = workoutRes ?? [];
    mealPrograms = mealRes ?? [];
    assignments = assignmentsRes ?? [];
  } catch (err) {
    if ((err as any)?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    return (
      <div style={{ padding: "0 0 24px" }}>
        <p style={{ color: "#c00" }}>
          {err instanceof Error ? err.message : "Failed to load client"}
        </p>
        <Link href="/pt/app/clients" style={{ color: "#0070f3", textDecoration: "none" }}>
          ← Back to Clients
        </Link>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: "0 0 24px" }}>
        <p>The client you're looking for doesn't exist or you don't have permission to view it.</p>
        <Link href="/pt/app/clients" style={{ color: "#0070f3", textDecoration: "none" }}>
          ← Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 24px", maxWidth: 800 }}>
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/pt/app/clients" },
          { label: client.name },
        ]}
      />
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>{client.name}</h2>
            {client.email && (
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "#666" }}>{client.email}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link
              href={`/pt/app/clients/${id}/edit`}
              style={{ padding: "8px 16px", background: "#0070f3", color: "white", textDecoration: "none", borderRadius: 4, fontSize: 14 }}
            >
              Edit
            </Link>
            <form action={deleteClientAction.bind(null, id)} style={{ display: "inline" }}>
              <DeleteButton />
            </form>
          </div>
        </div>
      </header>

      {created && (
        <div style={{ padding: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 4, marginBottom: 16, color: "#065f46", fontSize: 14 }}>
          Client profile saved.
        </div>
      )}
      {error && (
        <div style={{ padding: 12, background: "#fee", color: "#c00", borderRadius: 4, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14, color: "#666", textTransform: "uppercase" }}>Assigned Programs</h3>
        <ClientAssignedPrograms
          clientId={id}
          assignedWorkoutProgramId={(client as { assigned_workout_program_id?: string | null }).assigned_workout_program_id ?? null}
          assignedMealProgramId={(client as { assigned_meal_program_id?: string | null }).assigned_meal_program_id ?? null}
          workoutPrograms={workoutPrograms}
          mealPrograms={mealPrograms}
          assignments={assignments}
        />
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8, fontSize: 14, color: "#666", textTransform: "uppercase" }}>Generate</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {(client as { assigned_workout_program_id?: string | null }).assigned_workout_program_id ? (
            <Link
              href={`/templates/${(client as { assigned_workout_program_id: string }).assigned_workout_program_id}/assign?client_id=${id}`}
              style={{ padding: "8px 16px", background: "#111", color: "white", textDecoration: "none", borderRadius: 6, fontSize: 14, fontWeight: 500 }}
            >
              Generate workout
            </Link>
          ) : (
            <Link
              href={`/pt/app/generate?client=${id}`}
              style={{ padding: "8px 16px", background: "#111", color: "white", textDecoration: "none", borderRadius: 6, fontSize: 14, fontWeight: 500 }}
            >
              Generate workout (AI)
            </Link>
          )}
          {(client as { assigned_meal_program_id?: string | null }).assigned_meal_program_id ? (
            <form action={generateMealPlanFormAction} style={{ display: "inline" }}>
              <input type="hidden" name="clientId" value={id} />
              <button
                type="submit"
                style={{ padding: "8px 16px", background: "#111", color: "white", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
              >
                Generate meal plan
              </button>
            </form>
          ) : (
            <span style={{ fontSize: 14, color: "#666" }}>Assign a meal program first.</span>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, fontSize: 14, color: "#666", textTransform: "uppercase" }}>Client Defaults</h3>
        <ClientPresetsEditor clientId={id} initialPresets={client.presets_json} />
      </section>

      <ClientPlansList plans={recentPlans} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h3 style={{ marginBottom: 8, fontSize: 14, color: "#666", textTransform: "uppercase" }}>Contact Information</h3>
          <div style={{ padding: 16, background: "#f9f9f9", borderRadius: 4 }}>
            <p style={{ margin: "4px 0" }}>
              <strong>Email:</strong> {client.email || "—"}
            </p>
          </div>
        </div>

        {client.notes && (
          <div>
            <h3 style={{ marginBottom: 8, fontSize: 14, color: "#666", textTransform: "uppercase" }}>Notes</h3>
            <div style={{ padding: 16, background: "#f9f9f9", borderRadius: 4, whiteSpace: "pre-wrap" }}>
              {client.notes}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href="/pt/app/clients" style={{ color: "#0070f3", textDecoration: "none" }}>← Back to Clients</Link>
      </div>
    </div>
  );
}
