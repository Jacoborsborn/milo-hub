import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export type RecentClientItem = {
  id: string;
  name: string;
  latestPlanId: string | null;
  planType: "meal" | "workout" | null;
};

/**
 * GET /api/clients/recent
 * Returns up to 5 recent clients for the current PT, each with latest plan id (if any).
 * Used for Quick Switch Client dropdown in plan workspace.
 */
export async function GET() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ptUserId = user.id;

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("pt_id", ptUserId)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (clientsError) {
      console.error("[GET /api/clients/recent] clients:", clientsError);
      return NextResponse.json(
        { error: "Failed to fetch clients" },
        { status: 500 }
      );
    }

    if (!clients?.length) {
      return NextResponse.json({ clients: [] });
    }

    const clientIds = clients.map((c) => c.id);

    const { data: plans, error: plansError } = await supabase
      .from("plans")
      .select("id, client_id, plan_type, created_at")
      .in("client_id", clientIds)
      .eq("pt_user_id", ptUserId)
      .order("created_at", { ascending: false });

    if (plansError) {
      console.error("[GET /api/clients/recent] plans:", plansError);
      return NextResponse.json(
        { error: "Failed to fetch plans" },
        { status: 500 }
      );
    }

    const latestByClient = new Map<string, { id: string; plan_type: "meal" | "workout" }>();
    for (const p of plans ?? []) {
      if (!latestByClient.has(p.client_id)) {
        latestByClient.set(p.client_id, {
          id: p.id,
          plan_type: p.plan_type as "meal" | "workout",
        });
      }
    }

    const result: RecentClientItem[] = clients.map((c) => {
      const latest = latestByClient.get(c.id);
      return {
        id: c.id,
        name: c.name ?? "Client",
        latestPlanId: latest?.id ?? null,
        planType: latest?.plan_type ?? null,
      };
    });

    return NextResponse.json({ clients: result });
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    console.error("[GET /api/clients/recent] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
