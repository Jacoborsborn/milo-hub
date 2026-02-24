/**
 * Centralized Resend email sending. Trial-started and other transactional emails.
 * Uses RESEND_API_KEY. From: Milo Hub <no-reply@meetmilo.app>
 */

import { Resend } from "resend";
import { PT_HUB_DESKTOP_URL } from "@/lib/pt-hub-desktop-url";

const FROM = "Milo Hub <no-reply@meetmilo.app>";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ─── Shared layout helpers ────────────────────────────────────────────────────

function emailWrapper(subject: string, preheader: string, body: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e8ec;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:18px 20px;border-bottom:1px solid #eef0f3;">
                <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">Milo Hub</div>
              </td>
            </tr>
            ${body}
            <tr>
              <td style="padding:16px 20px;background:#fbfcfd;border-top:1px solid #eef0f3;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
                  Powered by Milo Hub · <a href="mailto:support@meetmilo.app" style="color:#6b7280;text-decoration:underline;">support@meetmilo.app</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0">
    <tr>
      <td style="border-radius:12px;background:#111827;">
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;padding:12px 16px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

// ─── 1. Trial Started ─────────────────────────────────────────────────────────

export type SendTrialStartedEmailParams = {
  to: string;
  desktopUrl?: string;
};

const TRIAL_STARTED_SUBJECT = "Trial started — welcome in 🚀";
const TRIAL_STARTED_PREHEADER = "Open Milo PT Hub on desktop for the best experience.";

function trialStartedHtml(desktopUrl: string): string {
  const body = `
    <tr>
      <td style="padding:22px 20px 8px 20px;">
        <h1 style="margin:0;font-size:24px;line-height:1.2;color:#111827;">🚀 Trial started — welcome in</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.55;color:#374151;">
          Your Milo PT Hub trial is active and ready to go.<br />
          The PT dashboard works best on a laptop/desktop — open it here:
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 20px 6px 20px;">
        ${ctaButton(desktopUrl, "Open PT Hub on desktop")}
        <p style="margin:14px 0 0 0;font-size:12.5px;line-height:1.5;color:#6b7280;">
          <a href="${escapeHtml(desktopUrl)}" target="_blank" rel="noopener noreferrer" style="color:#111827;text-decoration:underline;">Copy this link</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 20px 24px 20px;">
        <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
          If you're on mobile, copy the link and open it on your computer.
        </p>
      </td>
    </tr>`;
  return emailWrapper(TRIAL_STARTED_SUBJECT, TRIAL_STARTED_PREHEADER, body);
}

function trialStartedText(desktopUrl: string): string {
  return `🚀 Trial started — welcome in

Your Milo PT Hub trial is active and ready to go.
The PT dashboard works best on a laptop/desktop — open it here:

Open PT Hub on desktop: ${desktopUrl}

—
Powered by Milo Hub
support@meetmilo.app`;
}

export async function sendTrialStartedEmail(
  params: SendTrialStartedEmailParams
): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "RESEND_API_KEY is not set" };
  const desktopUrl = params.desktopUrl ?? PT_HUB_DESKTOP_URL;
  const to = params.to?.trim();
  if (!to) return { error: "Missing recipient email" };
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: TRIAL_STARTED_SUBJECT,
    html: trialStartedHtml(desktopUrl),
    text: trialStartedText(desktopUrl),
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}

// ─── 2. Trial Ending Soon ─────────────────────────────────────────────────────

export type SendTrialEndingSoonEmailParams = {
  to: string;
  desktopUrl?: string;
};

const TRIAL_ENDING_SUBJECT = "Your trial ends tomorrow ⏰";
const TRIAL_ENDING_PREHEADER = "Keep building plans without interruption — upgrade now.";

function trialEndingSoonHtml(desktopUrl: string): string {
  const body = `
    <tr>
      <td style="padding:22px 20px 8px 20px;">
        <h1 style="margin:0;font-size:24px;line-height:1.2;color:#111827;">⏰ Your trial ends tomorrow</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.55;color:#374151;">
          Your Milo PT Hub trial is almost up. Subscribe now to keep building client plans without interruption.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 20px 24px 20px;">
        ${ctaButton(`${desktopUrl}/pt/app/billing`, "Upgrade my account")}
      </td>
    </tr>`;
  return emailWrapper(TRIAL_ENDING_SUBJECT, TRIAL_ENDING_PREHEADER, body);
}

function trialEndingSoonText(desktopUrl: string): string {
  return `⏰ Your trial ends tomorrow

Your Milo PT Hub trial is almost up. Subscribe now to keep building client plans without interruption.

Upgrade here: ${desktopUrl}/pt/app/billing

—
Powered by Milo Hub
support@meetmilo.app`;
}

export async function sendTrialEndingSoonEmail(
  params: SendTrialEndingSoonEmailParams
): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "RESEND_API_KEY is not set" };
  const desktopUrl = params.desktopUrl ?? PT_HUB_DESKTOP_URL;
  const to = params.to?.trim();
  if (!to) return { error: "Missing recipient email" };
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: TRIAL_ENDING_SUBJECT,
    html: trialEndingSoonHtml(desktopUrl),
    text: trialEndingSoonText(desktopUrl),
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}

// ─── 3. Welcome to the Team (first payment) ───────────────────────────────────

export type SendWelcomeToTeamEmailParams = {
  to: string;
  desktopUrl?: string;
};

const WELCOME_SUBJECT = "Welcome to the team 🙌";
const WELCOME_PREHEADER = "Thank you for subscribing to Milo PT Hub.";

function welcomeToTeamHtml(desktopUrl: string): string {
  const body = `
    <tr>
      <td style="padding:22px 20px 8px 20px;">
        <h1 style="margin:0;font-size:24px;line-height:1.2;color:#111827;">🙌 Welcome to the team</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.55;color:#374151;">
          You're now a paying member of Milo PT Hub — and we genuinely appreciate it. You're supporting an early-stage product that's being built piece by piece, and that means a lot.
        </p>
        <p style="margin:12px 0 0 0;font-size:15px;line-height:1.55;color:#374151;">
          If you ever hit a bug, have a feature request, or just want to share feedback — reply to this email. We read everything.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 20px 24px 20px;">
        ${ctaButton(`${desktopUrl}/pt/app`, "Go to my dashboard")}
      </td>
    </tr>`;
  return emailWrapper(WELCOME_SUBJECT, WELCOME_PREHEADER, body);
}

function welcomeToTeamText(desktopUrl: string): string {
  return `🙌 Welcome to the team

You're now a paying member of Milo PT Hub — and we genuinely appreciate it. You're supporting an early-stage product that's being built piece by piece, and that means a lot.

If you ever hit a bug, have a feature request, or just want to share feedback — reply to this email. We read everything.

Go to your dashboard: ${desktopUrl}/pt/app

—
Powered by Milo Hub
support@meetmilo.app`;
}

export async function sendWelcomeToTeamEmail(
  params: SendWelcomeToTeamEmailParams
): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "RESEND_API_KEY is not set" };
  const desktopUrl = params.desktopUrl ?? PT_HUB_DESKTOP_URL;
  const to = params.to?.trim();
  if (!to) return { error: "Missing recipient email" };
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: WELCOME_SUBJECT,
    html: welcomeToTeamHtml(desktopUrl),
    text: welcomeToTeamText(desktopUrl),
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}

// ─── 4. Month 2 Loyalty Reward ────────────────────────────────────────────────

export type SendLoyaltyRewardEmailParams = {
  to: string;
  desktopUrl?: string;
};

const LOYALTY_SUBJECT = "A thank you from us 🎁";
const LOYALTY_PREHEADER = "30% off your next month — you've earned it.";

function loyaltyRewardHtml(desktopUrl: string): string {
  const claimUrl = `${desktopUrl}/pt/app/billing?loyalty=1`;
  const body = `
    <tr>
      <td style="padding:22px 20px 8px 20px;">
        <h1 style="margin:0;font-size:24px;line-height:1.2;color:#111827;">🎁 A thank you from us</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.55;color:#374151;">
          You've been with Milo PT Hub for a month now — so we want to say thank you. You're supporting something we're building from scratch, and that genuinely matters.
        </p>
        <p style="margin:12px 0 0 0;font-size:15px;line-height:1.55;color:#374151;">
          Here's 30% off your next month as a small token of appreciation.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 20px 24px 20px;">
        ${ctaButton(claimUrl, "Claim your 30% off")}
      </td>
    </tr>`;
  return emailWrapper(LOYALTY_SUBJECT, LOYALTY_PREHEADER, body);
}

function loyaltyRewardText(desktopUrl: string): string {
  const claimUrl = `${desktopUrl}/pt/app/billing?loyalty=1`;
  return `🎁 A thank you from us

You've been with Milo PT Hub for a month now — so we want to say thank you.

Here's 30% off your next month. Claim it at: ${claimUrl}
One use, valid for 30 days.

—
Powered by Milo Hub
support@meetmilo.app`;
}

export async function sendLoyaltyRewardEmail(
  params: SendLoyaltyRewardEmailParams
): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "RESEND_API_KEY is not set" };
  const desktopUrl = params.desktopUrl ?? PT_HUB_DESKTOP_URL;
  const to = params.to?.trim();
  if (!to) return { error: "Missing recipient email" };
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: LOYALTY_SUBJECT,
    html: loyaltyRewardHtml(desktopUrl),
    text: loyaltyRewardText(desktopUrl),
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}

// ─── 5. Autogen Plan Ready ────────────────────────────────────────────────────

export type SendAutogenPlanReadyEmailParams = {
  to: string;
  clientName: string;
  planType: "workout" | "meal" | "both";
  reviewUrl?: string;
  desktopUrl?: string;
};

const AUTOGEN_SUBJECT = "New plan ready to review 📋";
const AUTOGEN_PREHEADER = "Milo has generated a draft plan for your client.";

function autogenPlanReadyHtml(
  clientName: string,
  planType: string,
  reviewUrl: string
): string {
  const planLabel =
    planType === "both" ? "a workout and meal plan" : `a ${planType} plan`;
  const body = `
    <tr>
      <td style="padding:22px 20px 8px 20px;">
        <h1 style="margin:0;font-size:24px;line-height:1.2;color:#111827;">📋 New plan ready to review</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.55;color:#374151;">
          Milo has built ${planLabel} for <strong>${escapeHtml(clientName)}</strong> — scheduled for today.
          Open the dashboard to review and send it off.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 20px 24px 20px;">
        ${ctaButton(reviewUrl, "Review & send plan")}
      </td>
    </tr>`;
  return emailWrapper(AUTOGEN_SUBJECT, AUTOGEN_PREHEADER, body);
}

function autogenPlanReadyText(
  clientName: string,
  planType: string,
  reviewUrl: string
): string {
  const planLabel =
    planType === "both" ? "a workout and meal plan" : `a ${planType} plan`;
  return `📋 New plan ready to review

Milo has built ${planLabel} for ${clientName} — scheduled for today.
Open the dashboard to review and send it off.

Review & send: ${reviewUrl}

—
Powered by Milo Hub
support@meetmilo.app`;
}

export async function sendAutogenPlanReadyEmail(
  params: SendAutogenPlanReadyEmailParams
): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "RESEND_API_KEY is not set" };
  const desktopUrl = params.desktopUrl ?? PT_HUB_DESKTOP_URL;
  const reviewUrl = params.reviewUrl ?? `${desktopUrl}/pt/app/review-plans`;
  const to = params.to?.trim();
  if (!to) return { error: "Missing recipient email" };
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: AUTOGEN_SUBJECT,
    html: autogenPlanReadyHtml(params.clientName, params.planType, reviewUrl),
    text: autogenPlanReadyText(params.clientName, params.planType, reviewUrl),
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}

// ─── 6. Client Plan Due Soon ──────────────────────────────────────────────────

export type SendClientPlanDueSoonEmailParams = {
  to: string;
  clientName: string;
  daysUntilDue: number;
  generateUrl?: string;
  desktopUrl?: string;
};

const DUE_SOON_SUBJECT = "Client plan due soon 👀";
const DUE_SOON_PREHEADER = "A client needs a plan — don't leave them waiting.";

function clientPlanDueSoonHtml(
  clientName: string,
  daysUntilDue: number,
  generateUrl: string
): string {
  const dueLabel =
    daysUntilDue === 1 ? "tomorrow" : `in ${daysUntilDue} days`;
  const body = `
    <tr>
      <td style="padding:22px 20px 8px 20px;">
        <h1 style="margin:0;font-size:24px;line-height:1.2;color:#111827;">👀 Plan due ${escapeHtml(dueLabel)}</h1>
        <p style="margin:14px 0 0 0;font-size:15px;line-height:1.55;color:#374151;">
          <strong>${escapeHtml(clientName)}</strong> needs a new plan ${escapeHtml(dueLabel)}. Head to the dashboard to generate it now.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 20px 24px 20px;">
        ${ctaButton(generateUrl, "Generate plan now")}
      </td>
    </tr>`;
  return emailWrapper(DUE_SOON_SUBJECT, DUE_SOON_PREHEADER, body);
}

function clientPlanDueSoonText(
  clientName: string,
  daysUntilDue: number,
  generateUrl: string
): string {
  const dueLabel =
    daysUntilDue === 1 ? "tomorrow" : `in ${daysUntilDue} days`;
  return `👀 Plan due ${dueLabel}

${clientName} needs a new plan ${dueLabel}. Head to the dashboard to generate it now.

Generate plan: ${generateUrl}

—
Powered by Milo Hub
support@meetmilo.app`;
}

export async function sendClientPlanDueSoonEmail(
  params: SendClientPlanDueSoonEmailParams
): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "RESEND_API_KEY is not set" };
  const desktopUrl = params.desktopUrl ?? PT_HUB_DESKTOP_URL;
  const generateUrl =
    params.generateUrl ?? `${desktopUrl}/pt/app/generate`;
  const to = params.to?.trim();
  if (!to) return { error: "Missing recipient email" };
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: DUE_SOON_SUBJECT,
    html: clientPlanDueSoonHtml(params.clientName, params.daysUntilDue, generateUrl),
    text: clientPlanDueSoonText(params.clientName, params.daysUntilDue, generateUrl),
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}