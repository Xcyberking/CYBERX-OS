"use client";
import { useState } from "react";
import { ExternalLink, Layers3, LoaderCircle, RefreshCw, Unplug } from "lucide-react";

type Deploy = { id: string; status: string; createdAt: string | null; finishedAt: string | null; trigger: string | null };
type Service = { id: string; name?: string; type?: string; suspended?: string; dashboardUrl?: string; serviceDetails?: { url?: string }; latestDeploys?: Deploy[] };

export default function RenderPanel({ connected, account, onDisconnect }: { connected: boolean; account: string; onDisconnect: () => void }) {
  const [token, setToken] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrations/render", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Render services.");
      setServices(data.services || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load services."); }
    finally { setLoading(false); }
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/integrations/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Render connection failed.");
      setToken(""); setNotice("Render account connected securely. Read-only access is enabled."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect Render."); }
    finally { setSaving(false); }
  }

  return <section className="mt-5 rounded-xl border border-white/[.08] bg-black/20 p-4">
    <div className="flex items-center gap-2 text-xs text-slate-300"><Layers3 size={15} className="text-cyan-300" /> Render account</div>
    {connected ? <>
      <p className="mt-2 text-xs text-emerald-200">Connected · {account || "Render account"} · read-only services and deploy history</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh services</button>
        <button onClick={onDisconnect} className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200"><Unplug size={13} /> Disconnect</button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
      {services.map(service => <div key={service.id} className="mt-3 rounded-lg border border-white/[.07] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-cyan-100">{service.name || service.id}</span><span className="text-[10px] text-slate-500">{service.type || "service"} · {service.suspended || "active"}</span></div>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px]">{service.dashboardUrl && <a href={service.dashboardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">Dashboard <ExternalLink size={10} /></a>}{service.serviceDetails?.url && <a href={service.serviceDetails.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">Open service <ExternalLink size={10} /></a>}</div>
        {(service.latestDeploys || []).map(deploy => <div key={deploy.id} className="mt-2 flex items-center justify-between gap-2 border-t border-white/[.06] pt-2 text-[10px]"><span className="text-slate-400">{deploy.status} · {deploy.trigger || "deploy"}</span><span className="text-slate-600">{deploy.createdAt ? new Date(deploy.createdAt).toLocaleString() : ""}</span></div>)}
      </div>)}
      {!loading && services.length === 0 && <p className="mt-3 text-xs text-slate-500">No services found for this Render API key.</p>}
    </> : <form onSubmit={connect}>
      <p className="mt-2 text-xs leading-5 text-slate-500">Paste a Render API key. It is verified and encrypted server-side. Render API keys can access the workspaces available to that account, so only connect an account you own or are authorized to manage.</p>
      <label className="mt-3 block text-xs text-slate-400">Render API key<input required type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" placeholder="Paste API key here" /></label>
      <button disabled={saving || !token.trim()} className="mt-3 w-full rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? <LoaderCircle size={14} className="mx-auto animate-spin" /> : "Connect Render"}</button>
    </form>}
    {notice && <p role="status" className="mt-3 text-xs text-emerald-200">{notice}</p>}
    {!connected && error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
    <p className="mt-3 text-[10px] text-slate-500">Read-only inventory. No service creation, deploy, restart, suspend or environment-variable changes.</p>
  </section>;
}
