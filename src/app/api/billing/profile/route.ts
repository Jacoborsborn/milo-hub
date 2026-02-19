import { supabaseServer } from "../../../../lib/supabase/server";
import { NextResponse } from "next/server";

type BillingProfile = {
  subscription_status: string | null;
  subscription_tier: string | null;
  trial_ends_at: string | null;
  brand_logo_url: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean | null;
  cancel_effective_at: string | null;
  current_period_end: string | null;
};

export async function GET() {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json(null, { status: 401 });
  }

  let selectColumns =
    "subscription_status, subscription_tier, trial_ends_at, brand_logo_url, stripe_customer_id, stripe_subscription_id, cancel_at_period_end, cancel_effective_at, current_period_end";
  let profile: BillingProfile | null;
  let error: unknown;
  const first = await supabase
    .from("profiles")
    .select(selectColumns)
    .eq("id", userData.user.id)
    .maybeSingle();
  profile = first.data as BillingProfile | null;
  error = first.error;

  // If optional columns don't exist (migration not run), retry with minimal columns
  if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "42703") {
    selectColumns = "subscription_status, subscription_tier, trial_ends_at";
    const retry = await supabase
      .from("profiles")
      .select(selectColumns)
      .eq("id", userData.user.id)
      .maybeSingle();
    const retryData = retry.data;
    profile = retryData != null && typeof retryData === "object" && !Array.isArray(retryData)
      ? {
          ...(retryData as Record<string, unknown>),
          brand_logo_url: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          cancel_at_period_end: null,
          cancel_effective_at: null,
          current_period_end: null,
        } as BillingProfile
      : null;
    error = retry.error;
  }

  if (error) {
    const err = error as { message?: string; code?: string; details?: unknown };
    console.error("[GET /api/billing/profile]", err.message, err.code, err.details);
    return NextResponse.json(null, { status: 500 });
  }

  // No row (e.g. user created before profile trigger): return default so billing page can render
  if (!profile) {
    return NextResponse.json({
      subscription_status: "free",
      subscription_tier: null,
      trial_ends_at: null,
      brand_logo_url: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      cancel_at_period_end: null,
      cancel_effective_at: null,
      current_period_end: null,
    });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { brand_logo_url?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.brand_logo_url !== undefined && body.brand_logo_url !== null && typeof body.brand_logo_url !== "string") {
    return NextResponse.json({ error: "brand_logo_url must be a string or null" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ brand_logo_url: body.brand_logo_url ?? null })
    .eq("id", userData.user.id);

  if (error) {
    // Column may not exist if migration not run yet
    if (error.code === "42703") {
      return NextResponse.json({ ok: true });
    }
    console.error("[PATCH /api/billing/profile]", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, PATCH, OPTIONS",
    },
  });
}
