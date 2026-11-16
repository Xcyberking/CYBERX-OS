"use client";
import { useState } from "react";
import { ExternalLink, FolderKanban, Layers3, LoaderCircle, RefreshCw, Unplug } from "lucide-react";

type Item = { id: string; name: string };
type Project = { id: string; name: string; createdAt: string | null; services: Item[]; environments: Item[] };

export default function RailwayPanel({ connected, account, onDisconnect }: { connected: boolean; account: string; onDisconnect: () => void }) {
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrations/railway", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Railway projects.");
      setProjects(data.projects || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load Railway projects."); }
    finally { setLoading(false); }
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/integrations/railway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Railway connection failed.");
      setToken(""); setNotice("Railway connected securely. Read-only inventory is enabled."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect Railway."); }
    finally { setSaving(false); }
  }

  return <section className="mt-5 rounded-xl border border-white/[.08] bg-black/20 p-4">
    <div className="flex items-center gap-2 text-xs text-slate-300"><FolderKanban size={15} className="text-cyan-300" /> Railway account</div>
    {connected ? <>
      <p className="mt-2 text-xs text-emerald-200">Connected · {account || "Railway account"} · read-only project inventory</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh projects</button>
        <button onClick={onDisconnect} className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200"><Unplug size={13} /> Disconnect</button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
      {projects.map(project => <div key={project.id} className="mt-3 rounded-lg border border-white/[.07] p-3">
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-cyan-100">{project.name}</span><a href="https://railway.com/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-cyan-200">Open dashboard <ExternalLink size={10}/></a></div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><Layers3 size={11}/> {project.services.length} services</span><span>{project.environments.length} environments</span></div>
        {project.services.length>0 && <div className="mt-2 flex flex-wrap gap-1">{project.services.map(service=><span key={service.id} className="rounded-md bg-white/[.05] px-2 py-1 text-[10px] text-slate-300">{service.name}</span>)}</div>}
        {project.environments.length>0 && <p className="mt-2 text-[10px] text-slate-600">Environments: {project.environments.map(env=>env.name).join(", ")}</p>}
      </div>)}
      {!loading && projects.length===0 && <p className="mt-3 text-xs text-slate-500">No Railway projects were returned for this account.</p>}
    </> : <form onSubmit={connect}>
      <p className="mt-2 text-xs leading-5 text-slate-500">Use an account API token from Railway. Account tokens can access all resources and workspaces available to that account. The key is encrypted server-side; CYBERX only performs read-only inventory queries. Never paste a token belonging to someone else.</p>
      <label className="mt-3 block text-xs text-slate-400">Railway account API token<input required type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" placeholder="Paste account API token" /></label>
      <button disabled={saving || !token.trim()} className="mt-3 w-full rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? <LoaderCircle size={14} className="mx-auto animate-spin" /> : "Connect Railway"}</button>
    </form>}
    {notice && <p role="status" className="mt-3 text-xs text-emerald-200">{notice}</p>}
    {!connected && error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
    <p className="mt-3 text-[10px] text-slate-500">Read-only: no deployments, restarts, variable access, project creation or deletion.</p>
  </section>;
}
