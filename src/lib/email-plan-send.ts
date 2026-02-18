/**
 * Send "Your plan is ready" email via Resend.
 * From: Milo Hub <no-reply@meetmilo.app>
 * Reply-To: PT's email (so client replies go to the PT).
 */

import { Resend } from "resend";

const FROM = "Milo Hub <no-reply@meetmilo.app>";

export type SendPlanEmailParams = {
  to: string;
  clientName: string;
  shareUrl: string;
  replyTo: string;
  ptDisplayName?: string | null;
  ptBusinessName?: string | null;
  isProOrElite: boolean;
};

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendPlanReadyEmail(params: SendPlanEmailParams): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "RESEND_API_KEY is not set" };
  }

  const { clientName, shareUrl, ptDisplayName, ptBusinessName, isProOrElite: isPro } = params;

  const fromName = isPro
    ? (ptBusinessName || ptDisplayName || "Your coach")
    : "Milo Hub";

  const signatureName = isPro
    ? (ptDisplayName || ptBusinessName || "Your coach")
    : "Your coach";

  const signatureLine = isPro && ptBusinessName && ptDisplayName && ptBusinessName !== ptDisplayName
    ? `${ptDisplayName} · ${ptBusinessName}`
    : (ptBusinessName || ptDisplayName || "Your coach");

  const subject = "Your plan is ready";

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6e8ec;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:18px 20px;border-bottom:1px solid #eef0f3;background:#ffffff;">
                <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">
                  Milo Hub
                </div>
                ${
                  isPro
                    ? `<div style="margin-top:6px;font-size:13px;color:#111827;">
                         <span style="color:#6b7280;">From:</span> ${escapeHtml(fromName)}
                       </div>`
                    : ``
                }
              </td>
            </tr>

            <tr>
              <td style="padding:22px 20px 8px 20px;">
                <h1 style="margin:0;font-size:24px;line-height:1.2;color:#111827;">
                  Your plan is ready
                </h1>
                <p style="margin:10px 0 0 0;font-size:15px;line-height:1.55;color:#374151;">
                  Hi ${escapeHtml(clientName || "there")}, your plan has been prepared and is ready to view.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 20px 6px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:12px;background:#111827;">
                      <a href="${shareUrl}" target="_blank" rel="noopener noreferrer"
                         style="display:inline-block;padding:12px 16px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
                        View your plan
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:14px 0 0 0;font-size:12.5px;line-height:1.5;color:#6b7280;">
                  If the button doesn't work, copy and paste this link:
                  <br />
                  <a href="${shareUrl}" target="_blank" rel="noopener noreferrer" style="color:#111827;text-decoration:underline;">
                    ${shareUrl}
                  </a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 20px 24px 20px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">
                  ${isPro ? `— ${escapeHtml(signatureLine)}` : `— ${escapeHtml(signatureName)}`}
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

          <p style="margin:10px 0 0 0;font-size:11px;color:#9ca3af;">
            Please do not reply to this email directly. Replies will go to your coach where supported.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text =
`Your plan is ready

Hi ${clientName || "there"}, your plan has been prepared and is ready to view.

View your plan:
${shareUrl}

${isPro ? `From: ${fromName}\n` : ""}— ${signatureLine}

Powered by Milo Hub
support@meetmilo.app`;

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [params.to],
    reply_to: params.replyTo,
    subject,
    html,
    text,
  });

  if (error) {
    return { error: error.message };
  }
  return { id: data?.id };
}
