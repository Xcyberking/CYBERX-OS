import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function signedIn() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

export async function GET() {
  const { supabase, user } = await signedIn();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const [{ data: groups, error }, { data: memberships, error: memberError }] = await Promise.all([
    supabase.from("community_groups").select("id,owner_id,name,description,created_at").order("created_at",{ascending:false}).limit(100),
    supabase.from("community_group_members").select("group_id").eq("user_id",user.id)
  ]);
  if (error || memberError) return NextResponse.json({ error: "Could not load groups. Apply migration 0008." }, { status: 500 });
  const mine = new Set((memberships || []).map(row => row.group_id));
  return NextResponse.json({ groups: (groups || []).map(group => ({ ...group, joined: mine.has(group.id), is_owner: group.owner_id === user.id })) });
}

export async function POST(request: Request) {
  const { supabase, user } = await signedIn();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null) as { action?: unknown; groupId?: unknown; name?: unknown; description?: unknown } | null;
  if (!input) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (input.action === "join" || input.action === "leave") {
    const groupId = typeof input.groupId === "string" ? input.groupId : "";
    if (!groupId) return NextResponse.json({ error: "Group id required." }, { status: 400 });
    if (input.action === "join") {
      const { error } = await supabase.from("community_group_members").upsert({ group_id: groupId, user_id: user.id }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: "Could not join this group." }, { status: 400 });
    } else {
      const { error } = await supabase.from("community_group_members").delete().eq("group_id",groupId).eq("user_id",user.id);
      if (error) return NextResponse.json({ error: "Could not leave this group." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (name.length < 3 || name.length > 60 || description.length > 500) {
    return NextResponse.json({ error: "Group name must be 3–60 characters; description up to 500." }, { status: 400 });
  }
  const { data: group, error } = await supabase.from("community_groups")
    .insert({ owner_id: user.id, name, description }).select("id,owner_id,name,description,created_at").single();
  if (error || !group) return NextResponse.json({ error: "Could not create group." }, { status: 400 });
  const { error: joinError } = await supabase.from("community_group_members").insert({ group_id: group.id, user_id: user.id });
  if (joinError) {
    await supabase.from("community_groups").delete().eq("id",group.id).eq("owner_id",user.id);
    return NextResponse.json({ error: "Group created but membership setup failed." }, { status: 500 });
  }
  return NextResponse.json({ group: { ...group, joined: true } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await signedIn();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Group id required." }, { status: 400 });
  const { error } = await supabase.from("community_groups").delete().eq("id",id).eq("owner_id",user.id);
  if (error) return NextResponse.json({ error: "Could not delete group." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
