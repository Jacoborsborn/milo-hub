import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export type PtNotification = {
  id: string;
  pt_user_id: string;
  type: string;
  title: string;
  message: string;
  link_path: string | null;
  is_read: boolean;
  created_at: string;
};

export async function GET(request: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread_only") === "true";
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));

  let query = supabase
    .from("pt_notifications")
    .select("id, type, title, message, link_path, is_read, created_at")
    .eq("pt_user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/notifications]", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
