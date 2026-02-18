import { createClient } from "@supabase/supabase-js";
import { verifyShareToken } from "@/lib/plan-share-token";
import { getCoachDisplayName } from "@/lib/coach-display-name";
import { getBrandLogoUrl } from "@/lib/branding";
import SharePageHeader from "@/components/share/SharePageHeader";
import PublicMealShareView from "./PublicMealShareView";

type Plan = {
  id: string;
  plan_type: "meal" | "workout";
  pt_user_id?: string;
  content_json: Record<string, unknown>;
  created_at: string;
};

async function getPlanByIdUnsafe(planId: string): Promise<Plan | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("plans")
    .select("id, plan_type, pt_user_id, content_json, created_at")
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Plan;
}

type ProfileForShare = { display_name?: string; full_name?: string; name?: string; brand_logo_url?: string | null } | null;

async function getProfileForShare(ptUserId: string | undefined): Promise<ProfileForShare> {
  if (!ptUserId) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data } = await supabase
    .from("profiles")
    .select("display_name, full_name, name, brand_logo_url")
    .eq("id", ptUserId)
    .maybeSingle();
  return data as ProfileForShare;
}

export default async function ShareMealPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const secret = process.env.PLAN_SHARE_SECRET;
  if (!secret) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-neutral-600 text-center">
        Share links are not configured.
      </div>
    );
  }

  const payload = verifyShareToken(token, secret);
  if (!payload) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-neutral-600 text-center">
        This link is invalid or has expired.
      </div>
    );
  }

  const plan = await getPlanByIdUnsafe(payload.planId);
  if (!plan || plan.plan_type !== "meal") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-neutral-600 text-center">
        Plan not found or not a meal plan.
      </div>
    );
  }

  const createdDate = new Date(plan.created_at).toLocaleDateString(undefined, {
    dateStyle: "long",
  });
  const profile = await getProfileForShare(plan.pt_user_id);
  const coachDisplayName = getCoachDisplayName(profile);
  const brandLogoUrl = getBrandLogoUrl(profile);
  const meta = (plan.content_json?.meta as { weekCommencing?: string } | undefined);
  const weekCommencing = meta?.weekCommencing
    ? new Date(meta.weekCommencing).toLocaleDateString(undefined, { dateStyle: "long" })
    : createdDate;

  return (
    <>
      <SharePageHeader brandLogoUrl={brandLogoUrl} />
      <PublicMealShareView
        plan={plan}
        createdDate={createdDate}
        weekCommencing={weekCommencing}
        coachDisplayName={coachDisplayName}
        token={token}
      />
    </>
  );
}
