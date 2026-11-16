import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { data, error } = await supabase.from("projects").select("id,name,module,status,created_at,updated_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ projects: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load projects." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const allowed = ["bot-hosting","api-studio","osint","cloud-storage","firebase","community","streaming","developer-hub"];
    const module = typeof body.module === "string" ? body.module : "";
    if (!name || !allowed.includes(module)) return NextResponse.json({ error: "Enter a project name and choose a valid module." }, { status: 400 });
    const { data, error } = await supabase.from("projects").insert({ owner_id: user.id, name, module }).select("id,name,module,status,created_at").single();
    if (error) throw error;
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create project." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Project id is required." }, { status: 400 });
    const { error } = await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete project." }, { status: 500 });
  }
}
