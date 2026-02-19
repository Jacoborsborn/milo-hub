import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Redirect-only route. No UI.
 * - Not authenticated + session_id in URL (post-checkout) → /pt/login so they can log in then go to tutorial
 * - Not authenticated → /signup
 * - Authenticated + active access → /pt/app/tutorial (preserve success & session_id so sync-session can run)
 * - Authenticated but no access → /pt/app/billing
 */
export default async function PtAuthLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>> | Record<string, string>;
}) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  const params = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const success = params.success;
  const sessionId = params.session_id?.trim();
  const nextPath = params.next?.trim();
  const tutorialWithParams =
    success && sessionId
      ? `/pt/app/tutorial?success=${encodeURIComponent(success)}&session_id=${encodeURIComponent(sessionId)}`
      : "/pt/app/tutorial";

  if (!userData?.user) {
    if (sessionId) {
      const next = nextPath || "/pt/app/tutorial";
      redirect(`/pt/login?success=${encodeURIComponent(success || "true")}&session_id=${encodeURIComponent(sessionId)}&next=${encodeURIComponent(next)}`);
    }
    redirect("/signup");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", userData.user.id)
    .single();

  const status = profile?.subscription_status;
  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const now = new Date();

  const hasAccess =
    status === "active" ||
    (status === "trial" && trialEndsAt && trialEndsAt > now);

  if (hasAccess) {
    redirect(tutorialWithParams);
  }

  redirect("/pt/app/billing");
}
