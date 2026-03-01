import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  sendTrialEndingSoonEmail,
  sendLoyaltyRewardEmail,
  sendClientPlanDueSoonEmail,
} from "@/lib/email/resend";
import { emailAlreadySent, logEmailSent } from "@/lib/email/check-and-log";

/** Allow cron route to wait for edge function + optional emails (Vercel Pro: up to 300s). */
export const maxDuration = 300;

/**
 * Cron endpoint: call once daily to run pt-autogen-drafts.
 * Secure with CRON_SECRET or AUTOGEN_SECRET in env.
 *
 * Vercel Cron (vercel.json) sends GET at 06:00 UTC with Authorization: Bearer <CRON_SECRET>.
 * POST is supported for manual calls with body { "secret": "..." }.
 */
export async function GET(req: Request) {
  const secret = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? null;
  const expected = process.env.AUTOGEN_SECRET || process.env.CRON_SECRET;
  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runAutogenCron();
}

export async function POST(req: Request) {
  let secret: string | null = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? null;
  if (!secret) {
    try {
      const body = await req.json().catch(() => ({}));
      secret = (body as { secret?: string }).secret ?? null;
    } catch {
      // no body
    }
  }
  const expected = process.env.AUTOGEN_SECRET || process.env.CRON_SECRET;
  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runAutogenCron();
}

async function runAutogenCron() {
  console.log("Autogen cron invoked");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const cronSecret = process.env.AUTOGEN_SECRET || process.env.CRON_SECRET;
    const res = await fetch(`${supabaseUrl}/functions/v1/pt-autogen-drafts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-autogen-secret": cronSecret ?? "",
      },
      body: JSON.stringify({ secret: cronSecret }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        res.status === 404
          ? "Autogen function not found (404). Deploy with: supabase functions deploy pt-autogen-drafts"
          : (data as { error?: string }).error || "Autogen failed";
      console.error("AUTOGEN ERROR (function response not ok):", res.status, data);
      return NextResponse.json(
        {
          error: "Autogen failed",
          details: message,
          invokeError: res.status,
          invokeData: data,
        },
        { status: 500 }
      );
    }

    // --- Optional: run reminder/loyalty emails (fire-and-forget; errors logged but don't fail cron)
    if (serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);

      // A) Trial ending soon (trial_ends_at is tomorrow; subscription_status = trial)
      const trialEndingSoonCutoff = new Date();
      trialEndingSoonCutoff.setDate(trialEndingSoonCutoff.getDate() + 1);
      const nowIso = new Date().toISOString();
      const { data: trialEndingProfiles } = await supabase
        .from("profiles")
        .select("id, email, trial_ends_at")
        .gte("trial_ends_at", nowIso)
        .lte("trial_ends_at", trialEndingSoonCutoff.toISOString())
        .eq("subscription_status", "trial");

      if (trialEndingProfiles?.length) {
        for (const profile of trialEndingProfiles) {
          if (!profile.email) continue;
          try {
            const alreadySent = await emailAlreadySent(profile.id, "trial_ending_soon");
            if (!alreadySent) {
              await sendTrialEndingSoonEmail({ to: profile.email });
              await logEmailSent(profile.id, "trial_ending_soon");
            }
          } catch (e) {
            console.error("[cron] trial_ending_soon email error", profile.id, e);
          }
        }
      }

      // B) Month 2 loyalty reward (subscription_started_at ~25 days ago, status active)
      const loyaltyWindowStart = new Date();
      loyaltyWindowStart.setDate(loyaltyWindowStart.getDate() - 26);
      const loyaltyWindowEnd = new Date();
      loyaltyWindowEnd.setDate(loyaltyWindowEnd.getDate() - 24);
      const { data: loyaltyProfiles } = await supabase
        .from("profiles")
        .select("id, email, subscription_started_at")
        .gte("subscription_started_at", loyaltyWindowStart.toISOString())
        .lte("subscription_started_at", loyaltyWindowEnd.toISOString())
        .eq("subscription_status", "active");

      if (loyaltyProfiles?.length) {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
        const cronSecret = process.env.CRON_SECRET || process.env.AUTOGEN_SECRET;
        for (const profile of loyaltyProfiles) {
          if (!profile.email) continue;
          try {
            const alreadySent = await emailAlreadySent(profile.id, "loyalty_reward");
            if (!alreadySent) {
              if (baseUrl && cronSecret) {
                const applyRes = await fetch(`${baseUrl}/api/billing/apply-loyalty-reward`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cronSecret}`,
                  },
                  body: JSON.stringify({ profileId: profile.id }),
                });
                if (!applyRes.ok) {
                  console.error("[cron] apply-loyalty-reward failed", profile.id, applyRes.status, await applyRes.text());
                }
              }
              await sendLoyaltyRewardEmail({ to: profile.email });
              await logEmailSent(profile.id, "loyalty_reward");
            }
          } catch (e) {
            console.error("[cron] loyalty_reward email error", profile.id, e);
          }
        }
      }

      // C) Client plan due soon: last sent plan 6+ days ago (derive from plans.review_status = 'sent')
      const dueSoonThreshold = new Date();
      dueSoonThreshold.setDate(dueSoonThreshold.getDate() - 6);
      const { data: sentPlans } = await supabase
        .from("plans")
        .select("client_id, pt_user_id, sent_at")
        .eq("review_status", "sent")
        .not("sent_at", "is", null);

      if (sentPlans?.length) {
        const latestByClient = new Map<string, { pt_user_id: string; sent_at: string }>();
        for (const p of sentPlans) {
          const existing = latestByClient.get(p.client_id);
          if (!existing || (p.sent_at && p.sent_at > existing.sent_at)) {
            latestByClient.set(p.client_id, { pt_user_id: p.pt_user_id, sent_at: p.sent_at! });
          }
        }
        const dueSoonClientIds = [...latestByClient.entries()]
          .filter(([, v]) => v.sent_at <= dueSoonThreshold.toISOString())
          .map(([clientId]) => clientId);

        if (dueSoonClientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name, pt_id")
            .in("id", dueSoonClientIds);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, email")
            .in("id", [...new Set((clients ?? []).map((c) => c.pt_id))]);

          const profileByPtId = new Map((profiles ?? []).map((p) => [p.id, p.email]));
          for (const client of clients ?? []) {
            const ptEmail = profileByPtId.get(client.pt_id);
            if (!ptEmail) continue;
            const emailKey = `due_soon_${client.id}`;
            try {
              const alreadySent = await emailAlreadySent(client.pt_id, emailKey);
              if (!alreadySent) {
                await sendClientPlanDueSoonEmail({
                  to: ptEmail,
                  clientName: client.name ?? "Client",
                  daysUntilDue: 1,
                });
                await logEmailSent(client.pt_id, emailKey, { client_id: client.id });
              }
            } catch (e) {
              console.error("[cron] client_plan_due_soon email error", client.id, e);
            }
          }
        }
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("AUTOGEN ERROR:", err);
    const errObj = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json(
      {
        error: "Autogen failed",
        details: String(errObj.message || err),
        stack: errObj.stack ?? null,
      },
      { status: 500 }
    );
  }
}
