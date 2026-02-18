"use server";

import { supabaseServer } from "../supabase/server";
import { redirect } from "next/navigation";

export type PtTemplateRow = { id: string; name: string };

async function getCurrentUserId(): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/pt/auth/login");
  return data.user.id;
}

export async function listPtTemplates(): Promise<PtTemplateRow[]> {
  const ptUserId = await getCurrentUserId();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("pt_templates")
    .select("id, name")
    .eq("pt_user_id", ptUserId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list workout programs: ${error.message}`);
  return (data ?? []) as PtTemplateRow[];
}
