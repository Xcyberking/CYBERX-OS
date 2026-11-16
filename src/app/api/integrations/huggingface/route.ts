import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const API = "https://huggingface.co";

async function context() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { response: NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 }) };
  return { user, service: createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

async function hfFetch(path: string, token: string) {
  const response = await fetch(API + path, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : "Hugging Face Hub API request failed.";
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload;
}

function apiError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 502;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Hugging Face Hub API request failed." }, {
    status: status === 401 || status === 403 ? 401 : status === 429 ? 429 : 502
  });
}

function mapRepos(items: unknown, type: "model" | "dataset" | "space") {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 50).map((item: Record<string, unknown>) => ({
    id: String(item.id || item.modelId || item.repo_id || ""),
    type,
    private: Boolean(item.private),
    downloads: typeof item.downloads === "number" ? item.downloads : null,
    likes: typeof item.likes === "number" ? item.likes : null,
    lastModified: typeof item.lastModified === "string" ? item.lastModified : null,
    pipelineTag: typeof item.pipeline_tag === "string" ? item.pipeline_tag : null,
    sdk: typeof item.sdk === "string" ? item.sdk : null
  })).filter((item: { id: string }) => item.id);
}

export async function POST(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 20 || token.length > 5000 || !/^hf_[A-Za-z0-9]{10,}$/.test(token)) {
      return NextResponse.json({ error: "Enter a valid Hugging Face user access token." }, { status: 400 });
    }
    const profile = await hfFetch("/api/whoami-v2", token) as { name?: string; fullname?: string };
    if (!profile.name) return NextResponse.json({ error: "Hugging Face did not return an account name." }, { status: 400 });
    const account = profile.fullname || profile.name;
    const { error } = await ctx.service.from("integration_connections").upsert({
      owner_id: ctx.user.id, provider: "huggingface", label: "huggingface", status: "connected",
      account_label: account,
      public_config: { username: profile.name, access: "read-only-public-repository-inventory" },
      secret_ciphertext: encryptIntegrationSecret(token),
      last_checked_at: new Date().toISOString()
    }, { onConflict: "owner_id,provider,label" });
    if (error) throw error;
    return NextResponse.json({ ok: true, account });
  } catch (error) { return apiError(error); }
}

export async function GET() {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const { data: connection, error } = await ctx.service.from("integration_connections")
      .select("status,secret_ciphertext,account_label,public_config")
      .eq("owner_id", ctx.user.id).eq("provider", "huggingface").eq("label", "huggingface").maybeSingle();
    if (error) throw error;
    if (!connection || connection.status !== "connected" || !connection.secret_ciphertext) {
      return NextResponse.json({ error: "Connect Hugging Face first." }, { status: 409 });
    }
    const token = decryptIntegrationSecret(connection.secret_ciphertext);
    const config = connection.public_config as { username?: string } | null;
    const username = config?.username || "";
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,95}$/.test(username)) {
      return NextResponse.json({ error: "Saved Hugging Face account details are invalid. Reconnect the account." }, { status: 409 });
    }
    const [profile, models, datasets, spaces] = await Promise.all([
      hfFetch("/api/whoami-v2", token),
      hfFetch("/api/models?author=" + encodeURIComponent(username) + "&limit=50&sort=lastModified&direction=-1", token),
      hfFetch("/api/datasets?author=" + encodeURIComponent(username) + "&limit=50&sort=lastModified&direction=-1", token),
      hfFetch("/api/spaces?author=" + encodeURIComponent(username) + "&limit=50&sort=lastModified&direction=-1", token)
    ]);
    const repositories = [
      ...mapRepos(models, "model"),
      ...mapRepos(datasets, "dataset"),
      ...mapRepos(spaces, "space")
    ].sort((a, b) => (b.lastModified || "").localeCompare(a.lastModified || ""));
    const account = typeof (profile as { fullname?: unknown }).fullname === "string"
      ? String((profile as { fullname: string }).fullname) : username;
    await ctx.service.from("integration_connections").update({
      account_label: account, last_checked_at: new Date().toISOString(), status: "connected"
    }).eq("owner_id", ctx.user.id).eq("provider", "huggingface").eq("label", "huggingface");
    return NextResponse.json({ account, username, repositories }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && /unauthorized|invalid token|not authenticated/i.test(error.message)) {
      await ctx.service.from("integration_connections").update({ status: "error" })
        .eq("owner_id", ctx.user.id).eq("provider", "huggingface").eq("label", "huggingface");
    }
    return apiError(error);
  }
}
