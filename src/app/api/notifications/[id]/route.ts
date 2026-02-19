import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("pt_notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("pt_user_id", userData.user.id);

  if (error) {
    console.error("[PATCH /api/notifications/:id]", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
