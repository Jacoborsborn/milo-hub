import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { signShareToken } from "@/lib/plan-share-token";

const DEFAULT_EXPIRY_DAYS = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const secret = process.env.PLAN_SHARE_SECRET;
    if (!secret) {
      console.error("[share] PLAN_SHARE_SECRET is not set");
      return NextResponse.json({ error: "Share not configured" }, { status: 500 });
    }

    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await params;
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, plan_type")
      .eq("id", planId)
      .eq("pt_user_id", user.id)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const exp = Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60;
    const token = signShareToken({ planId, exp }, secret);
    const url = (plan as { plan_type?: string }).plan_type === "meal"
      ? `/share/meal/${token}`
      : `/share/plan/${token}`;

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[GET /api/plans/[planId]/share]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create share link" },
      { status: 500 }
    );
  }
}
