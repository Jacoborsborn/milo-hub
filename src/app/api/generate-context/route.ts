import { NextResponse } from "next/server";
import { listClients } from "@/lib/services/clients";
import { listPtTemplates } from "@/lib/services/ptTemplatesServer";
import { listMealTemplates } from "@/lib/services/meal-templates";

export async function GET() {
  try {
    const [clients, workoutTemplates, mealTemplates] = await Promise.all([
      listClients(),
      listPtTemplates(),
      listMealTemplates(),
    ]);
    return NextResponse.json({
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        assigned_workout_program_id: (c as { assigned_workout_program_id?: string | null }).assigned_workout_program_id ?? null,
        assigned_meal_program_id: (c as { assigned_meal_program_id?: string | null }).assigned_meal_program_id ?? null,
        presets_json: (c as { presets_json?: unknown }).presets_json ?? null,
      })),
      workoutTemplates: workoutTemplates.map((t) => ({ id: t.id, name: t.name })),
      mealTemplates: mealTemplates.map((t) => ({ id: t.id, name: t.name })),
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[GET /api/generate-context]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load context" },
      { status: 500 }
    );
  }
}
