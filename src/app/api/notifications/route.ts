import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await supabase.from("notifications")
    .select("id,title,body,read_at,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Notifications are unavailable." }, { status: 500 });
  return NextResponse.json({ notifications: data || [], unread: (data || []).filter(item => !item.read_at).length });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null) as { id?: unknown; all?: unknown } | null;
  if (!input || (input.all !== true && typeof input.id !== "string")) {
    return NextResponse.json({ error: "Provide a notification id or all=true." }, { status: 400 });
  }
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id).is("read_at", null);
  if (input.all !== true) query = query.eq("id", input.id as string);
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Could not update notification." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
