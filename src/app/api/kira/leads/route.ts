import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const { name, age, country, email, instagram, plan_selected, goal, fitness_level, days_per_week, equipment, injuries, referral_source, notes } = body;

  if (!name || !age || !country || !email) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("kira_leads")
    .insert({
      name,
      age,
      country,
      email,
      instagram: instagram || null,
      plan_selected: plan_selected || null,
      goal: goal || null,
      fitness_level: fitness_level || null,
      days_per_week: days_per_week || null,
      equipment: equipment || null,
      injuries: injuries || null,
      referral_source: referral_source || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[kira/leads] Supabase insert error:", error);
    return NextResponse.json({ error: "Failed to save application." }, { status: 500 });
  }

  return NextResponse.json({ lead_id: data.id }, { status: 201 });
}
