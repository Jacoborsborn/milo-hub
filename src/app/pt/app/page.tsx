import { supabaseServer } from "../../../lib/supabase/server";
import { redirect } from "next/navigation";
import ControlWall from "@/components/pt/dashboard/ControlWall";

export default async function Dashboard() {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      redirect("/pt/auth/login");
    }

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">Live overview of clients, plans, and deadlines.</p>
        </header>
        <ControlWall />
      </div>
    );
  } catch (error) {
    if ((error as any)?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p className="text-red-600">
          {error instanceof Error ? error.message : "Missing Supabase configuration. Please set environment variables."}
        </p>
        <p className="mt-4">
          <a href="/pt/auth/login" className="text-neutral-600 underline hover:no-underline">Go to Login</a>
        </p>
      </div>
    );
  }
}
