"use client";
import { useState } from "react";
import { Cloud, ExternalLink, LoaderCircle, RefreshCw, Unplug } from "lucide-react";

type Bucket = { name: string; createdAt: string | null; location: string | null; jurisdiction: string | null; storageClass: string | null };

export default function CloudflarePanel({ connected, account, onDisconnect }: { connected: boolean; account: string; onDisconnect: () => void }) {
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrations/cloudflare", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Cloudflare R2 buckets.");
      setBuckets(data.buckets || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load R2 buckets."); }
    finally { setLoading(false); }
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/integrations/cloudflare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, accountId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cloudflare connection failed.");
      setToken(""); setNotice("Cloudflare connected securely. Read-only R2 bucket inventory is enabled."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect Cloudflare."); }
    finally { setSaving(false); }
  }

  return <section className="mt-5 rounded-xl border border-white/[.08] bg-black/20 p-4">
    <div className="flex items-center gap-2 text-xs text-slate-300"><Cloud size={15} className="text-cyan-300" /> Cloudflare account · R2</div>
    {connected ? <>
      <p className="mt-2 text-xs text-emerald-200">Connected · {account || "Cloudflare account"} · read-only bucket inventory</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh buckets</button>
        <button onClick={onDisconnect} className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200"><Unplug size={13} /> Disconnect</button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-lg bg-white/[.04] p-3"><div className="text-lg font-bold text-cyan-100">{buckets.length}</div><div className="text-[10px] text-slate-500">Buckets returned</div></div><div className="rounded-lg bg-white/[.04] p-3"><div className="text-lg font-bold text-cyan-100">Read only</div><div className="text-[10px] text-slate-500">No bucket/object changes</div></div></div>
      {buckets.map(bucket => <div key={bucket.name} className="mt-2 rounded-lg border border-white/[.07] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-cyan-100">{bucket.name}</span><span className="text-[10px] text-slate-500">{bucket.storageClass || "Standard"}</span></div><p className="mt-1 text-[10px] text-slate-500">{[bucket.location, bucket.jurisdiction && "Jurisdiction: " + bucket.jurisdiction].filter(Boolean).join(" · ") || "Location not reported"}</p></div>)}
      {!loading && buckets.length === 0 && <p className="mt-3 text-xs text-slate-500">No R2 buckets found, or the token has no R2 read permission.</p>}
    </> : <form onSubmit={connect}>
      <p className="mt-2 text-xs leading-5 text-slate-500">Create a Cloudflare API token with Workers R2 Storage Read permission and scope it to the account you own. The token is encrypted server-side. Do not use Global API keys or share credentials.</p>
      <label className="mt-3 block text-xs text-slate-400">Cloudflare Account ID<input required maxLength={32} minLength={32} value={accountId} onChange={e => setAccountId(e.target.value.trim())} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" placeholder="32-character account ID" /></label>
      <label className="mt-3 block text-xs text-slate-400">Cloudflare API token<input required type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" placeholder="Paste scoped API token" /></label>
      <button disabled={saving || !token.trim() || accountId.length !== 32} className="mt-3 w-full rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? <LoaderCircle size={14} className="mx-auto animate-spin" /> : "Connect Cloudflare"}</button>
    </form>}
    {notice && <p role="status" className="mt-3 text-xs text-emerald-200">{notice}</p>}
    {!connected && error && <p role="alert" className="mt-3 text-xs text-rose-200">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-3 text-[10px]"><a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">Cloudflare dashboard <ExternalLink size={10}/></a><a href="https://developers.cloudflare.com/api/resources/r2/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200">R2 API docs <ExternalLink size={10}/></a></div>
    <p className="mt-2 text-[10px] text-slate-500">Read-only: no uploads, downloads, bucket creation, deletion, DNS or Worker changes. Object-level operations are not enabled.</p>
  </section>;
}
