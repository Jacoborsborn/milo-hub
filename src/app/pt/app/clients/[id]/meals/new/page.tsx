import { getClientById } from "@/lib/services/clients";
import { redirect } from "next/navigation";
import Link from "next/link";
import Breadcrumbs from "@/components/pt/Breadcrumbs";
import MealPlanNewForm from "./MealPlanNewForm";

export default async function NewMealPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) {
    redirect("/pt/app/clients");
  }
  const assignedMealProgramId = (client as { assigned_meal_program_id?: string | null }).assigned_meal_program_id;
  const hasAssignedMealProgram = Boolean(assignedMealProgramId);

  return (
    <div style={{ padding: "0 0 24px", maxWidth: 640 }}>
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/pt/app/clients" },
          { label: client.name, href: `/pt/app/clients/${id}` },
          { label: "New Meal Plan" },
        ]}
      />
      <h2 style={{ margin: "0 0 20px", fontSize: "1.25rem", fontWeight: 700 }}>
        Generate Meal Plan
      </h2>
      <MealPlanNewForm clientId={id} hasAssignedMealProgram={hasAssignedMealProgram} />
      <div style={{ marginTop: 24 }}>
        <Link href={`/pt/app/clients/${id}`} style={{ color: "#0070f3", textDecoration: "none" }}>
          ← Back to Client
        </Link>
      </div>
    </div>
  );
}
