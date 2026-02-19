// Static page: no Supabase or auth at build time. Middleware protects /pt/app/* at runtime.
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export const metadata = {
  title: "Privacy Policy | Milo Hub",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm px-6 py-8 sm:px-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-neutral-500">
            <span className="font-medium">Last Updated:</span> 18/02/2026
          </p>
        </header>

        <PrivacyContent />
      </div>
    </div>
  );
}
