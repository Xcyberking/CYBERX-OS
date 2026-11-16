"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
export default function AdminNotificationsPage() {
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form=new FormData(event.currentTarget);
    try {
      const response=await fetch("/api/admin/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:form.get("userId"),title:form.get("title"),body:form.get("body")})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||"Send failed.");
      setMessage("Notification delivered to the selected account."); event.currentTarget.reset();
    } catch(e) { setMessage(e instanceof Error?e.message:"Send failed."); }
    finally { setBusy(false); }
  }
  return <main className="grid-bg min-h-screen p-4 sm:p-8"><div className="mx-auto max-w-2xl">
    <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-xs text-slate-400"><ArrowLeft size={14}/> Admin</Link>
    <h1 className="text-2xl font-bold">Send notification</h1><p className="mb-6 mt-1 text-sm text-slate-500">Send an in-app message to one registered account using its Supabase user UUID.</p>
    {message&&<p role="status" className="mb-4 rounded-xl border border-cyan-300/20 p-3 text-xs text-cyan-100">{message}</p>}
    <form onSubmit={submit} className="panel space-y-4 rounded-2xl p-5">
      <label className="block text-xs text-slate-400">User UUID<input name="userId" required className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" placeholder="Supabase auth user id"/></label>
      <label className="block text-xs text-slate-400">Title<input name="title" required minLength={2} maxLength={100} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" placeholder="Notification title"/></label>
      <label className="block text-xs text-slate-400">Message<textarea name="body" maxLength={1000} rows={4} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" placeholder="Optional message"/></label>
      <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-xs font-bold text-slate-950 disabled:opacity-50"><Send size={14}/>{busy?"Sending…":"Send notification"}</button>
    </form>
  </div></main>;
}
