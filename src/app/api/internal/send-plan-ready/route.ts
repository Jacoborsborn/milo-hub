import { NextRequest, NextResponse } from "next/server";
import { sendAutogenPlanReadyEmail } from "@/lib/email/resend";
import { emailAlreadySent, logEmailSent } from "@/lib/email/check-and-log";

/**
 * Internal endpoint: send "autogen plan ready" email.
 * Called by pt-autogen-drafts edge function after inserting a draft plan.
 * Secured by x-internal-secret (CRON_SECRET or AUTOGEN_SECRET).
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? null;
  const autogenSecret = process.env.AUTOGEN_SECRET ?? null;
  if (!cronSecret && !autogenSecret) {
    return NextResponse.json(
      { error: "Server not configured: set AUTOGEN_SECRET or CRON_SECRET" },
      { status: 503 }
    );
  }
  const secret = req.headers.get("x-internal-secret");
  const valid = secret === cronSecret || secret === autogenSecret;
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ptUserId?: string; ptEmail?: string; clientName?: string; planType?: "workout" | "meal"; planId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { ptUserId, ptEmail, clientName, planType, planId } = body;
  if (!ptUserId || !ptEmail || !clientName || !planType || !planId) {
    return NextResponse.json({ error: "Missing ptUserId, ptEmail, clientName, planType, or planId" }, { status: 400 });
  }

  const emailKey = `autogen_plan_ready_${planId}`;
  const alreadySent = await emailAlreadySent(ptUserId, emailKey);
  if (alreadySent) {
    return NextResponse.json({ skipped: true });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const reviewUrl = `${baseUrl}/pt/app/plans/${planId}`;

  const result = await sendAutogenPlanReadyEmail({
    to: ptEmail,
    clientName,
    planType,
    reviewUrl,
  });

  if (!result.error) {
    await logEmailSent(ptUserId, emailKey, { plan_id: planId, client_name: clientName });
  }

  return NextResponse.json(result);
}
