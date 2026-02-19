// Static page: no Supabase or auth at build time. Middleware protects /pt/app/* at runtime.
import { TermsContent } from "@/components/legal/TermsContent";

export const metadata = {
  title: "Terms & Conditions | Milo Hub",
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm px-6 py-8 sm:px-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Terms &amp; Conditions</h1>
          <p className="mt-2 text-sm text-neutral-500">
            <span className="font-medium">Last Updated:</span> 18/02/2026
          </p>
        </header>

        <TermsContent />
      </div>
    </div>
  );
}
