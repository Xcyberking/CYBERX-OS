"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, MessageSquare, Send, Trash2, Users, Heart, MessageCircle, X } from "lucide-react";

type Comment = { id: string; post_id: string; author_id: string; body: string; created_at: string };
type Post = { id: string; author_id: string; body: string; created_at: string; likes_count: number; comments_count: number; liked_by_me: boolean };
export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/community/posts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load community.");
      setPosts(data.posts || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Community unavailable."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/community/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not publish.");
      setPosts(current => [data.post, ...current]); setBody("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish."); }
    finally { setBusy(false); }
  }
  async function toggleLike(post: Post) {
    setPosts(current => current.map(item => item.id === post.id ? { ...item, liked_by_me: !item.liked_by_me, likes_count: Math.max(0, item.likes_count + (item.liked_by_me ? -1 : 1)) } : item));
    const response = await fetch("/api/community/likes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: post.id }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Like update failed."); await load(); }
  }
  async function showComments(postId: string) {
    if (openPost === postId) { setOpenPost(null); return; }
    setOpenPost(postId);
    const response = await fetch("/api/community/comments?post_id=" + encodeURIComponent(postId), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not load comments."); return; }
    setComments(data.comments || []);
  }
  async function addComment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!openPost) return; setCommentBusy(true);
    try {
      const response = await fetch("/api/community/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post_id: openPost, body: commentBody }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not comment.");
      setComments(current => [...current, data.comment]); setCommentBody("");
      setPosts(current => current.map(p => p.id === openPost ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not comment."); }
    finally { setCommentBusy(false); }
  }
  async function remove(id: string) {
    const response = await fetch("/api/community/posts?id=" + encodeURIComponent(id), { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Delete failed."); return; }
    setPosts(current => current.filter(post => post.id !== id));
  }
  return <main className="grid-bg min-h-screen p-4 sm:p-8"><div className="mx-auto max-w-3xl">
    <div className="mb-6 flex items-center justify-between"><Link href="/" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-200"><ArrowLeft size={14}/> Workspace</Link><Link href="/wallet" className="text-xs text-cyan-200 hover:text-cyan-100">Wallet & credits →</Link></div>
    <div className="mb-7 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-pink-300/10 text-pink-200"><Users/></div><div><h1 className="text-2xl font-bold">CYBERX Community</h1><p className="text-xs text-slate-500">Share updates with the community.</p></div></div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">{error}</p>}
    <form onSubmit={publish} className="panel mb-6 rounded-2xl p-4"><label htmlFor="post-body" className="mb-2 block text-xs font-semibold text-slate-300">Create a public post</label><textarea id="post-body" required maxLength={5000} rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="What's happening in your projects?" className="w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-cyan-300/40"/><div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-slate-600">{body.length}/5000</span><button disabled={busy || !body.trim()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">{busy ? <LoaderCircle size={14} className="animate-spin"/> : <Send size={14}/>}Publish</button></div></form>
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Community feed</h2><button onClick={() => void load()} className="text-[10px] text-cyan-200">Refresh feed</button></div>
    {loading ? <div className="panel rounded-xl p-8 text-center text-sm text-slate-400"><LoaderCircle className="mx-auto mb-2 animate-spin"/>Loading feed…</div> : posts.length === 0 ? <div className="panel rounded-xl p-8 text-center"><MessageSquare className="mx-auto mb-3 text-slate-600"/><p className="text-sm text-slate-400">No posts yet. Start the conversation.</p></div> : <div className="space-y-3">{posts.map(post => <article key={post.id} className="panel rounded-2xl p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-200">Member · {post.author_id.slice(0, 8)}</p><p className="mt-1 text-[10px] text-slate-600">{new Date(post.created_at).toLocaleString()}</p></div><button onClick={() => void remove(post.id)} title="Delete your own post" aria-label="Delete post (only your own posts can be deleted)" className="rounded-lg p-2 text-slate-600 hover:bg-rose-300/10 hover:text-rose-300"><Trash2 size={15}/></button></div><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{post.body}</p><div className="mt-4 flex gap-2 border-t border-white/[.06] pt-3"><button onClick={() => void toggleLike(post)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${post.liked_by_me ? "bg-pink-300/10 text-pink-200" : "text-slate-400 hover:bg-white/5"}`}><Heart size={14} fill={post.liked_by_me ? "currentColor" : "none"}/>{post.likes_count} Likes</button><button onClick={() => void showComments(post.id)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:bg-white/5"><MessageCircle size={14}/>{post.comments_count} Comments</button></div>{openPost === post.id && <div className="mt-3 rounded-xl border border-white/[.07] bg-black/20 p-3"><div className="mb-3 flex items-center justify-between text-xs font-semibold"><span>Comments</span><button onClick={() => setOpenPost(null)} aria-label="Close comments"><X size={14}/></button></div><div className="max-h-64 space-y-3 overflow-y-auto">{comments.map(comment => <div key={comment.id}><p className="text-[10px] text-slate-500">Member · {comment.author_id.slice(0,8)}</p><p className="mt-1 whitespace-pre-wrap text-xs text-slate-300">{comment.body}</p></div>)}{comments.length === 0 && <p className="text-xs text-slate-500">No comments yet.</p>}</div><form onSubmit={addComment} className="mt-3 flex gap-2"><input value={commentBody} onChange={e => setCommentBody(e.target.value)} maxLength={2000} required placeholder="Write a comment…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"/><button disabled={commentBusy || !commentBody.trim()} className="rounded-lg bg-cyan-300 px-3 text-xs font-bold text-slate-950 disabled:opacity-50">Send</button></form></div>}</article>)}</div>}
    <p className="mt-6 text-[10px] leading-5 text-slate-600">Community posts are public to signed-in members. Keep posts respectful and never share private information. You can delete your own posts.</p>
  </div></main>;
}
