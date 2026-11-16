import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await supabase.from("firebase_projects")
    .select("id,name,project_id,app_id,database_url,created_at,updated_at")
    .eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data || [] });
}
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const projectId = typeof input.project_id === "string" ? input.project_id.trim() : "";
  const appId = typeof input.app_id === "string" ? input.app_id.trim() : "";
  const databaseUrl = typeof input.database_url === "string" ? input.database_url.trim() : "";
  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Name must be 2–80 characters." }, { status: 400 });
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{3,62}$/.test(projectId)) return NextResponse.json({ error: "Enter a valid Firebase project ID." }, { status: 400 });
  if (appId && appId.length > 180) return NextResponse.json({ error: "App ID is too long." }, { status: 400 });
  if (databaseUrl) {
    try { const url = new URL(databaseUrl); if (url.protocol !== "https:" || !url.hostname.endsWith("firebasedatabase.app") && !url.hostname.endsWith("firebaseio.com")) throw new Error(); }
    catch { return NextResponse.json({ error: "Database URL must be a valid HTTPS Firebase Realtime Database URL." }, { status: 400 }); }
  }
  const { data, error } = await supabase.from("firebase_projects")
    .insert({ owner_id: user.id, name, project_id: projectId, app_id: appId || null, database_url: databaseUrl || null })
    .select("id,name,project_id,app_id,database_url,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project: data }, { status: 201 });
}
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Project record ID is required." }, { status: 400 });
  const { error } = await supabase.from("firebase_projects").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
