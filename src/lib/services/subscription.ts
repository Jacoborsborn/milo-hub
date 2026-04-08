import { supabaseServer } from "../supabase/server";
import { redirect } from "next/navigation";

/** Thrown when profile.access_mode === 'readonly' (client create / plan generation blocked). */
export class ReadOnlyModeError extends Error {
  readonly code = "READ_ONLY_MODE" as const;
  constructor() {
    super("Upgrade to regain full access.");
    this.name = "ReadOnlyModeError";
  }
}

export type SubscriptionTier = "starter" | "pro" | "elite" | null;

export type SubscriptionGate = {
  allowed: boolean;
  reason?: string;
  status?: string;
  tier?: SubscriptionTier;
  clientLimit?: number | null;
};

const CLIENT_LIMITS: Record<Exclude<SubscriptionTier, null>, number> = {
  starter: 10,
  pro: 30,
  elite: 100,
};

export async function getSubscriptionStatus() {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect("/pt/auth/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_tier, trial_ends_at")
    .eq("id", userData.user.id)
    .single();

  if (error || !profile) {
    return { allowed: false, reason: "No profile found" };
  }

  const now = new Date();

  if (profile.subscription_status === "active") {
    return { allowed: true };
  }

  if (
    profile.subscription_status === "trial" &&
    profile.trial_ends_at &&
    new Date(profile.trial_ends_at) > now
  ) {
    return { allowed: true };
  }

  return { allowed: false, reason: profile.subscription_status };
}

export async function getSubscriptionGate(): Promise<SubscriptionGate> {
  const supabase = await supabaseServer();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    redirect("/pt/auth/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_tier, trial_ends_at")
    .eq("id", userData.user.id)
    .single();

  if (error || !profile) {
    return { allowed: false, reason: "No profile found" };
  }

  const status = profile.subscription_status as string;
  const tier = (profile.subscription_tier as SubscriptionTier) ?? null;

  const now = new Date();
  const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;

  const isActive = status === "active";
  const isTrialValid = status === "trial" && trialEndsAt && trialEndsAt > now;

  if (!isActive && !isTrialValid) {
    return { allowed: false, reason: "subscription_required", status, tier };
  }

  const clientLimit = tier && CLIENT_LIMITS[tier] ? CLIENT_LIMITS[tier] : null;

  return { allowed: true, status, tier, clientLimit };
}

export async function requireActiveSubscriptionOrRedirect() {
  const gate = await getSubscriptionGate();
  if (!gate.allowed) {
    redirect("/pt/app/billing?reason=subscription_required");
  }
  return gate;
}

export async function requireClientCapacityOrThrow(ptUserId: string) {
  const gate = await requireActiveSubscriptionOrRedirect();

  const limit = gate.clientLimit ?? 30;

  const supabase = await supabaseServer();
  const { count, error } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("pt_id", ptUserId);

  if (error) {
    console.error("[requireClientCapacityOrThrow] count query error:", error);
    throw new Error(`Failed to check client capacity: ${error.message}`);
  }

  const current = count ?? 0;

  if (current >= limit) {
    throw new Error(`Client limit reached (${current}/${limit}). Upgrade your plan to add more clients.`);
  }

  return { current, limit, tier: gate.tier };
}

/**
 * Ensure the authenticated PT user is not in readonly mode.
 * Call before client creation or plan generation (additional guard; does not replace subscription gating).
 * @throws ReadOnlyModeError when profiles.access_mode === 'readonly'
 */
export async function requireWritableAccessOrThrow(): Promise<void> {
  const supabase = await supabaseServer();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    redirect("/pt/auth/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("access_mode")
    .eq("id", userData.user.id)
    .single();

  if (error || !profile) {
    return;
  }

  const accessMode = (profile.access_mode as string) ?? "full";
  if (accessMode === "readonly") {
    throw new ReadOnlyModeError();
  }
}
