import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = {
  title: "Privacy Policy | Milo Hub",
};

export default async function PrivacyPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/pt/auth/login");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm px-6 py-8 sm:px-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-neutral-500">
            <span className="font-medium">Last Updated:</span> 18/02/2026
          </p>
        </header>

        <section className="space-y-8 text-sm leading-6 text-neutral-700">
          <section className="space-y-3">
            <p>
              This Privacy Policy explains how{" "}
              <span className="font-medium text-neutral-900">
                Jacob Buckley Orsborn-smith trading as Milo Hub
              </span>{" "}
              (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, and protects your information when you use the Milo Hub platform (&ldquo;Platform&rdquo;).
            </p>
            <p>
              If you have any questions, contact:{" "}
              <span className="font-medium text-neutral-900">support@meetmilo.app</span>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">1. Who We Are</h2>
            <p>Data Controller: Jacob Buckley Orsborn-smith trading as Milo Hub</p>
            <p>Address: Hiatt Baker, Main Building, Bristol</p>
            <p>Email: support@meetmilo.app</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">2. Information We Collect</h2>
            <h3 className="font-semibold text-neutral-900">2.1 Account Information</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name</li>
              <li>Email address</li>
              <li>Password (encrypted)</li>
              <li>Subscription details</li>
            </ul>
            <h3 className="font-semibold text-neutral-900">2.2 Client Data (Uploaded by You)</h3>
            <p>
              If you are a personal trainer using Milo Hub, you may store client information including:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Names</li>
              <li>Fitness goals</li>
              <li>Workout plans</li>
              <li>Meal plans</li>
              <li>Health-related information you choose to store</li>
            </ul>
            <p>
              You are responsible for ensuring you have lawful grounds and client consent to store this information.
            </p>
            <h3 className="font-semibold text-neutral-900">2.3 Technical Data</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>IP address</li>
              <li>Browser type</li>
              <li>Device information</li>
              <li>Usage logs</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and operate the Platform</li>
              <li>To manage subscriptions and payments</li>
              <li>To improve features and performance</li>
              <li>To respond to support requests</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">4. Legal Basis (UK GDPR)</h2>
            <p>We process personal data under the following lawful bases:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Performance of a contract (providing the Service)</li>
              <li>Legitimate interests (improving and securing the Platform)</li>
              <li>Legal obligation</li>
              <li>Consent (where required)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">5. Data Storage &amp; Security</h2>
            <p>
              We use reputable third-party providers to host and operate the Platform (such as Supabase and Stripe).
            </p>
            <p>
              We implement reasonable technical and organisational measures to protect your data.
              However, no online system can be guaranteed 100% secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">6. Data Sharing</h2>
            <p>We do not sell your data.</p>
            <p>We may share data with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Payment processors (e.g., Stripe)</li>
              <li>Hosting providers</li>
              <li>Professional advisers if legally required</li>
            </ul>
            <p>
              Data may be processed outside the UK where appropriate safeguards are in place.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">7. Data Retention</h2>
            <p>
              We retain account data while your subscription is active.
              After cancellation, data may be deleted within a reasonable period unless required for legal or accounting purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">8. Your Rights</h2>
            <p>Under UK GDPR, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion (where applicable)</li>
              <li>Restrict or object to processing</li>
              <li>Data portability</li>
            </ul>
            <p>To exercise your rights, contact: support@meetmilo.app</p>
            <p>
              You also have the right to lodge a complaint with the UK Information Commissioner&rsquo;s Office (ICO).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">9. Cookies</h2>
            <p>
              Milo Hub may use essential cookies required for authentication and security.
              We do not use advertising tracking cookies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-neutral-900">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time.
              Continued use of the Platform after changes indicates acceptance of the updated policy.
            </p>
          </section>

          <hr className="my-8 border-neutral-200" />

          <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600">
            <p>
              This Privacy Policy is provided for general informational purposes and does not constitute legal advice.
              Consider seeking independent legal advice to ensure full compliance with UK GDPR.
            </p>
          </section>
        </section>
      </div>
    </div>
  );
}
