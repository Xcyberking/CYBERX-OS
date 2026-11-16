import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const postId = body && typeof body.post_id === "string" ? body.post_id : "";
  if (!postId) return NextResponse.json({ error: "Post id required." }, { status: 400 });
  const { data: existing } = await supabase.from("community_likes").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("community_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ liked: false });
  }
  const { error } = await supabase.from("community_likes").insert({ post_id: postId, user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ liked: true });
}
