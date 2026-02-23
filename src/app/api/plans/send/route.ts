import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { signShareToken } from "@/lib/plan-share-token";
import { sendPlanReadyEmail } from "@/lib/email-plan-send";

const DEFAULT_EXPIRY_DAYS = 30;
const SUBJECT = "Your plan is ready";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const planId = typeof body.planId === "string" ? body.planId.trim() : null;
    if (!planId) {
      return NextResponse.json({ error: "planId required" }, { status: 400 });
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, pt_user_id, client_id, plan_type")
      .eq("id", planId)
      .eq("pt_user_id", user.id)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, email")
      .eq("id", plan.client_id)
      .eq("pt_id", user.id)
      .maybeSingle();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const clientEmail = (client as { email?: string | null }).email;
    if (!clientEmail || typeof clientEmail !== "string" || !clientEmail.includes("@")) {
      return NextResponse.json(
        { error: "Client has no valid email. Add an email in the client profile." },
        { status: 400 }
      );
    }

    const ptEmail = user.email;
    if (!ptEmail || !ptEmail.includes("@")) {
      return NextResponse.json(
        { error: "Your account has no email. Update your profile." },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, business_name, subscription_tier")
      .eq("id", user.id)
      .maybeSingle();

    const secret = process.env.PLAN_SHARE_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Share not configured. Set PLAN_SHARE_SECRET in your environment (e.g. Vercel)." },
        { status: 500 }
      );
    }

    const exp = Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60;
    const token = signShareToken({ planId, exp }, secret);
    const path = (plan as { plan_type?: string }).plan_type === "meal"
      ? `/share/meal/${token}`
      : `/share/plan/${token}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
    if (!baseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL is not set. Set it to your app origin (e.g. https://app.meetmilo.app)." },
        { status: 500 }
      );
    }
    const shareUrl = `${baseUrl}${path}`;

    const tier = (profile as { subscription_tier?: string | null } | null)?.subscription_tier?.toLowerCase();
    const isProOrElite = tier === "pro" || tier === "elite";

    const sendResult = await sendPlanReadyEmail({
      to: clientEmail,
      clientName: (client as { name: string }).name || "there",
      shareUrl,
      replyTo: ptEmail,
      ptDisplayName: (profile as { display_name?: string | null } | null)?.display_name ?? null,
      ptBusinessName: (profile as { business_name?: string | null } | null)?.business_name ?? null,
      isProOrElite,
    });

    if (sendResult.error) {
      console.error("[POST /api/plans/send]", sendResult.error);
      return NextResponse.json(
        { error: sendResult.error },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("plans")
      .update({
        review_status: "sent",
        sent_at: new Date().toISOString(),
        last_sent_to: clientEmail,
        last_sent_subject: SUBJECT,
      })
      .eq("id", planId)
      .eq("pt_user_id", user.id);

    if (updateError) {
      console.error("[POST /api/plans/send] plan update:", updateError);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/plans/send]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send" },
      { status: 500 }
    );
  }
}
