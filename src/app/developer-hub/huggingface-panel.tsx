"use client";
import { useState } from "react";
import { ExternalLink, Layers3, LoaderCircle, RefreshCw, Unplug } from "lucide-react";

type Repository = { id: string; type: "model" | "dataset" | "space"; private: boolean; downloads: number | null; likes: number | null; lastModified: string | null; pipelineTag: string | null; sdk: string | null };

export default function HuggingFacePanel({ connected, account, onDisconnect }: { connected: boolean; account: string; onDisconnect: () => void }) {
  const [token, setToken] = useState("");
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrations/huggingface", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Hugging Face repositories.");
      setRepositories(data.repositories || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load repositories."); }
    finally { setLoading(false); }
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/integrations/huggingface", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Hugging Face connection failed.");
      setToken(""); setNotice("Hugging Face connected securely. Read-only repository inventory is enabled."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect Hugging Face."); }
    finally { setSaving(false); }
  }

  function repoUrl(repo: Repository) {
    const prefix = repo.type === "dataset" ? "datasets/" : repo.type === "space" ? "spaces/" : "";
    return "https://huggingface.co/" + prefix + repo.id;
  }

  return <section className="mt-5 rounded-xl border border-white/[.08] bg-black/20 p-4">
    <div className="flex items-center gap-2 text-xs text-slate-300"><Layers3 size={15} className="text-cyan-300" /> Hugging Face Hub</div>
    {connected ? <>
      <p className="mt-2 text-xs text-emerald-200">Connected · {account || "Hugging Face account"} · read-only public repository inventory</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh repositories</button>
        <button onClick={onDisconnect} className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200"><Unplug size={13} /> Disconnect</button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
      <div className="mt-3 grid grid-cols-3 gap-2">{(["model", "dataset", "space"] as const).map(type => <div key={type} className="rounded-lg bg-white/[.04] p-3"><div className="text-lg font-bold text-cyan-100">{repositories.filter(repo => repo.type === type).length}</div><div className="text-[10px] capitalize text-slate-500">{type}s</div></div>)}</div>
      {repositories.map(repo => <div key={repo.type + ":" + repo.id} className="mt-2 rounded-lg border border-white/[.07] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all text-xs font-semibold text-cyan-100">{repo.id}</span><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] capitalize text-slate-400">{repo.type}</span></div><p className="mt-1 text-[10px] text-slate-500">{[repo.pipelineTag, repo.sdk, repo.downloads !== null && repo.downloads.toLocaleString() + " downloads", repo.likes !== null && repo.likes + " likes"].filter(Boolean).join(" · ") || "Repository metadata"}</p><a href={repoUrl(repo)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-cyan-200">Open on Hub <ExternalLink size={10}/></a></div>)}
      {!loading && repositories.length === 0 && <p className="mt-3 text-xs text-slate-500">No public repositories found for this account.</p>}
    </> : <form onSubmit={connect}>
      <p className="mt-2 text-xs leading-5 text-slate-500">Create a fine-grained Hugging Face user access token with read-only access. The token is encrypted server-side and never returned to the browser. This first version lists public models, datasets and Spaces only.</p>
      <label className="mt-3 block text-xs text-slate-400">Hugging Face read token<input required type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" placeholder="hf_…" /></label>
      <button disabled={saving || !token.trim()} className="mt-3 w-full rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? <LoaderCircle size={14} className="mx-auto animate-spin" /> : "Connect Hugging Face"}</button>
    </form>}
    {notice && <p role="status" className="mt-3 text-xs text-emerald-200">{notice}</p>}
    {!connected && error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-3 text-[10px]"><a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">Create read token <ExternalLink size={10}/></a><a href="https://huggingface.co/docs/hub/security-tokens" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">Token permissions <ExternalLink size={10}/></a></div>
    <p className="mt-2 text-[10px] text-slate-500">Read-only public inventory. No model uploads, repo creation/deletion, inference jobs or account changes.</p>
  </section>;
}
