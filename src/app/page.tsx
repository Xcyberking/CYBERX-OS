"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity, ArrowUpRight, Bot, Boxes, Cloud, Code2, Command, Database,
  Github, Gauge, LayoutDashboard, LifeBuoy, Menu, Search, Settings,
  ShieldCheck, Sparkles, Users, Video, Wallet, PlugZap, Server,
  ChevronRight, LogOut, Plus, Trash2, X, LoaderCircle, FolderKanban
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = { display_name: string | null; role: string; credits: number };
type Project = { id: string; name: string; module: string; status: string; created_at: string };
const groups = [
  { title: "WORKSPACE", items: [
    { label: "Overview", icon: LayoutDashboard },
    { label: "My Projects", icon: FolderKanban },
    { label: "Bot Hosting", icon: Bot },
    { label: "API Studio", icon: PlugZap },
    { label: "OSINT Tools", icon: Search },
    { label: "Cloud Storage", icon: Cloud },
    { label: "Firebase Manager", icon: Database }
  ]},
  { title: "ECOSYSTEM", items: [
    { label: "Community", icon: Users },
    { label: "Streaming", icon: Video },
    { label: "Developer Hub", icon: Github },
    { label: "Wallet & Plans", icon: Wallet }
  ]}
];
const modules = [
  { name: "Bot Hosting", key: "bot-hosting", desc: "Organize bot deployments and connect your authorized hosting services.", icon: Bot, color: "text-cyan-300", detail: "The workspace can track your bot projects. Runtime deployment needs a connected hosting provider and worker service." },
  { name: "API Studio", key: "api-studio", desc: "Catalog endpoints, validate responses and monitor API usage.", icon: Code2, color: "text-violet-300", detail: "Create a project record now. API proxying, keys and analytics require the API gateway service to be configured." },
  { name: "Security Center", key: "security", desc: "Review account safety, configuration hygiene and incident response notes.", icon: ShieldCheck, color: "text-emerald-300", detail: "Use the Security Center for a local checklist and incident notebook. It does not scan servers or verify provider security automatically." },
  { name: "OSINT Tools", key: "osint", desc: "A catalog for lawful public information and authorized research.", icon: Search, color: "text-emerald-300", detail: "Only public, lawful sources and assets you are authorized to investigate should be connected." },
  { name: "Cloud Storage", key: "cloud-storage", desc: "Plan files, backups and connected storage providers.", icon: Cloud, color: "text-sky-300", detail: "Storage provider metadata can be organized here. File transfer needs a configured provider and private server-side credentials." },
  { name: "Firebase Manager", key: "firebase", desc: "Track Firebase projects you own or are authorized to manage.", icon: Database, color: "text-amber-300", detail: "Connect only Firebase projects where you have explicit owner or editor permission." },
  { name: "Community", key: "community", desc: "Profiles, posts, groups and moderation.", icon: Users, color: "text-pink-300", detail: "Community data structures are part of the database foundation; social feeds and moderation UI are a later module." },
  { name: "Streaming", key: "streaming", desc: "Video library, categories and playback controls.", icon: Video, color: "text-rose-300", detail: "Video metadata can be tracked. Upload and playback need an authorized object-storage and delivery provider." },
  { name: "Developer Hub", key: "developer-hub", desc: "GitHub repositories and deployment integrations.", icon: Github, color: "text-slate-200", detail: "Repository and deployment actions require explicit OAuth authorization and provider credentials." }
];
const metricIcons = [Boxes, Bot, Activity, Cloud];
const metricLabels = ["Your projects", "Bot projects", "API projects", "Credits"];
const moduleLabels: Record<string,string> = Object.fromEntries(modules.map(m=>[m.key,m.name]));

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectModule, setProjectModule] = useState("bot-hosting");
  const [saving, setSaving] = useState(false);
  const [supabaseReady, setSupabaseReady] = useState(true);
  const selected = modules.find(m => m.name === active);
  const filteredProjects = useMemo(()=>projects.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()) || (moduleLabels[p.module]||p.module).toLowerCase().includes(query.toLowerCase())),[projects,query]);

  async function loadWorkspace() {
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (user) {
        setUserEmail(user.email || "");
        const { data } = await supabase.from("profiles").select("display_name,role,credits").eq("id",user.id).maybeSingle();
        setProfile(data as Profile | null);
        const response = await fetch("/api/projects",{cache:"no-store"});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load projects.");
        setProjects(result.projects || []);
      } else { setUserEmail(""); setProfile(null); setProjects([]); }
    } catch (e) {
      if (e instanceof Error && e.message.includes("Supabase is not configured")) setSupabaseReady(false);
      else setError(e instanceof Error ? e.message : "Could not load workspace.");
    } finally { setLoading(false); }
  }
  useEffect(()=>{ void loadWorkspace(); },[]);

  async function signOut() {
    try { const supabase=createClient(); await supabase.auth.signOut(); }
    finally { window.location.href="/"; }
  }
  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:projectName,module:projectModule})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||"Could not create project.");
      setProjects(current=>[data.project,...current]); setProjectName(""); setShowCreate(false);
    } catch(e) { setError(e instanceof Error?e.message:"Project creation failed."); }
    finally { setSaving(false); }
  }
  async function deleteProject(id:string) {
    if(!window.confirm("Delete this project record?")) return;
    const response=await fetch("/api/projects?id="+encodeURIComponent(id),{method:"DELETE"});
    const data=await response.json(); if(!response.ok){setError(data.error||"Delete failed.");return;}
    setProjects(current=>current.filter(p=>p.id!==id));
  }

  const nav = <><div className="flex items-center gap-3 px-5 py-6"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-300 ring-1 ring-cyan-300/25"><Command size={22}/></div><div><div className="font-bold tracking-[.18em]">CYBERX <span className="text-cyan-300">OS</span></div><div className="text-[10px] tracking-[.22em] text-slate-500">DIGITAL CONTROL CENTER</div></div></div>{groups.map(g=><div className="px-3 pb-4" key={g.title}><div className="px-3 pb-2 pt-3 text-[10px] font-bold tracking-[.2em] text-slate-600">{g.title}</div>{g.items.map(item=><button key={item.label} onClick={()=>{setActive(item.label);setMobileOpen(false)}} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active===item.label?"bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/15":"text-slate-400 hover:bg-white/[.04] hover:text-white"}`}><item.icon size={17}/><span className="flex-1">{item.label}</span></button>)}</div>)}<div className="mt-auto p-4"><div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan-200"><ShieldCheck size={15}/> Secure workspace</div><p className="text-xs leading-5 text-slate-500">Your records are scoped to your signed-in account.</p></div><button onClick={()=>setActive("Settings")} className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/[.04]"><Settings size={17}/> Settings</button></div></>;

  return <div className="grid-bg min-h-screen">
    {mobileOpen&&<div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[258px] flex-col border-r border-white/[.07] bg-[#090f1b] transition-transform lg:translate-x-0 ${mobileOpen?"translate-x-0":"-translate-x-full"}`}>{nav}</aside>
    <main className="min-h-screen lg:pl-[258px]">
      <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-3 border-b border-white/[.07] bg-[#070b14]/90 px-4 backdrop-blur-xl sm:px-8">
        <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden" onClick={()=>setMobileOpen(true)}><Menu size={20}/></button><div><div className="text-sm font-semibold">{active}</div><div className="hidden text-xs text-slate-500 sm:block">Manage your digital ecosystem from one place</div></div></div>
        <div className="flex items-center gap-2 sm:gap-3"><div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 md:flex"><Search size={15} className="text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search workspace..." className="w-36 bg-transparent text-xs outline-none placeholder:text-slate-600"/></div>{active==="Wallet & Plans"&&<Link href="/wallet" className="rounded-xl border border-amber-300/20 px-3 py-2 text-xs text-amber-200">Open wallet</Link>}{profile?.role==="admin"&&<Link href="/admin" className="rounded-xl border border-cyan-300/20 px-3 py-2 text-xs text-cyan-200">Admin</Link>}{userEmail?<><span className="hidden max-w-40 truncate text-xs text-slate-400 sm:block">{userEmail}</span><button onClick={()=>void signOut()} title="Sign out" className="rounded-xl border border-white/10 p-2.5 text-slate-400 hover:text-white"><LogOut size={17}/></button></>:<Link href="/login" className="rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950">Sign in</Link>}<div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-xs font-black text-slate-950">CX</div></div>
      </header>
      <div className="mx-auto max-w-[1500px] p-4 sm:p-8">
        {error&&<div role="alert" className="mb-5 rounded-xl border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200">{error}</div>}
        {!supabaseReady&&<div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">Supabase is not configured yet. Add the project URL and publishable key to load accounts and save projects.</div>}
        {active==="Overview"?<>
          <section className="relative mb-7 overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#10263a] via-[#101a30] to-[#17112d] p-6 shadow-glow sm:p-9"><div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"/><div className="relative max-w-2xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-bold tracking-[.18em] text-cyan-200"><Sparkles size={13}/> YOUR UNIFIED DIGITAL WORKSPACE</div><h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Everything you build.<br/><span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">One command center.</span></h1><p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">One account to organize bots, APIs, cloud projects, community and developer services.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={()=>setActive("My Projects")} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950">Open my projects <ArrowUpRight size={15}/></button>{!userEmail&&<Link href="/login" className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-slate-300">Create account</Link>}</div></div><div className="absolute bottom-7 right-8 hidden opacity-30 xl:block"><Command size={150} strokeWidth={.6}/></div></section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Workspace overview</h2><span className="text-[11px] text-slate-600">{loading?"Loading…":"Account data"}</span></div>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricLabels.map((label,i)=>{const Icon=metricIcons[i];const value=i===0?projects.length:i===1?projects.filter(p=>p.module==="bot-hosting").length:i===2?projects.filter(p=>p.module==="api-studio").length:profile?.credits??"—";return <div key={label} className="panel rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><span className="text-xs text-slate-400">{label}</span><Icon size={17} className="text-cyan-300"/></div><div className="text-2xl font-bold">{value}</div><div className="mt-2 text-[10px] text-slate-600">{i===3?"Available account balance":"Saved workspace records"}</div></div>})}</div>
          <div className="mb-4 flex items-end justify-between"><div><h2 className="text-sm font-bold">Platform modules</h2><p className="mt-1 text-xs text-slate-500">Module records are ready; external provider actions need credentials and authorization.</p></div><span className="hidden text-[10px] tracking-wider text-slate-600 sm:block">8 MODULES</span></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modules.filter(m=>m.name.toLowerCase().includes(query.toLowerCase())).map(m=><button key={m.name} onClick={()=>setActive(m.name)} className="panel group rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-glow"><div className="mb-5 flex items-center justify-between"><div className={`grid h-10 w-10 place-items-center rounded-xl bg-white/[.05] ${m.color}`}><m.icon size={20}/></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500">Workspace</span></div><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{m.name}</h3><ChevronRight size={16} className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300"/></div><p className="mt-2 text-xs leading-5 text-slate-500">{m.desc}</p></button>)}</div>
          <div className="mt-7 grid gap-3 lg:grid-cols-2"><div className="panel rounded-2xl p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Gauge size={17} className="text-cyan-300"/> Account status</div><div className="flex items-center gap-2 text-xs text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400"/>{userEmail?"Signed in":"Guest view"}</div><p className="mt-2 text-xs text-slate-500">{profile?profile.display_name||userEmail:"Sign in to create projects and keep your workspace data."}</p></div><div className="panel rounded-2xl p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><LifeBuoy size={17} className="text-violet-300"/> Integration status</div><p className="text-xs leading-5 text-slate-500">Provider credentials, bot runtimes, storage buckets and OAuth apps must be connected before those external actions can run.</p></div></div>
        </>:active==="My Projects"?<section><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">My projects</h1><p className="mt-2 text-sm text-slate-500">Create and organize records across all CYBERX modules.</p></div><button onClick={()=>setShowCreate(true)} disabled={!userEmail} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-40"><Plus size={15}/> New project</button></div>{!userEmail?<div className="panel rounded-2xl p-8 text-center"><p className="mb-4 text-sm text-slate-400">Sign in to save and manage projects.</p><Link href="/login" className="rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950">Sign in</Link></div>:loading?<div className="panel rounded-2xl p-8 text-center text-sm text-slate-400"><LoaderCircle className="mx-auto mb-2 animate-spin"/>Loading projects</div>:filteredProjects.length===0?<div className="panel rounded-2xl p-8 text-center text-sm text-slate-400">No projects yet. Create your first project record.</div>:<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredProjects.map(project=><div key={project.id} className="panel rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><span className="rounded-lg bg-cyan-300/10 p-2 text-cyan-300"><FolderKanban size={18}/></span><button onClick={()=>void deleteProject(project.id)} aria-label="Delete project" className="rounded-lg p-2 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 size={15}/></button></div><h3 className="font-semibold">{project.name}</h3><p className="mt-1 text-xs text-slate-500">{moduleLabels[project.module]||project.module}</p><div className="mt-4 text-[10px] uppercase tracking-wider text-slate-600">{project.status} · {new Date(project.created_at).toLocaleDateString()}</div></div>)}</div>}</section>:selected?<section className="panel rounded-3xl p-6 sm:p-9"><div className={`mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/[.05] ${selected.color}`}><selected.icon size={27}/></div><span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-[10px] uppercase tracking-wider text-cyan-200">Module workspace</span><h1 className="mt-5 text-3xl font-bold">{selected.name}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">{selected.desc}</p><div className="mt-8 rounded-2xl border border-white/[.08] bg-black/20 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><Server size={16} className="text-cyan-300"/> Current capability</div><p className="mt-2 text-xs leading-5 text-slate-500">{selected.detail}</p></div>{selected.name==="Security Center"&&<Link href="/security" className="mt-6 mr-2 inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 px-4 py-2.5 text-xs font-semibold text-emerald-200">Open Security Center <ArrowUpRight size={14}/></Link>}{selected.name==="API Studio"&&<Link href="/api-studio" className="mt-6 mr-2 inline-flex items-center gap-2 rounded-xl border border-violet-300/30 px-4 py-2.5 text-xs font-semibold text-violet-200">Open API Studio <ArrowUpRight size={14}/></Link>}{selected.name==="Bot Hosting"&&<Link href="/bots" className="mt-6 mr-2 inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 px-4 py-2.5 text-xs font-semibold text-cyan-200">Open Bot Registry <ArrowUpRight size={14}/></Link>}{selected.name==="Cloud Storage"&&<Link href="/storage" className="mt-6 mr-2 inline-flex items-center gap-2 rounded-xl border border-sky-300/30 px-4 py-2.5 text-xs font-semibold text-sky-200">Open File Manager <ArrowUpRight size={14}/></Link>}{selected.name==="Community"&&<Link href="/community" className="mt-6 mr-2 inline-flex items-center gap-2 rounded-xl border border-pink-300/30 px-4 py-2.5 text-xs font-semibold text-pink-200">Open Community <ArrowUpRight size={14}/></Link>}{selected.name==="Firebase Manager"&&<Link href="/firebase" className="mt-6 mr-2 inline-flex items-center gap-2 rounded-xl border border-amber-300/30 px-4 py-2.5 text-xs font-semibold text-amber-200">Configure Firebase <ArrowUpRight size={14}/></Link>}{selected.name==="Streaming"&&<Link href="/streaming" className="mt-6 mr-2 inline-flex items-center gap-2 rounded-xl border border-rose-300/30 px-4 py-2.5 text-xs font-semibold text-rose-200">Open Streaming Studio <ArrowUpRight size={14}/></Link>}{selected.name==="Developer Hub"&&<Link href="/developer-hub" className="mt-6 mr-2 inline-flex items-center gap-2 rounded-xl border border-slate-300/30 px-4 py-2.5 text-xs font-semibold text-slate-200">Open Developer Hub <ArrowUpRight size={14}/></Link>}<button onClick={()=>{setProjectModule(selected.key);setShowCreate(true)}} disabled={!userEmail} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-40"><Plus size={14}/> Create {selected.name} project</button></section>:<section className="panel rounded-3xl p-8"><div className="mb-3 flex items-center gap-2 text-cyan-300"><Settings size={19}/> Workspace settings</div><h1 className="text-2xl font-bold">Account and setup</h1><p className="mt-2 text-sm text-slate-400">Your workspace identity, provider setup and security controls.</p><div className="mt-6 space-y-3 text-sm text-slate-300">{[userEmail?"Account connected: "+userEmail:"Sign in or create an account","Configure Supabase URL and publishable key","Apply all database migrations from supabase/migrations","Set SUPABASE_SERVICE_ROLE_KEY in server environment only","Connect provider OAuth apps and storage credentials securely","Deploy frontend and verify the health endpoint"].map((x,i)=><div key={x} className="flex gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-3"><span className="text-cyan-300">0{i+1}</span>{x}</div>)}</div><button onClick={()=>void loadWorkspace()} className="mt-6 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-300">Refresh account</button></section>}
        <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-white/[.07] py-5 text-[10px] text-slate-600 sm:flex-row"><span>© 2026 CYBERX OS · One connected ecosystem</span><span className="flex items-center gap-2"><ShieldCheck size={12}/> Secure-by-design foundation</span></footer>
      </div>
    </main>
    {showCreate&&<div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4" onClick={()=>setShowCreate(false)}><form onSubmit={createProject} onClick={e=>e.stopPropagation()} className="panel w-full max-w-md rounded-2xl p-6 shadow-glow"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">Create project</h2><button type="button" onClick={()=>setShowCreate(false)} className="text-slate-500"><X size={18}/></button></div><label className="block text-xs text-slate-400">Project name<input required maxLength={80} value={projectName} onChange={e=>setProjectName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" placeholder="My project"/></label><label className="mt-4 block text-xs text-slate-400">Module<select value={projectModule} onChange={e=>setProjectModule(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#080e19] px-4 py-3 text-sm text-white">{modules.map(m=><option key={m.key} value={m.key}>{m.name}</option>)}</select></label><button disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{saving&&<LoaderCircle size={15} className="animate-spin"/>}Save project</button></form></div>}
  </div>;
}
