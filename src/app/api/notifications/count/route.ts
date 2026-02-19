import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count, error } = await supabase
    .from("pt_notifications")
    .select("id", { count: "exact", head: true })
    .eq("pt_user_id", userData.user.id)
    .eq("is_read", false);

  if (error) {
    console.error("[GET /api/notifications/count]", error);
    return NextResponse.json({ error: "Failed to get count" }, { status: 500 });
  }

  return NextResponse.json({ unread: count ?? 0 });
}
