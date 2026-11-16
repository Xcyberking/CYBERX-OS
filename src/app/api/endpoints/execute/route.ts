import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_RESPONSE_BYTES = 256 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 32 * 1024;

function allowedHost(hostname: string) {
  const configured = (process.env.CYBERX_API_ALLOWED_HOSTS || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const host = hostname.toLowerCase();
  return configured.some((entry) => host === entry || host.endsWith("." + entry));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  let input: unknown;
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = input as Record<string, unknown>;
  const id = typeof body.endpoint_id === "string" ? body.endpoint_id : "";
  const params = body.params && typeof body.params === "object" && !Array.isArray(body.params)
    ? body.params as Record<string, unknown> : {};
  if (!id) return NextResponse.json({ error: "Endpoint id is required." }, { status: 400 });
  if (new TextEncoder().encode(JSON.stringify(params)).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request parameters exceed 32 KB." }, { status: 413 });
  }

  const { data: endpoint, error } = await supabase.from("api_endpoints")
    .select("id,name,endpoint_url,method,is_enabled").eq("id", id).eq("owner_id", user.id).single();
  if (error || !endpoint) return NextResponse.json({ error: "Endpoint not found." }, { status: 404 });
  if (!endpoint.is_enabled) return NextResponse.json({ error: "This endpoint is disabled." }, { status: 409 });

  let target: URL;
  try { target = new URL(endpoint.endpoint_url); } catch {
    return NextResponse.json({ error: "Saved endpoint URL is invalid." }, { status: 400 });
  }
  if (target.protocol !== "https:" || target.username || target.password || !allowedHost(target.hostname)) {
    return NextResponse.json({
      error: "This host is not approved. Configure CYBERX_API_ALLOWED_HOSTS with exact trusted provider domains."
    }, { status: 403 });
  }

  const method = endpoint.method as string;
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return NextResponse.json({ error: "Unsupported HTTP method." }, { status: 400 });
  }
  if (method === "GET" || method === "DELETE") {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        target.searchParams.set(key.slice(0, 100), String(value).slice(0, 1000));
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(target, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: { "Accept": "application/json, text/plain, application/xml" },
      ...(method !== "GET" && method !== "DELETE"
        ? { headers: { "Accept": "application/json, text/plain, application/xml", "Content-Type": "application/json" }, body: JSON.stringify(params) }
        : {})
    });
    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json({ error: "Redirect responses are blocked for security." }, { status: 502 });
    }
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          return NextResponse.json({ error: "Provider response exceeds 256 KB." }, { status: 502 });
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const raw = new TextDecoder().decode(bytes);
    const contentType = response.headers.get("content-type") || "text/plain";
    let result: unknown = raw;
    if (contentType.includes("json")) {
      try { result = JSON.parse(raw); } catch { result = raw; }
    }
    await supabase.from("usage_events").insert({
      user_id: user.id, event_type: "api.endpoint.executed", credits_delta: 0,
      metadata: { endpoint_id: endpoint.id, status: response.status, duration_ms: Date.now() - started }
    });
    return NextResponse.json({
      endpoint: endpoint.name, status: response.status, ok: response.ok,
      contentType, durationMs: Date.now() - started, result
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Provider request timed out after 15 seconds."
      : "Provider request failed. Check the trusted host and endpoint.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
