import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to view the community." }, { status: 401 });
    const { data, error } = await supabase.from("community_posts")
      .select("id,author_id,body,visibility,created_at")
      .eq("visibility", "public").order("created_at", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const posts = data || [];
    const ids = posts.map(post => post.id);
    if (!ids.length) return NextResponse.json({ posts: [] });
    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabase.from("community_likes").select("post_id,user_id").in("post_id", ids),
      supabase.from("community_comments").select("post_id").in("post_id", ids)
    ]);
    const enriched = posts.map(post => {
      const postLikes = (likes || []).filter(row => row.post_id === post.id);
      return { ...post, likes_count: postLikes.length, comments_count: (comments || []).filter(row => row.post_id === post.id).length, liked_by_me: postLikes.some(row => row.user_id === user.id) };
    });
    return NextResponse.json({ posts: enriched });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Community is unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to publish a post." }, { status: 401 });
    const body = await request.json();
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (text.length < 1 || text.length > 5000) return NextResponse.json({ error: "Posts must contain 1–5000 characters." }, { status: 400 });
    const { data, error } = await supabase.from("community_posts")
      .insert({ author_id: user.id, body: text, visibility: "public" })
      .select("id,author_id,body,visibility,created_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ post: { ...data, likes_count: 0, comments_count: 0, liked_by_me: false } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not publish post." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Post id is required." }, { status: 400 });
    const { error } = await supabase.from("community_posts").delete().eq("id", id).eq("author_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete post." }, { status: 500 });
  }
}
