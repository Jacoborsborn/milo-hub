import { createClient } from "@supabase/supabase-js";
import { verifyShareToken } from "@/lib/plan-share-token";
import { getBrandLogoUrl } from "@/lib/branding";
import SharePageHeader from "@/components/share/SharePageHeader";
import ClientShareView from "./ClientShareView";

type Plan = {
  id: string;
  plan_type: "meal" | "workout";
  pt_user_id?: string;
  client_id?: string;
  content_json: Record<string, unknown>;
  created_at: string;
};

async function getPlanByIdUnsafe(planId: string): Promise<Plan | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[supabase share/plan/[token] getPlanByIdUnsafe] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("plans")
    .select("id, plan_type, pt_user_id, client_id, content_json, created_at")
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Plan;
}

async function getClientForShare(clientId: string | undefined): Promise<{ id: string; name: string } | null> {
  if (!clientId) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; name: string };
}

async function getProfileForShare(ptUserId: string | undefined): Promise<{ brand_logo_url?: string | null } | null> {
  if (!ptUserId) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log("[supabase share/plan/[token] getProfileForShare] NEXT_PUBLIC_SUPABASE_URL:", url ?? "undefined");
  if (!url || !key) return null;
  const supabase = createClient(url, key);
  const { data } = await supabase.from("profiles").select("brand_logo_url").eq("id", ptUserId).maybeSingle();
  return data as { brand_logo_url?: string | null } | null;
}

export default async function SharePlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const secret = process.env.PLAN_SHARE_SECRET;
  if (!secret) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-neutral-600">
        Share links are not configured.
      </div>
    );
  }

  const payload = verifyShareToken(token, secret);
  if (!payload) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-neutral-600">
        This link is invalid or has expired.
      </div>
    );
  }

  const plan = await getPlanByIdUnsafe(payload.planId);
  if (!plan) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-neutral-600">
        Plan not found.
      </div>
    );
  }

  const clientData = await getClientForShare(plan.client_id);
  const createdDate = new Date(plan.created_at).toLocaleDateString(undefined, {
    dateStyle: "long",
  });
  const planTitle =
    plan.plan_type === "meal" ? "Your Meal Plan" : "Your Workout Plan";
  const profile = await getProfileForShare(plan.pt_user_id);
  const brandLogoUrl = getBrandLogoUrl(profile);

  return (
    <>
      <SharePageHeader brandLogoUrl={brandLogoUrl} />
      <ClientShareView
        plan={plan}
        planTitle={planTitle}
        planType={plan.plan_type}
        createdDate={createdDate}
        shareToken={token}
        clientName={clientData?.name ?? null}
      />
    </>
  );
}
