import { NextResponse } from "next/server";

/**
 * Cron endpoint: call once daily to run pt-autogen-drafts.
 * Secure with CRON_SECRET or AUTOGEN_SECRET in env.
 *
 * Vercel Cron (vercel.json) calls this at 06:00 UTC and sends Authorization: Bearer <CRON_SECRET>.
 * Also accepts body { "secret": "..." } for manual calls.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const secret =
    authHeader?.replace("Bearer ", "").trim() ||
    (await req.json().catch(() => ({}))).secret;
  const expected = process.env.CRON_SECRET || process.env.AUTOGEN_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Autogen cron invoked");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/pt-autogen-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.AUTOGEN_SECRET || expected,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        res.status === 404
          ? "Autogen function not found (404). Deploy with: supabase functions deploy pt-autogen-drafts"
          : (data as { error?: string }).error || "Autogen failed";
      console.error("AUTOGEN ERROR (function response not ok):", res.status, data);
      return NextResponse.json(
        {
          error: "Autogen failed",
          details: message,
          invokeError: res.status,
          invokeData: data,
        },
        { status: 500 }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("AUTOGEN ERROR:", err);
    const errObj = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json(
      {
        error: "Autogen failed",
        details: String(errObj.message || err),
        stack: errObj.stack ?? null,
      },
      { status: 500 }
    );
  }
}
