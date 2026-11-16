"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, RefreshCw, ShieldCheck, Users } from "lucide-react";

type UserRow = { id: string; email?: string; created_at: string; last_sign_in_at?: string; confirmed: boolean; profile: { role?: string; credits?: number; display_name?: string } };

export default function AdminPage() {
  const [users,setUsers]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  async function load() {
    setLoading(true);setMessage("");
    try {const response=await fetch("/api/admin/users",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not load users.");setUsers(data.users||[]);}
    catch(e){setMessage(e instanceof Error?e.message:"Request failed.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function save(user:UserRow,form:FormData) {
    setBusy(user.id);setMessage("");
    try {const response=await fetch("/api/admin/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:user.id,role:form.get("role"),credits:Number(form.get("credits")),reason:String(form.get("reason")||"Admin adjustment")})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Update failed.");setMessage("User settings saved.");await load();}
    catch(e){setMessage(e instanceof Error?e.message:"Update failed.");}
    finally{setBusy("");}
  }
  return <main className="grid-bg min-h-screen p-4 sm:p-8"><div className="mx-auto max-w-6xl">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><Link href="/" className="mb-4 inline-flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-300"><ArrowLeft size={14}/> Workspace</Link><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300"><ShieldCheck/></span><div><h1 className="text-2xl font-bold">Admin control</h1><p className="text-xs text-slate-500">Manage account roles and credit balances</p></div></div></div><Link href="/admin/tools" className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 px-4 py-2.5 text-xs text-cyan-200">Manage OSINT tools</Link><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-300"><RefreshCw size={14}/> Refresh</button></header>
    <div className="panel mb-5 flex items-center gap-3 rounded-2xl p-4"><Users className="text-cyan-300"/><div><div className="text-sm font-semibold">{users.length} accounts loaded</div><div className="text-xs text-slate-500">First 1,000 accounts · role and credits are server-managed</div></div></div>
    {message&&<p role="status" className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-xs text-cyan-100">{message}</p>}
    {loading?<div className="panel rounded-2xl p-10 text-center text-sm text-slate-400"><LoaderCircle className="mx-auto mb-3 animate-spin"/>Loading accounts…</div>:users.length===0?<div className="panel rounded-2xl p-8 text-center text-sm text-slate-400">No accounts found, or admin configuration is not ready.</div>:
      <div className="space-y-3">{users.map(user=><form key={user.id} onSubmit={(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void save(user,new FormData(event.currentTarget));}} className="panel grid gap-4 rounded-2xl p-4 md:grid-cols-[minmax(0,1.3fr)_130px_130px_minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0"><div className="truncate text-sm font-semibold">{user.profile.display_name||user.email||user.id}</div><div className="mt-1 truncate text-xs text-slate-500">{user.email}</div><div className="mt-1 text-[10px] text-slate-600">{user.confirmed?"Email confirmed":"Email pending"}</div></div>
        <label className="text-[10px] text-slate-500">Role<select name="role" defaultValue={user.profile.role||"user"} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080e19] px-2 py-2 text-xs text-white"><option value="user">User</option><option value="admin">Admin</option></select></label>
        <label className="text-[10px] text-slate-500">Credits<input name="credits" type="number" min="0" max="1000000" defaultValue={user.profile.credits??0} className="mt-1 w-full rounded-lg border border-white/10 bg-[#080e19] px-2 py-2 text-xs text-white"/></label>
        <label className="text-[10px] text-slate-500">Reason<input name="reason" maxLength={160} defaultValue="Admin adjustment" className="mt-1 w-full rounded-lg border border-white/10 bg-[#080e19] px-2 py-2 text-xs text-white"/></label>
        <button disabled={busy===user.id} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">{busy===user.id?"Saving…":"Save"}</button>
      </form>)}</div>}
    <p className="mt-6 text-[11px] leading-5 text-slate-600">Privileged actions are written to the audit log. Keep the Supabase service-role key only in server-side environment variables.</p>
  </div></main>;
}
