"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, Copy, Download, ShieldCheck, TriangleAlert } from "lucide-react";

const sample = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "Example API", version: "1.0.0", description: "A sample service" },
  servers: [{ url: "https://api.example.com" }],
  paths: { "/health": { get: { summary: "Health check", responses: { "200": { description: "Service is healthy" } } } } }
}, null, 2);

type ApiOperation = { summary?: string; description?: string; operationId?: string; parameters?: unknown[]; responses?: Record<string, unknown> };
type ApiSpec = { openapi?: string; swagger?: string; info?: { title?: string; version?: string; description?: string }; servers?: { url: string }[]; paths: Record<string, Record<string, ApiOperation | undefined>> };
type Operation = { path: string; method: string; summary: string; operationId: string; parameters: number; responses: string[] };

function makeMarkdown(spec: ApiSpec, ops: Operation[]) {
  let out = `# ${spec.info?.title || "API"}\n\n${spec.info?.description || ""}\n\n- **Version:** ${spec.info?.version || "Not specified"}\n- **OpenAPI:** ${spec.openapi || spec.swagger || "Unknown"}\n\n## Servers\n`;
  for (const server of spec.servers || []) out += `- ${server.url}\n`;
  out += "\n## Endpoints\n";
  for (const op of ops) out += `\n### ${op.method} ${op.path}\n\n${op.summary}\n\n- Operation ID: ${op.operationId || "—"}\n- Parameters: ${op.parameters}\n- Responses: ${op.responses.join(", ") || "Not documented"}\n`;
  return out;
}

export default function ApiDocsStudio() {
  const [source, setSource] = useState(sample);
  const [message, setMessage] = useState("");
  const parsed = useMemo(() => {
    try {
      const spec = JSON.parse(source) as ApiSpec;
      if (!spec || typeof spec !== "object" || (!spec.openapi && !spec.swagger) || !spec.info || !spec.paths || typeof spec.paths !== "object") throw new Error("Expected an OpenAPI/Swagger object with info and paths.");
      const methods = ["get", "post", "put", "patch", "delete", "options", "head", "trace"];
      const ops: Operation[] = [];
      for (const [path, item] of Object.entries(spec.paths)) {
        if (!item || typeof item !== "object") continue;
        for (const method of methods) {
          const op = item[method];
          if (op && typeof op === "object") ops.push({ path, method: method.toUpperCase(), summary: op.summary || op.description || "No summary provided", operationId: op.operationId || "", parameters: Array.isArray(op.parameters) ? op.parameters.length : 0, responses: Object.keys(op.responses || {}) });
        }
      }
      return { spec, ops, problem: "" };
    } catch (error) { return { spec: null, ops: [] as Operation[], problem: error instanceof Error ? error.message : "Invalid JSON" }; }
  }, [source]);
  const output = parsed.spec ? makeMarkdown(parsed.spec, parsed.ops) : "";
  async function copy() { try { await navigator.clipboard.writeText(output); setMessage("Markdown copied."); } catch { setMessage("Clipboard unavailable. Use Download."); } }
  function download() { const url = URL.createObjectURL(new Blob([output], { type: "text/markdown" })); const a = document.createElement("a"); a.href = url; a.download = "api-documentation.md"; a.click(); URL.revokeObjectURL(url); }
  return <main className="grid-bg min-h-screen p-4 text-white sm:p-8"><div className="mx-auto max-w-6xl"><Link href="/" className="mb-6 inline-flex items-center gap-2 text-xs text-slate-400"><ArrowLeft size={14}/> Workspace</Link><header className="mb-6 rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#10263a] to-[#17112d] p-6"><div className="flex items-center gap-2 text-xs font-bold tracking-widest text-cyan-200"><BookOpen size={15}/> DEVELOPER TOOL</div><h1 className="mt-3 text-3xl font-bold">API Docs Studio</h1><p className="mt-2 text-sm text-slate-400">Inspect OpenAPI JSON and generate Markdown documentation locally.</p></header><div className="grid gap-5 lg:grid-cols-2"><section className="panel rounded-2xl p-4"><div className="mb-3 flex justify-between"><h2 className="font-semibold">OpenAPI JSON</h2><button onClick={() => setSource(sample)} className="text-xs text-cyan-200">Load sample</button></div><textarea value={source} onChange={e => setSource(e.target.value)} spellCheck={false} className="min-h-[420px] w-full rounded-xl border border-white/10 bg-[#070d18] p-3 font-mono text-xs leading-5 outline-none"/>{parsed.problem ? <p className="mt-3 flex gap-2 text-xs text-rose-200"><TriangleAlert size={15}/>{parsed.problem}</p> : <p className="mt-3 flex gap-2 text-xs text-emerald-200"><CheckCircle2 size={15}/> Valid structure · {parsed.ops.length} operations</p>}</section><section className="panel rounded-2xl p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">Documentation preview</h2><div className="flex gap-2"><button disabled={!output} onClick={() => void copy()} className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-40"><Copy size={13} className="inline"/> Copy</button><button disabled={!output} onClick={download} className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"><Download size={13} className="inline"/> Download</button></div></div><pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-xl bg-[#070d18] p-4 text-xs leading-6 text-slate-300">{output || "Documentation appears when JSON is valid."}</pre>{message && <p role="status" className="mt-2 text-xs text-cyan-200">{message}</p>}<p className="mt-4 flex gap-2 rounded-xl border border-amber-300/15 p-3 text-[11px] leading-5 text-amber-100"><ShieldCheck size={15}/> Browser-only parser. It does not fetch server URLs or execute API calls.</p></section></div><section className="panel mt-5 rounded-2xl p-4"><h2 className="font-semibold">Endpoint index</h2>{parsed.ops.map((op, i) => <div key={op.method + op.path + i} className="flex flex-wrap gap-3 border-b border-white/[.06] py-3 text-xs"><b className="text-cyan-200">{op.method}</b><code>{op.path}</code><span className="text-slate-500">{op.summary}</span></div>)}</section></div></main>;
}
