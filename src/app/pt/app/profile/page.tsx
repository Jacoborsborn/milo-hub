import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import SecurityCard from "@/components/profile/SecurityCard";
import SignOutButton from "@/components/profile/SignOutButton";

export const metadata = {
  title: "Profile | Milo Hub",
};

type ProfileRow = {
  id: string;
  subscription_status?: string | null;
  subscription_tier?: string | null;
  trial_ends_at?: string | null;
  access_mode?: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pillClass(value: string) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  const v = value.toLowerCase();
  if (v.includes("active") || v.includes("full"))
    return `${base} border border-emerald-300/40 bg-emerald-500/10 text-emerald-800`;
  if (v.includes("trial")) return `${base} border border-amber-300/40 bg-amber-500/10 text-amber-800`;
  if (
    v.includes("past") ||
    v.includes("expired") ||
    v.includes("canceled") ||
    v.includes("cancelled")
  )
    return `${base} border border-rose-300/40 bg-rose-500/10 text-rose-800`;
  return `${base} border border-neutral-200 bg-neutral-100 text-neutral-700`;
}

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) redirect("/pt/auth/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,subscription_status,subscription_tier,trial_ends_at,access_mode")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const safeProfile: ProfileRow | null = profile ?? null;

  return (
    <div className="mx-auto max-w-[1040px] px-6 py-8 md:px-8">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
          Profile
        </h1>
        <p className="text-base font-normal text-neutral-500">
          Account details, subscription status, and access mode.
        </p>
      </header>

      {profileError && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-500/10 p-4 shadow-sm">
          <p className="text-sm font-medium text-rose-800">Couldn&apos;t load your profile.</p>
          <p className="mt-1 text-sm text-rose-700">Error: {profileError.message}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
          <h2 className="text-base font-semibold text-neutral-900 md:text-lg">Account</h2>
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-500">Email</span>
              <span className="text-sm font-medium text-neutral-900 md:text-base">
                {user.email ?? "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-500">User ID</span>
              <span className="font-mono text-sm font-medium text-neutral-700 md:text-base">
                {user.id}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-500">Created</span>
              <span className="text-sm font-medium text-neutral-900 md:text-base">
                {formatDateTime(user.created_at ?? null)}
              </span>
            </div>
          </div>
        </section>

        {/* Subscription */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-900 md:text-lg">Subscription</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className={pillClass(safeProfile?.subscription_status ?? "unknown")}>
                {safeProfile?.subscription_status ?? "unknown"}
              </span>
              <span className={pillClass(safeProfile?.subscription_tier ?? "—")}>
                {safeProfile?.subscription_tier ?? "—"}
              </span>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-500">Status</span>
              <span className="text-sm font-medium text-neutral-900 md:text-base">
                {safeProfile?.subscription_status ?? "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-500">Tier</span>
              <span className="text-sm font-medium text-neutral-900 md:text-base">
                {safeProfile?.subscription_tier ?? "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-500">Trial ends</span>
              <span className="text-sm font-medium text-neutral-900 md:text-base">
                {formatDateTime(safeProfile?.trial_ends_at ?? null)}
              </span>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 text-sm text-neutral-600">
            Billing changes happen on your Billing page. This screen is read-only.
          </div>
        </section>

        {/* Access - full width */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:col-span-2 md:p-6">
          <h2 className="text-base font-semibold text-neutral-900 md:text-lg">Access</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-muted/30 p-4">
              <p className="text-sm font-medium text-neutral-500">Access mode</p>
              <p className="mt-2 text-sm font-medium text-neutral-900 md:text-base">
                {safeProfile?.access_mode ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-muted/30 p-4">
              <p className="text-sm font-medium text-neutral-500">Effective access</p>
              <p className="mt-2 text-sm font-medium text-neutral-900 md:text-base">
                {safeProfile?.access_mode ?? "—"}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <SignOutButton />
            <p className="text-sm text-neutral-500">
              If anything looks wrong (tier/status/trial), contact{" "}
              <span className="font-medium text-neutral-900">support@meetmilo.app</span>.
            </p>
          </div>
        </section>

        {/* Security - full width */}
        <div className="md:col-span-2">
          <SecurityCard />
        </div>
      </div>
    </div>
  );
}
