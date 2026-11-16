"use client";
import { useState } from "react";
import { Database, ExternalLink, LoaderCircle, RefreshCw, Unplug } from "lucide-react";

type FirebaseApp = { appId: string; displayName: string; platform: string; namespace: string | null };
type FirebaseProject = { projectId: string; projectNumber: string | null; displayName: string; state: string; apps: FirebaseApp[] };

export default function FirebasePanel({ connected, account, onDisconnect }: { connected: boolean; account: string; onDisconnect: () => void }) {
  const [projects, setProjects] = useState<FirebaseProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrations/firebase", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Firebase projects.");
      setProjects(data.projects || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load Firebase projects."); }
    finally { setLoading(false); }
  }

  return <section className="mt-5 rounded-xl border border-white/[.08] bg-black/20 p-4">
    <div className="flex items-center gap-2 text-xs text-slate-300"><Database size={15} className="text-amber-300" /> Firebase / Google Cloud</div>
    {connected ? <>
      <p className="mt-2 break-all text-xs text-emerald-200">Connected · {account || "Google account"} · Firebase read-only</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh projects</button>
        <button onClick={onDisconnect} className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200"><Unplug size={13} /> Disconnect</button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
      <div className="mt-3 rounded-lg bg-white/[.04] p-3"><div className="text-lg font-bold text-cyan-100">{projects.length}</div><div className="text-[10px] text-slate-500">Firebase projects</div></div>
      {projects.map(project => <div key={project.projectId} className="mt-2 rounded-lg border border-white/[.07] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-cyan-100">{project.displayName}</span><span className="text-[10px] text-slate-400">{project.state}</span></div>
        <p className="mt-1 break-all text-[10px] text-slate-500">{project.projectId}{project.projectNumber ? " · " + project.projectNumber : ""}</p>
        <p className="mt-2 text-[10px] text-slate-400">{project.apps.length} registered app(s)</p>
        {project.apps.map(app => <div key={app.appId} className="mt-2 rounded-lg bg-white/[.035] p-2"><div className="text-[11px] text-slate-200">{app.displayName}</div><div className="mt-1 break-all text-[9px] text-slate-500">{app.platform} · {app.namespace || app.appId}</div></div>)}
        <a href={"https://console.firebase.google.com/project/" + encodeURIComponent(project.projectId) + "/overview"} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] text-cyan-200">Open Firebase Console <ExternalLink size={10}/></a>
      </div>)}
      {!loading && projects.length === 0 && <p className="mt-3 text-xs text-slate-500">No Firebase projects are visible to this Google account.</p>}
    </> : <div>
      <p className="mt-2 text-xs leading-5 text-slate-500">Connect your Google account using OAuth. CYBERX requests only the Firebase read-only scope, encrypts the refresh token server-side and lists projects plus registered app metadata. Your Google account must already have access to those Firebase projects.</p>
      <a href="/api/integrations/firebase/connect" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-bold text-slate-950">Connect Google / Firebase</a>
    </div>}
    <div className="mt-3 flex flex-wrap gap-3 text-[10px]"><a href="https://console.cloud.google.com/apis/library/firebase.googleapis.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">Enable Firebase Management API <ExternalLink size={10}/></a><a href="https://firebase.google.com/docs/reference/firebase-management/rest" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">API reference <ExternalLink size={10}/></a></div>
    <p className="mt-2 text-[10px] text-slate-500">Read-only project and app metadata. No database records, Storage files, user accounts, rules or settings are read or changed.</p>
  </section>;
}
