/**
 * Helper to prevent duplicate emails using pt_email_log table.
 * Always check before sending, always log after a successful send.
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Returns true if this email type has already been sent to this user.
 */
export async function emailAlreadySent(
  ptUserId: string,
  emailType: string
): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("pt_email_log")
    .select("id")
    .eq("pt_user_id", ptUserId)
    .eq("email_type", emailType)
    .maybeSingle();
  return !!data;
}

/**
 * Log a sent email. Call this after a successful Resend send.
 */
export async function logEmailSent(
  ptUserId: string,
  emailType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("pt_email_log").insert({
    pt_user_id: ptUserId,
    email_type: emailType,
    metadata: metadata ?? {},
  });
}