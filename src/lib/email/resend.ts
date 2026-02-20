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

export type SendTrialStartedEmailParams = {
  to: string;
  desktopUrl?: string;
};

const SUBJECT = "Trial started — welcome in 🚀";
const PREHEADER = "Open Milo PT Hub on desktop for the best experience.";

function trialStartedHtml(desktopUrl: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(SUBJECT)}</title>
    <!--[if mso]><noscript><span>${escapeHtml(PREHEADER)}</span></noscript><![endif]-->
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(PREHEADER)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e8ec;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:18px 20px;border-bottom:1px solid #eef0f3;">
                <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">Milo Hub</div>
              </td>
            </tr>
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
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:12px;background:#111827;">
                      <a href="${escapeHtml(desktopUrl)}" target="_blank" rel="noopener noreferrer"
                         style="display:inline-block;padding:12px 16px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
                        Open PT Hub on desktop
                      </a>
                    </td>
                  </tr>
                </table>
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
            </tr>
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

function trialStartedText(desktopUrl: string): string {
  return `🚀 Trial started — welcome in

Your Milo PT Hub trial is active and ready to go.
The PT dashboard works best on a laptop/desktop — open it here:

Open PT Hub on desktop: ${desktopUrl}

Copy this link: ${desktopUrl}

If you're on mobile, copy the link and open it on your computer.

—
Powered by Milo Hub
support@meetmilo.app`;
}

/**
 * Send "Trial started" email after checkout. Uses PT_HUB_DESKTOP_URL by default.
 */
export async function sendTrialStartedEmail(
  params: SendTrialStartedEmailParams
): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "RESEND_API_KEY is not set" };
  }

  const desktopUrl = params.desktopUrl ?? PT_HUB_DESKTOP_URL;
  const to = params.to?.trim();
  if (!to) {
    return { error: "Missing recipient email" };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: SUBJECT,
    html: trialStartedHtml(desktopUrl),
    text: trialStartedText(desktopUrl),
  });

  if (error) {
    return { error: error.message };
  }
  return { id: data?.id };
}
