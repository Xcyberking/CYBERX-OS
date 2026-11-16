import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function getAdminContext() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: profile } = await auth.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { response: NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 }) };
  const admin = createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return { admin, actorId: user.id };
}

export async function GET() {
  const context = await getAdminContext();
  if ("response" in context) return context.response;
  const { data, error } = await context.admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = data.users.map(user => user.id);
  const { data: profiles, error: profileError } = ids.length
    ? await context.admin.from("profiles").select("id,display_name,role,credits,created_at").in("id", ids)
    : { data: [], error: null };
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  const byId = new Map((profiles || []).map(profile => [profile.id, profile]));
  return NextResponse.json({ users: data.users.map(user => ({
    id: user.id, email: user.email, created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at, confirmed: Boolean(user.email_confirmed_at),
    profile: byId.get(user.id) || { role: "user", credits: 0, display_name: "" }
  })) });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext();
  if ("response" in context) return context.response;
  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;
    const credits = Number(body.credits);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 160) : "Admin adjustment";
    if (!userId || !role || !Number.isSafeInteger(credits) || credits < 0 || credits > 1000000) {
      return NextResponse.json({ error: "Valid user, role and non-negative credits are required." }, { status: 400 });
    }
    if (userId === context.actorId && role !== "admin") {
      return NextResponse.json({ error: "You cannot remove your own admin access here." }, { status: 400 });
    }
    const { error: creditError } = await context.admin.rpc("admin_set_user_credits", {
      p_actor_id: context.actorId, p_user_id: userId, p_new_balance: credits, p_reason: reason
    });
    if (creditError) return NextResponse.json({ error: creditError.message }, { status: 400 });
    const { error: roleError } = await context.admin.from("profiles")
      .update({ role, updated_at: new Date().toISOString() }).eq("id", userId);
    if (roleError) return NextResponse.json({ error: "Credits saved, but role update failed: " + roleError.message }, { status: 500 });
    await context.admin.from("audit_logs").insert({
      actor_id: context.actorId, action: "admin.profile.role_updated", target_id: userId,
      details: { role }
    });
    return NextResponse.json({ ok: true, credits, role });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
