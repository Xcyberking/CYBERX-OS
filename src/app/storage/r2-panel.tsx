"use client";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Cloud, Download, File, FileUp, LoaderCircle, RefreshCw, Trash2, Unplug } from "lucide-react";

type R2File = { key: string; name: string; size: number; lastModified: string | null };
const MAX_BYTES = 25 * 1024 * 1024;
function sizeLabel(bytes: number) { if (!bytes) return "—"; const units = ["B", "KB", "MB", "GB"]; let value = bytes, index = 0; while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; } return value.toFixed(index ? 1 : 0) + " " + units[index]; }

export default function R2StoragePanel() {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState("");
  const [bucket, setBucket] = useState("");
  const [files, setFiles] = useState<R2File[]>([]);
  const [accountId, setAccountId] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/storage/r2", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load R2 files.");
      setConnected(Boolean(data.connected)); setAccount(data.account || "Cloudflare R2");
      setBucket(data.bucket || ""); setFiles(data.files || []);
    } catch (e) { setError(e instanceof Error ? e.message : "R2 storage unavailable."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/storage/r2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect", accountId, bucket, accessKeyId, secretAccessKey }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "R2 connection failed.");
      setSecretAccessKey(""); setAccessKeyId(""); setNotice("R2 bucket connected. Credentials are encrypted on the server."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not connect R2."); }
    finally { setBusy(false); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (file.size < 1 || file.size > MAX_BYTES) { setError("Choose a file up to 25 MB."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const signedResponse = await fetch("/api/storage/r2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "presign-upload", fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size }) });
      const signed = await signedResponse.json();
      if (!signedResponse.ok) throw new Error(signed.error || "Could not prepare upload.");
      const put = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": signed.contentType }, body: file });
      if (!put.ok) throw new Error("R2 upload failed. Check the bucket CORS policy and try again.");
      const confirm = await fetch("/api/storage/r2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm-upload", key: signed.key }) });
      const result = await confirm.json();
      if (!confirm.ok) throw new Error(result.error || "Could not verify uploaded file.");
      setNotice("Uploaded " + file.name); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  async function download(key: string) {
    try {
      const response = await fetch("/api/storage/r2?download=" + encodeURIComponent(key), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create download link.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed."); }
  }
  async function remove(key: string) {
    if (!window.confirm("Permanently delete this file from your R2 bucket?")) return;
    try {
      const response = await fetch("/api/storage/r2?key=" + encodeURIComponent(key), { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed.");
      setFiles(current => current.filter(file => file.key !== key)); setNotice("File deleted from R2.");
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
  }
  async function disconnect() {
    if (!window.confirm("Disconnect R2? Your bucket and files will NOT be deleted.")) return;
    const response = await fetch("/api/storage/r2?disconnect=1", { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not disconnect R2."); return; }
    setConnected(false); setFiles([]); setNotice("R2 disconnected. Existing bucket files were left untouched.");
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);

  return <section className="panel mt-5 overflow-hidden rounded-2xl">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] px-5 py-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><Cloud size={17} className="text-orange-200" /> Cloudflare R2 Storage</div>
      {connected && <span className="rounded-full border border-emerald-300/20 px-2.5 py-1 text-[9px] text-emerald-200">Connected · {bucket}</span>}
    </div>
    <div className="p-5">
      {error && <p role="alert" className="mb-3 rounded-lg border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200">{error}</p>}
      {notice && <p role="status" className="mb-3 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3 text-xs text-emerald-200">{notice}</p>}
      {loading ? <div className="py-8 text-center text-xs text-slate-500"><LoaderCircle className="mx-auto mb-2 animate-spin" />Checking R2 connection…</div> : connected ? <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs text-slate-400">Bucket: <span className="text-cyan-100">{bucket}</span></p><p className="mt-1 text-[10px] text-slate-500">{files.length} files listed · {sizeLabel(total)} total listed size · first 100 objects</p></div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950">{busy ? <LoaderCircle size={13} className="animate-spin" /> : <FileUp size={13} />} Upload<input type="file" className="hidden" disabled={busy} onChange={upload} /></label>
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"><RefreshCw size={13} /> Refresh</button>
            <button onClick={() => void disconnect()} className="inline-flex items-center gap-2 rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-200"><Unplug size={13} /> Disconnect</button>
          </div>
        </div>
        <div className="mt-4 divide-y divide-white/[.06] rounded-xl border border-white/[.07]">
          {files.length ? files.map(file => <div key={file.key} className="flex items-center gap-3 px-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[.04] text-orange-200"><File size={16} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs text-slate-200">{file.name}</span><span className="mt-1 block text-[10px] text-slate-500">{sizeLabel(file.size)} · {file.lastModified ? new Date(file.lastModified).toLocaleString() : "Date unavailable"}</span></span>
            <button onClick={() => void download(file.key)} aria-label={"Download " + file.name} className="rounded-lg p-2 text-slate-400 hover:text-cyan-200"><Download size={15} /></button>
            <button onClick={() => void remove(file.key)} aria-label={"Delete " + file.name} className="rounded-lg p-2 text-slate-400 hover:text-rose-200"><Trash2 size={15} /></button>
          </div>) : <div className="p-8 text-center text-xs text-slate-500">No files in your user folder yet.</div>}
        </div>
        <p className="mt-3 text-[10px] leading-5 text-slate-500">Uploads are private under your account ID prefix. Upload limit: 25 MB. Download links expire in 60 seconds. Disconnecting removes saved credentials only; it never deletes bucket data.</p>
      </> : <form onSubmit={connect} className="grid gap-3 sm:grid-cols-2">
        <p className="sm:col-span-2 text-xs leading-5 text-slate-500">Use an R2 S3 API token with Object Read & Write access restricted to one bucket. These S3 credentials are different from the Cloudflare read-only Developer Hub token. Secrets are encrypted server-side and never returned to the browser.</p>
        <label className="text-xs text-slate-400">Cloudflare Account ID<input required minLength={32} maxLength={32} value={accountId} onChange={e => setAccountId(e.target.value.trim())} placeholder="32-character account ID" className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" /></label>
        <label className="text-xs text-slate-400">R2 Bucket name<input required minLength={3} maxLength={63} value={bucket} onChange={e => setBucket(e.target.value.trim().toLowerCase())} placeholder="my-cyberx-files" className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" /></label>
        <label className="text-xs text-slate-400">Access Key ID<input required autoComplete="off" value={accessKeyId} onChange={e => setAccessKeyId(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" /></label>
        <label className="text-xs text-slate-400">Secret Access Key<input required type="password" autoComplete="new-password" value={secretAccessKey} onChange={e => setSecretAccessKey(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080e19] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40" /></label>
        <button disabled={busy || !accountId.trim() || !bucket.trim() || !accessKeyId.trim() || !secretAccessKey.trim()} className="sm:col-span-2 rounded-lg bg-cyan-300 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-50">{busy ? "Verifying bucket…" : "Connect R2 bucket"}</button>
        <div className="sm:col-span-2 rounded-lg border border-amber-300/15 bg-amber-300/[.04] p-3 text-[10px] leading-5 text-amber-100">Browser uploads require this bucket CORS rule: Allowed origin = your exact website origin; Allowed methods = PUT, GET, HEAD; Allowed headers = Content-Type; Expose headers = ETag. Do not use a wildcard origin on a bucket containing private files.</div>
      </form>}
    </div>
  </section>;
}
