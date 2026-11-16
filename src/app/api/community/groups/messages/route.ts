import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const groupId = new URL(request.url).searchParams.get("group_id");
  if (!groupId) return NextResponse.json({ error: "Group id required." }, { status: 400 });
  const { data, error } = await supabase.from("community_group_messages")
    .select("id,group_id,author_id,body,created_at").eq("group_id",groupId)
    .order("created_at",{ascending:false}).limit(100);
  if (error) return NextResponse.json({ error: "Join this group to read its chat." }, { status: 403 });
  return NextResponse.json({ messages: (data || []).reverse() });
}
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null) as { group_id?: unknown; body?: unknown } | null;
  const groupId = typeof input?.group_id === "string" ? input.group_id : "";
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  if (!groupId || body.length < 1 || body.length > 1500) return NextResponse.json({ error: "Group and message (1–1500 characters) required." }, { status: 400 });
  const { data, error } = await supabase.from("community_group_messages")
    .insert({ group_id: groupId, author_id: user.id, body })
    .select("id,group_id,author_id,body,created_at").single();
  if (error) return NextResponse.json({ error: "Only group members can send messages." }, { status: 403 });
  return NextResponse.json({ message: data }, { status: 201 });
}
