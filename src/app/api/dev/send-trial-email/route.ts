import { NextResponse } from "next/server";
import { sendTrialStartedEmail } from "@/lib/email/resend";

/**
 * Dev-only: send the trial-started email to a given address.
 * POST /api/dev/send-trial-email with body: { "to": "email@example.com" }
 * Only works when NODE_ENV=development.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  let body: { to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!to) {
    return NextResponse.json({ error: "Missing 'to' email" }, { status: 400 });
  }

  const result = await sendTrialStartedEmail({ to });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
