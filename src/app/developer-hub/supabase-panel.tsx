"use client";
import { useState } from "react";
import { Database, ExternalLink, LoaderCircle, RefreshCw, Unplug } from "lucide-react";

type Project = { id: string; name: string; region: string | null; status: string; createdAt: string | null; databaseVersion: string | null };

export default function SupabasePanel({ connected, account, onDisconnect }: { connected: boolean; account: string; onDisconnect: () => void }) {
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrations/supabase", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Supabase projects.");
      setProjects(data.projects || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load projects."); }
    finally { setLoading(false); }
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/integrations/supabase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Supabase connection failed.");
      setToken(""); setNotice("Supabase connected securely. Read-only project inventory is enabled."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect Supabase."); }
    finally { setSaving(false); }
  }

  return <section className="mt-5 rounded-xl border border-white/[.08] bg-black/20 p-4">
    <div className="flex items-center gap-2 text-xs text-slate-300"><Database size={15} className="text-cyan-300" /> Supabase account</div>
    {connected ? <>
      <p className="mt-2 text-xs text-emerald-200">Connected · {account || "Supabase account"} · read-only project inventory</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh projects</button>
        <button onClick={onDisconnect} className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200"><Unplug size={13} /> Disconnect</button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
      <div className="mt-3 rounded-lg bg-white/[.04] p-3"><div className="text-lg font-bold text-cyan-100">{projects.length}</div><div className="text-[10px] text-slate-500">Projects returned (up to 100)</div></div>
      {projects.map(project => <div key={project.id} className="mt-2 rounded-lg border border-white/[.07] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-cyan-100">{project.name}</span><span className="text-[10px] text-slate-400">{project.status.replaceAll("_", " ")}</span></div><p className="mt-1 break-all text-[10px] text-slate-500">{project.id}</p><p className="mt-1 text-[10px] text-slate-500">{[project.region, project.databaseVersion && "Postgres " + project.databaseVersion].filter(Boolean).join(" · ") || "Project metadata"}</p><a href={"https://supabase.com/dashboard/project/" + encodeURIComponent(project.id)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-cyan-200">Open dashboard <ExternalLink size={10}/></a></div>)}
      {!loading && projects.length === 0 && <p className="mt-3 text-xs text-slate-500">No projects are visible to this token.</p>}
    </> : <form onSubmit={connect}>
      <p className="mt-2 text-xs leading-5 text-slate-500">Create a scoped Supabase Personal Access Token with Projects read permission, limited to the organizations/projects you own. It is encrypted server-side. Do not use a legacy full-access token.</p>
      <label className="mt-3 block text-xs text-slate-400">Supabase personal access token<input required type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" placeholder="Paste scoped sbp_ token" /></label>
      <button disabled={saving || !token.trim()} className="mt-3 w-full rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? <LoaderCircle size={14} className="mx-auto animate-spin" /> : "Connect Supabase"}</button>
    </form>}
    {notice && <p role="status" className="mt-3 text-xs text-emerald-200">{notice}</p>}
    {!connected && error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-3 text-[10px]"><a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">Create scoped token <ExternalLink size={10}/></a><a href="https://supabase.com/docs/guides/platform/personal-access-tokens" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">Token permissions <ExternalLink size={10}/></a></div>
    <p className="mt-2 text-[10px] text-slate-500">Read-only inventory only. No SQL execution, table edits, project creation, pause/resume or billing actions.</p>
  </section>;
}
