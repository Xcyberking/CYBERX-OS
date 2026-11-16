import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await createClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: profile } = await auth.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 });
  const body = await request.json().catch(() => null) as { userId?: unknown; title?: unknown; body?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (!userId || title.length < 2 || title.length > 100 || message.length > 1000) {
    return NextResponse.json({ error: "A user id, 2–100 character title and up to 1,000 character message are required." }, { status: 400 });
  }
  const service = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: target, error: targetError } = await service.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (targetError || !target) return NextResponse.json({ error: "Target user not found." }, { status: 404 });
  const { data, error } = await service.from("notifications").insert({ user_id: userId, title, body: message })
    .select("id,title,body,created_at").single();
  if (error) return NextResponse.json({ error: "Could not send notification." }, { status: 500 });
  await service.from("audit_logs").insert({ actor_id: user.id, action: "admin.notification.sent", target_id: userId, details: { notification_id: data.id } });
  return NextResponse.json({ notification: data }, { status: 201 });
}
