import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("pt_notifications")
    .update({ is_read: true })
    .eq("pt_user_id", userData.user.id)
    .eq("is_read", false);

  if (error) {
    console.error("[POST /api/notifications/mark-all-read]", error);
    return NextResponse.json({ error: "Failed to mark all read" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
