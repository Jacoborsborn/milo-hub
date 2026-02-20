import { redirect } from "next/navigation";

/**
 * Redirect /auth/signup?from=... to /signup?from=... so PT Hub (and other) links work.
 */
export default async function AuthSignupRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "")
      qs.set(k, Array.isArray(v) ? v[0]! : v);
  });
  const query = qs.toString();
  redirect(query ? `/signup?${query}` : "/signup");
}
