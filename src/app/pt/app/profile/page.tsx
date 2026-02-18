import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

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
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";
  const v = value.toLowerCase();
  if (v.includes("active") || v.includes("full")) return `${base} border-emerald-300/40 bg-emerald-500/10 text-emerald-800`;
  if (v.includes("trial")) return `${base} border-amber-300/40 bg-amber-500/10 text-amber-800`;
  if (v.includes("past") || v.includes("expired") || v.includes("canceled") || v.includes("cancelled"))
    return `${base} border-rose-300/40 bg-rose-500/10 text-rose-800`;
  return `${base} border-neutral-200 bg-neutral-100 text-neutral-700`;
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
    <div className="max-w-5xl mx-auto">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Profile</h1>
        <p className="text-sm text-neutral-500">
          Account details, subscription status, and access mode.
        </p>
      </header>

      {profileError && (
        <div className="mb-6 rounded-lg border border-rose-300/40 bg-rose-500/10 p-4 text-sm text-rose-800">
          <p className="font-medium">Couldn&apos;t load your profile.</p>
          <p className="mt-1 text-rose-700">Error: {profileError.message}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Account</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-neutral-500">Email</span>
              <span className="font-medium text-neutral-900">{user.email ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-neutral-500">User ID</span>
              <span className="font-mono text-xs text-neutral-700">{user.id}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-neutral-500">Created</span>
              <span className="font-medium text-neutral-900">
                {formatDateTime(user.created_at ?? null)}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">Subscription</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-neutral-500">Status</span>
              <span className={pillClass(safeProfile?.subscription_status ?? "unknown")}>
                {safeProfile?.subscription_status ?? "unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-neutral-500">Tier</span>
              <span className={pillClass(safeProfile?.subscription_tier ?? "—")}>
                {safeProfile?.subscription_tier ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-neutral-500">Trial ends</span>
              <span className="font-medium text-neutral-900">
                {formatDateTime(safeProfile?.trial_ends_at ?? null)}
              </span>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-600">
            Billing changes happen on your Billing page. This screen is read-only.
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm md:col-span-2">
          <h2 className="text-base font-semibold text-neutral-900">Access</h2>
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">Access mode</p>
              <p className="mt-1 font-medium text-neutral-900">{safeProfile?.access_mode ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs text-neutral-500">Effective access</p>
              <p className="mt-1 font-medium text-neutral-900">{safeProfile?.access_mode ?? "—"}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form action="/pt/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 sm:w-auto"
              >
                Sign out
              </button>
            </form>
            <p className="text-xs text-neutral-500">
              If anything looks wrong (tier/status/trial), contact{" "}
              <span className="font-medium text-neutral-900">support@meetmilo.app</span>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
