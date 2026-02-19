/**
 * Single source of truth for Terms & Conditions body content.
 * Used by both /pt/app/terms page and signup LegalModal.
 */

export function TermsContent() {
  return (
    <section className="space-y-8 text-sm leading-6 text-neutral-700">
      <section className="space-y-3">
        <p>
          These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of the Milo Hub platform
          (&ldquo;Platform&rdquo;, &ldquo;Service&rdquo;), operated by{" "}
          <span className="font-medium text-neutral-900">Jacob Buckley Orsborn-smith trading as Milo Hub</span> (&ldquo;Company&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).
        </p>
        <p>
          By accessing or using Milo Hub, you agree to these Terms. If you do not agree, you must
          not use the Platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">1. About Milo Hub</h2>
        <p>Milo Hub is a software platform designed for personal trainers and fitness professionals to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Create and manage client workout plans</li>
          <li>Generate meal plans</li>
          <li>Store client information</li>
          <li>Share plans with clients</li>
          <li>Manage subscriptions and billing</li>
        </ul>
        <p>
          Milo Hub is a business tool and does not replace professional medical, nutritional, or
          legal advice.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">2. Eligibility</h2>
        <p>You must:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Be at least 18 years old</li>
          <li>Use the Platform for lawful purposes</li>
          <li>Provide accurate account information</li>
        </ul>
        <p>You are responsible for maintaining the confidentiality of your login credentials.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">3. Accounts</h2>
        <p>When creating an account:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>You must provide accurate information</li>
          <li>You are responsible for activity under your account</li>
          <li>You must notify us immediately of any unauthorised access</li>
        </ul>
        <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>
      </section>

      <section id="subscription" className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">4. Subscriptions &amp; Billing</h2>
        <p>Milo Hub operates on a subscription basis.</p>
        <div className="space-y-2">
          <h3 className="font-semibold text-neutral-900">4.1 Free Trials</h3>
          <p>If a free trial is offered:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>You will not be charged during the trial period.</li>
            <li>After the trial ends, your subscription will automatically begin unless cancelled.</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-neutral-900">4.2 Payments</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Payments are processed via third-party providers (e.g. Stripe).</li>
            <li>You authorise recurring billing according to your selected plan.</li>
            <li>All subscription fees are non-refundable once billed, except where required by UK law.</li>
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-neutral-900">4.3 Cancellation</h3>
          <p>
            You may cancel at any time to stop future charges. Cancellation can be done via your
            account dashboard and does not refund prior payments.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">5. Acceptable Use</h2>
        <p>You agree NOT to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Upload unlawful, abusive, or harmful content</li>
          <li>Store sensitive medical data beyond your legal right to do so</li>
          <li>Attempt to reverse engineer, copy, or exploit the software</li>
          <li>Use the Platform to provide illegal services</li>
        </ul>
        <p>We reserve the right to suspend access for violations.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">6. Client Data &amp; Responsibilities</h2>
        <p>If you use Milo Hub to store client information:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>You are the data controller for your clients&rsquo; personal data.</li>
          <li>You are responsible for obtaining client consent.</li>
          <li>You must comply with applicable data protection laws (including UK GDPR).</li>
        </ul>
        <p>
          Milo Hub acts as a data processor in relation to client data stored on the Platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">7. AI-Generated Content Disclaimer</h2>
        <p>
          Some features may generate suggestions, plans, or text using automated systems
          (&ldquo;AI Output&rdquo;). AI Output:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>May be inaccurate, incomplete, or unsuitable for specific individuals</li>
          <li>Is provided for informational and productivity purposes only</li>
          <li>Must be reviewed by you before use with any client</li>
        </ul>
        <p>
          You are solely responsible for verifying any AI Output before providing it to clients
          and for ensuring it is safe, appropriate, and compliant with your professional duties.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">8. Health &amp; Safety Disclaimer</h2>
        <p>
          Milo Hub does not provide medical advice. You agree that you (and not Milo Hub) are
          responsible for:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Assessing client readiness for exercise and nutrition changes</li>
          <li>Ensuring plans are safe for each client&rsquo;s health conditions</li>
          <li>Recommending medical consultation where appropriate</li>
        </ul>
        <p>
          To the maximum extent permitted by law, we are not liable for injury, illness, loss, or
          damages arising from workouts, meal plans, or advice delivered by you using the Platform.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">9. Intellectual Property</h2>
        <p>
          The Platform, including its design, code, trademarks, and branding, is owned by or
          licensed to us and is protected by intellectual property laws.
        </p>
        <p>
          You may not copy, modify, distribute, sell, or lease any part of the Platform unless we
          explicitly permit it in writing.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">10. Your Content</h2>
        <p>
          You retain ownership of the content you upload to Milo Hub (&ldquo;User Content&rdquo;).
          You grant us a limited licence to host, store, and process User Content solely to
          provide the Service.
        </p>
        <p>
          You confirm you have the rights and permissions needed to upload and use any User
          Content, including client data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">11. Service Availability</h2>
        <p>
          We aim to keep Milo Hub available and reliable, but we do not guarantee uninterrupted
          access. We may suspend or limit access for maintenance, updates, or security reasons.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">12. Termination</h2>
        <p>
          We may suspend or terminate your account if you breach these Terms or use the Service in
          a harmful or unlawful way.
        </p>
        <p>
          You may stop using the Service at any time. If you cancel your subscription, your access
          may continue until the end of the billing period.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">13. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, we will not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or any loss of profits, data,
          or goodwill, arising from your use of the Platform.
        </p>
        <p>
          Our total liability for any claim relating to the Service will not exceed the amount you
          paid us in the 3 months before the event giving rise to the claim (or £100 if greater),
          except where liability cannot be excluded by law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">14. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. If changes are significant, we will take
          reasonable steps to notify you. Continued use of Milo Hub after changes means you accept
          the updated Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">15. Governing Law</h2>
        <p>
          These Terms are governed by the laws of <span className="font-medium text-neutral-900">England and Wales</span>.
          Any disputes will be subject to the exclusive jurisdiction of the courts of{" "}
          <span className="font-medium text-neutral-900">England and Wales</span>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-neutral-900">16. Contact</h2>
        <p>If you have questions about these Terms, contact us:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Email: <span className="font-medium text-neutral-900">support@meetmilo.app</span>
          </li>
          <li>
            Business name: <span className="font-medium text-neutral-900">Jacob Buckley Orsborn-smith trading as Milo Hub</span>
          </li>
          <li>
            Address: <span className="font-medium text-neutral-900">Hiatt Baker, Main Building, Bristol</span>
          </li>
        </ul>
      </section>

      <hr className="my-8 border-neutral-200" />

      <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs leading-5 text-neutral-600">
        <p className="font-medium text-neutral-900">Important note</p>
        <p className="mt-1">
          This template is provided for convenience and is not legal advice. For a final review,
          consider consulting a solicitor to ensure compliance with your business model and
          data-processing setup.
        </p>
      </section>
    </section>
  );
}
