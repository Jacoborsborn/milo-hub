import Link from "next/link";
import PtHubSuccessClient from "./PtHubSuccessClient";

export const metadata = {
  title: "Trial started — Milo PT Hub",
  description:
    "Your trial is active. Open the PT Hub on your laptop/desktop for the best experience.",
};

export default function PtHubSuccessPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-center border-b border-neutral-100 px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/assets/MiloMetal.png"
            alt="Milo Hub"
            width={34}
            height={34}
            className="h-[34px] w-[34px] rounded-xl object-contain"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Milo Hub</div>
            <div className="text-xs text-neutral-500">PT Hub</div>
          </div>
        </Link>
      </header>

      <section className="mx-auto w-full max-w-2xl px-5 py-12">
        <PtHubSuccessClient />
      </section>
    </main>
  );
}
