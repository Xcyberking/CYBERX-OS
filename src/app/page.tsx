"use client";
import { useState } from "react";
import {
  Activity, ArrowUpRight, Bot, Boxes, Cloud, Code2, Command, Database,
  Github, Gauge, LayoutDashboard, LifeBuoy, Menu, Search, Settings,
  ShieldCheck, Sparkles, Users, Video, Wallet, X, Zap, PlugZap, Server,
  CircleHelp, Bell, ChevronRight
} from "lucide-react";

const groups = [
  { title: "WORKSPACE", items: [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Bot Hosting", icon: Bot, tag: "Soon" },
    { label: "API Studio", icon: PlugZap, tag: "Soon" },
    { label: "OSINT Tools", icon: Search, tag: "Soon" },
    { label: "Cloud Storage", icon: Cloud, tag: "Soon" },
    { label: "Firebase Manager", icon: Database, tag: "Soon" }
  ]},
  { title: "ECOSYSTEM", items: [
    { label: "Community", icon: Users, tag: "Soon" },
    { label: "Streaming", icon: Video, tag: "Soon" },
    { label: "Developer Hub", icon: Github, tag: "Soon" },
    { label: "Wallet & Plans", icon: Wallet, tag: "Soon" }
  ]}
];
const metrics = [
  { label: "Active services", value: "—", note: "Connect integrations to begin", icon: Boxes },
  { label: "Running bots", value: "—", note: "Bot hosting module", icon: Bot },
  { label: "API requests", value: "—", note: "Usage analytics", icon: Activity },
  { label: "Cloud storage", value: "—", note: "Storage providers", icon: Cloud }
];
const modules = [
  { name: "Bot Hosting", desc: "Deploy and monitor Python or Node.js bots.", icon: Bot, color: "text-cyan-300", status: "Planned" },
  { name: "API Studio", desc: "Register endpoints, test responses and manage API keys.", icon: Code2, color: "text-violet-300", status: "Planned" },
  { name: "OSINT Tools", desc: "A controlled catalog of lawful public-data tools.", icon: Search, color: "text-emerald-300", status: "Planned" },
  { name: "Cloud Storage", desc: "Browse files, backups and connected storage providers.", icon: Cloud, color: "text-sky-300", status: "Planned" },
  { name: "Firebase Manager", desc: "Manage Firebase projects you own or are authorized to access.", icon: Database, color: "text-amber-300", status: "Planned" },
  { name: "Community", desc: "Profiles, posts, groups and moderation.", icon: Users, color: "text-pink-300", status: "Planned" },
  { name: "Streaming", desc: "Video library, categories and playback controls.", icon: Video, color: "text-rose-300", status: "Planned" },
  { name: "Developer Hub", desc: "GitHub repositories and deployment integrations.", icon: Github, color: "text-slate-200", status: "Planned" }
];
export default function Home() {
  const [active, setActive] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = modules.find(m => m.name === active);
  const nav = <><div className="flex items-center gap-3 px-5 py-6"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300 ring-1 ring-cyan-300/25"><Command size={22}/></div><div><div className="font-bold tracking-[.18em]">CYBERX <span className="text-cyan-300">OS</span></div><div className="text-[10px] tracking-[.22em] text-slate-500">DIGITAL CONTROL CENTER</div></div></div>{groups.map(g=><div className="px-3 pb-4" key={g.title}><div className="px-3 pb-2 pt-3 text-[10px] font-bold tracking-[.2em] text-slate-600">{g.title}</div>{g.items.map(item=><button key={item.label} onClick={()=>{setActive(item.label);setMobileOpen(false)}} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active===item.label?"bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/15":"text-slate-400 hover:bg-white/[.04] hover:text-white"}`}><item.icon size={17}/><span className="flex-1">{item.label}</span>{item.tag&&<span className="text-[9px] uppercase tracking-wider text-slate-600">{item.tag}</span>}</button>)}</div>)}<div className="mt-auto p-4"><div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan-200"><ShieldCheck size={15}/> Secure workspace</div><p className="text-xs leading-5 text-slate-500">Connect your services to bring your digital projects together.</p></div><button onClick={()=>setActive("Settings")} className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/[.04]"><Settings size={17}/> Settings</button></div></>;
  return <div className="grid-bg min-h-screen">
    {mobileOpen&&<div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[258px] flex-col border-r border-white/[.07] bg-[#090f1b] transition-transform lg:translate-x-0 ${mobileOpen?"translate-x-0":"-translate-x-full"}`}>{nav}</aside>
    <main className="min-h-screen lg:pl-[258px]">
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/[.07] bg-[#070b14]/85 px-4 backdrop-blur-xl sm:px-8">
        <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden" onClick={()=>setMobileOpen(true)}><Menu size={20}/></button><div><div className="text-sm font-semibold">{active}</div><div className="hidden text-xs text-slate-500 sm:block">Manage your digital ecosystem from one place</div></div></div>
        <div className="flex items-center gap-2 sm:gap-4"><div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 md:flex"><Search size={15} className="text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search workspace..." className="w-36 bg-transparent text-xs outline-none placeholder:text-slate-600"/></div><button aria-label="Notifications" className="relative rounded-xl border border-white/10 p-2.5 text-slate-400"><Bell size={17}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-300"/></button><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-xs font-black text-slate-950">CX</div></div>
      </header>
      <div className="mx-auto max-w-[1500px] p-4 sm:p-8">
        {active==="Overview"?<>
          <section className="relative mb-7 overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#10263a] via-[#101a30] to-[#17112d] p-6 shadow-glow sm:p-9"><div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"/><div className="absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl"/><div className="relative max-w-2xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-bold tracking-[.18em] text-cyan-200"><Sparkles size={13}/> YOUR UNIFIED DIGITAL WORKSPACE</div><h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Everything you build.<br/><span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">One command center.</span></h1><p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">Bring bots, APIs, cloud storage, community and developer projects into one secure workspace. Your CYBERX OS foundation is ready.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={()=>setActive("Developer Hub")} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-200">Explore integrations <ArrowUpRight size={15}/></button><button onClick={()=>setActive("Settings")} className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5">Workspace settings</button></div></div><div className="absolute bottom-7 right-8 hidden opacity-30 xl:block"><Command size={150} strokeWidth={.6}/></div></section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Workspace overview</h2><span className="text-[11px] text-slate-600">Live metrics appear after integrations</span></div>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(m=><div key={m.label} className="panel rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><span className="text-xs text-slate-400">{m.label}</span><m.icon size={17} className="text-cyan-300"/></div><div className="text-2xl font-bold">{m.value}</div><div className="mt-2 text-[10px] text-slate-600">{m.note}</div></div>)}</div>
          <div className="mb-4 flex items-end justify-between"><div><h2 className="text-sm font-bold">Platform modules</h2><p className="mt-1 text-xs text-slate-500">A modular foundation — integrations will be enabled in phases.</p></div><span className="hidden text-[10px] tracking-wider text-slate-600 sm:block">8 MODULES</span></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modules.filter(m=>m.name.toLowerCase().includes(query.toLowerCase())).map(m=><button key={m.name} onClick={()=>setActive(m.name)} className="panel group rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-glow"><div className="mb-5 flex items-center justify-between"><div className={`grid h-10 w-10 place-items-center rounded-xl bg-white/[.05] ${m.color}`}><m.icon size={20}/></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500">{m.status}</span></div><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{m.name}</h3><ChevronRight size={16} className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300"/></div><p className="mt-2 text-xs leading-5 text-slate-500">{m.desc}</p></button>)}</div>
          <div className="mt-7 grid gap-3 lg:grid-cols-2"><div className="panel rounded-2xl p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Gauge size={17} className="text-cyan-300"/> System status</div><div className="flex items-center gap-2 text-xs text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400"/> Frontend foundation ready</div><p className="mt-2 text-xs text-slate-500">Database, authentication and external integrations are not connected yet.</p></div><div className="panel rounded-2xl p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><LifeBuoy size={17} className="text-violet-300"/> Next implementation step</div><p className="text-xs leading-5 text-slate-500">Configure Supabase authentication and database, then enable each module behind secure permissions.</p><button onClick={()=>setActive("Settings")} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">Open setup notes <ArrowUpRight size={13}/></button></div></div>
        </>:selected?<section className="panel rounded-3xl p-6 sm:p-9"><div className={`mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/[.05] ${selected.color}`}><selected.icon size={27}/></div><span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-[10px] uppercase tracking-wider text-amber-200">Planned module</span><h1 className="mt-5 text-3xl font-bold">{selected.name}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">{selected.desc}</p><div className="mt-8 rounded-2xl border border-white/[.08] bg-black/20 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><Server size={16} className="text-cyan-300"/> Module setup pending</div><p className="mt-2 text-xs leading-5 text-slate-500">This section is included in the CYBERX OS architecture. Its backend integration, database schema and access controls will be implemented in the next development phase.</p></div><button onClick={()=>setActive("Overview")} className="mt-6 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950">Back to overview</button></section>:<section className="panel rounded-3xl p-8"><div className="mb-3 flex items-center gap-2 text-cyan-300"><Settings size={19}/> Workspace settings</div><h1 className="text-2xl font-bold">Configuration checklist</h1><p className="mt-2 text-sm text-slate-400">Before connecting production services, configure these items securely.</p><div className="mt-6 space-y-3 text-sm text-slate-300">{["Create a Supabase project and configure authentication","Add environment variables in the deployment provider","Apply reviewed database migrations and enable row-level security","Connect GitHub and hosting providers using OAuth","Set up storage buckets and backup retention","Configure admin roles and audit logging"].map((x,i)=><div key={x} className="flex gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-3"><span className="text-cyan-300">0{i+1}</span>{x}</div>)}</div></section>}
        <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-white/[.07] py-5 text-[10px] text-slate-600 sm:flex-row"><span>© 2026 CYBERX OS · Built for one connected ecosystem</span><span className="flex items-center gap-2"><ShieldCheck size={12}/> Secure-by-design foundation</span></footer>
      </div>
    </main>
  </div>;
}