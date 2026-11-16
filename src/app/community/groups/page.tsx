"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, MessageCircle, Plus, Send, Trash2, Users } from "lucide-react";
type Group = { id:string; owner_id:string; name:string; description:string; created_at:string; joined:boolean; is_owner:boolean };
type Message = { id:string; group_id:string; author_id:string; body:string; created_at:string };
export default function GroupsPage() {
  const [groups,setGroups]=useState<Group[]>([]);
  const [selected,setSelected]=useState<Group|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [name,setName]=useState(""); const [description,setDescription]=useState("");
  const [draft,setDraft]=useState(""); const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function load() {
    setLoading(true);setError("");
    try { const r=await fetch("/api/community/groups",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load groups.");setGroups(d.groups||[]); }
    catch(e){setError(e instanceof Error?e.message:"Groups unavailable.");} finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function create(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError("");
    try {const r=await fetch("/api/community/groups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,description})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not create group.");setGroups(v=>[d.group,...v]);setSelected(d.group);setName("");setDescription("");}
    catch(e){setError(e instanceof Error?e.message:"Create failed.");}finally{setBusy(false);}
  }
  async function membership(group:Group) {
    const action=group.joined?"leave":"join";
    const r=await fetch("/api/community/groups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,groupId:group.id})});
    const d=await r.json();if(!r.ok){setError(d.error||"Membership update failed.");return;}
    setGroups(v=>v.map(g=>g.id===group.id?{...g,joined:!g.joined}:g));
    if(action==="leave"&&selected?.id===group.id){setSelected(null);setMessages([]);}
  }
  async function openGroup(group:Group) {
    if(!group.joined){setError("Join the group to open its chat.");return;}
    setSelected(group);setError("");
    const r=await fetch("/api/community/groups/messages?group_id="+encodeURIComponent(group.id),{cache:"no-store"});
    const d=await r.json();if(!r.ok){setError(d.error||"Could not load chat.");return;}setMessages(d.messages||[]);
  }
  async function send(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!selected)return;setBusy(true);
    try {const r=await fetch("/api/community/groups/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({group_id:selected.id,body:draft})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Message failed.");setMessages(v=>[...v,d.message]);setDraft("");}
    catch(e){setError(e instanceof Error?e.message:"Message failed.");}finally{setBusy(false);}
  }
  async function remove(group:Group) {
    if(!window.confirm("Delete this group and its chat?"))return;
    const r=await fetch("/api/community/groups?id="+encodeURIComponent(group.id),{method:"DELETE"});const d=await r.json();
    if(!r.ok){setError(d.error||"Delete failed.");return;}
    setGroups(v=>v.filter(g=>g.id!==group.id));if(selected?.id===group.id){setSelected(null);setMessages([]);}
  }
  return <main className="grid-bg min-h-screen p-4 sm:p-8"><div className="mx-auto max-w-6xl">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><Link href="/community" className="mb-3 inline-flex items-center gap-2 text-xs text-slate-400"><ArrowLeft size={14}/> Community feed</Link><h1 className="text-2xl font-bold">Community Groups</h1><p className="mt-1 text-xs text-slate-500">Create groups, join communities and chat with members.</p></div><Link href="/" className="text-xs text-cyan-200">Workspace</Link></header>
    {error&&<p role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,.8fr)_minmax(0,1.2fr)]">
      <section className="space-y-4">
        <form onSubmit={create} className="panel space-y-3 rounded-2xl p-4"><h2 className="text-sm font-semibold">Create a group</h2><input required minLength={3} maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="Group name" className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"/><textarea maxLength={500} rows={2} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short description (optional)" className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none"/><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"><Plus size={14}/> Create group</button></form>
        <div className="panel rounded-2xl p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Discover groups</h2><button onClick={()=>void load()} className="text-[10px] text-cyan-200">Refresh</button></div>
          {loading?<div className="p-6 text-center text-xs text-slate-500"><LoaderCircle className="mx-auto mb-2 animate-spin"/>Loading…</div>:groups.length===0?<p className="py-5 text-center text-xs text-slate-500">No groups yet. Create the first one.</p>:<div className="space-y-2">{groups.map(g=><article key={g.id} className={`rounded-xl border p-3 ${selected?.id===g.id?"border-cyan-300/30 bg-cyan-300/5":"border-white/[.07]"}`}><button onClick={()=>void openGroup(g)} className="w-full text-left"><div className="flex items-center gap-2 text-sm font-semibold"><Users size={14} className="text-cyan-300"/>{g.name}</div>{g.description&&<p className="mt-1 text-xs text-slate-500">{g.description}</p>}</button><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void membership(g)} className="rounded-lg border border-cyan-300/20 px-3 py-1.5 text-[10px] text-cyan-200">{g.joined?"Leave":"Join"}</button>{<button onClick={()=>void openGroup(g)} disabled={!g.joined} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-slate-300 disabled:opacity-40">Open chat</button>}{g.is_owner&&<button onClick={()=>void remove(g)} className="rounded-lg border border-rose-300/20 px-3 py-1.5 text-[10px] text-rose-200"><Trash2 size={11}/></button>}</div></article>)}</div>}
        </div>
      </section>
      <section className="panel flex min-h-[480px] flex-col rounded-2xl p-4"><div className="mb-4 flex items-center gap-2 border-b border-white/[.07] pb-3"><MessageCircle size={17} className="text-cyan-300"/><div><h2 className="text-sm font-semibold">{selected?.name||"Group chat"}</h2><p className="text-[10px] text-slate-500">{selected?"Members-only messages":"Join a group and open its chat."}</p></div></div>
        <div className="flex-1 space-y-3 overflow-y-auto">{!selected?<p className="py-16 text-center text-xs text-slate-500">Choose a group you have joined.</p>:messages.length===0?<p className="py-16 text-center text-xs text-slate-500">No messages yet. Start the conversation.</p>:messages.map(m=><article key={m.id} className="rounded-xl border border-white/[.07] bg-black/20 p-3"><p className="whitespace-pre-wrap break-words text-sm text-slate-200">{m.body}</p><time className="mt-2 block text-[9px] text-slate-600">{new Date(m.created_at).toLocaleString()}</time></article>)}</div>
        {selected?.joined&&<form onSubmit={send} className="mt-4 flex gap-2 border-t border-white/[.07] pt-4"><input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1500} required placeholder="Message the group…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs outline-none"/><button disabled={busy} className="rounded-xl bg-cyan-300 px-4 text-slate-950 disabled:opacity-50"><Send size={15}/></button></form>}
      </section>
    </div>
    <p className="mt-5 text-[10px] leading-5 text-slate-600">Group chat is private to members. Share only information that is appropriate for a community space.</p>
  </div></main>;
}
