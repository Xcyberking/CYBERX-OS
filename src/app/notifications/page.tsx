"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, CheckCheck, LoaderCircle, RefreshCw, Search } from "lucide-react";
type Notice = { id: string; title: string; body: string; read_at: string | null; created_at: string };
export default function NotificationsPage() {
  const [items,setItems]=useState<Notice[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<"all"|"unread"|"read">("all");
  async function load() {
    setLoading(true); setError("");
    try {
      const response=await fetch("/api/notifications",{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Could not load notifications.");
      setItems(data.notifications||[]);
    } catch(e) { setError(e instanceof Error?e.message:"Notifications unavailable."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{void load();},[]);
  async function markRead(id?:string) {
    const response=await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{id}:{all:true})});
    const data=await response.json();
    if(!response.ok){setError(data.error||"Could not update notifications.");return;}
    const now=new Date().toISOString();
    setItems(current=>current.map(item=>!id||item.id===id?{...item,read_at:now}:item));
  }
  const unread=items.filter(item=>!item.read_at).length;
  const visible=items.filter(item=>(filter==="all"||(filter==="unread"?!item.read_at:!!item.read_at))&&(item.title+" "+item.body).toLowerCase().includes(query.toLowerCase()));
  return <main className="grid-bg min-h-screen p-4 sm:p-8"><div className="mx-auto max-w-3xl">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/" className="mb-4 inline-flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-200"><ArrowLeft size={14}/> Workspace</Link><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Bell/></span><div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-xs text-slate-500">{unread} unread · latest 100</p></div></div></div>
      <div className="flex gap-2"><button onClick={()=>void load()} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300"><RefreshCw size={14}/></button><button disabled={!unread} onClick={()=>void markRead()} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 px-3 py-2 text-xs text-cyan-200 disabled:opacity-40"><CheckCheck size={14}/> Mark all read</button></div>
    </header>
    {error&&<p role="alert" className="mb-4 rounded-xl border border-rose-300/20 p-3 text-xs text-rose-200">{error}</p>}
    <div className="panel mb-4 flex flex-wrap items-center gap-2 rounded-xl p-3"><div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-white/10 px-3"><Search size={13} className="text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search notifications..." className="w-full bg-transparent py-2 text-xs outline-none"/></div><div className="flex gap-1">{(["all","unread","read"] as const).map(v=><button key={v} onClick={()=>setFilter(v)} className={"rounded-lg px-3 py-2 text-[10px] capitalize "+(filter===v?"bg-cyan-300/10 text-cyan-200":"text-slate-500")}>{v}</button>)}</div></div>
    {loading?<div className="panel rounded-2xl p-10 text-center text-sm text-slate-400"><LoaderCircle className="mx-auto mb-3 animate-spin"/>Loading…</div>:visible.length===0?<div className="panel rounded-2xl p-10 text-center text-sm text-slate-400">No notifications match this filter.</div>:
      <div className="space-y-3">{visible.map(item=><article key={item.id} className={`panel rounded-2xl p-4 ${item.read_at?"opacity-70":"border-cyan-300/20"}`}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold">{!item.read_at&&<span className="h-2 w-2 rounded-full bg-cyan-300"/>}{item.title}</div>{item.body&&<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{item.body}</p>}<time className="mt-3 block text-[10px] text-slate-600">{new Date(item.created_at).toLocaleString()}</time></div>{!item.read_at&&<button onClick={()=>void markRead(item.id)} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-[10px] text-cyan-200">Mark read</button>}</div></article>)}</div>}
  </div></main>;
}
