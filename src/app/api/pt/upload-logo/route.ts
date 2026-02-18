import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = ["image/png", "image/svg+xml", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const BUCKET = "public-assets";

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Use PNG, SVG, or WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 2MB." },
      { status: 400 }
    );
  }

  const ext = file.type === "image/svg+xml" ? "svg" : file.type === "image/webp" ? "webp" : "png";
  const path = `pt-logos/${userData.user.id}/logo.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    console.error("[POST /api/pt/upload-logo]", error);
    return NextResponse.json(
      { error: error.message || "Upload failed. Ensure the storage bucket exists and RLS allows uploads." },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl });
}
