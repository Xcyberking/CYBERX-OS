import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const API = "https://api.cloudflare.com/client/v4";

async function context() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { response: NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 }) };
  return { user, service: createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

async function cfFetch(path: string, token: string) {
  const response = await fetch(API + path, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => ({})) as {
    success?: boolean; result?: unknown; errors?: Array<{ message?: string; code?: number }>;
    result_info?: { cursor?: string; count?: number };
  };
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map(e => e.message).filter(Boolean).join("; ") || "Cloudflare API request failed.";
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status || 502;
    throw error;
  }
  return payload;
}

function apiError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 502;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Cloudflare API request failed." }, {
    status: status === 401 || status === 403 ? 401 : status === 429 ? 429 : 502
  });
}

export async function POST(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    if (token.length < 20 || token.length > 5000) return NextResponse.json({ error: "Enter a valid Cloudflare API token." }, { status: 400 });
    if (!/^[a-f0-9]{32}$/i.test(accountId)) return NextResponse.json({ error: "Cloudflare Account ID must be 32 hexadecimal characters." }, { status: 400 });
    const verify = await cfFetch("/user/tokens/verify", token);
    const verifyResult = verify.result as { status?: string } | undefined;
    if (verifyResult?.status !== "active") return NextResponse.json({ error: "Cloudflare token is not active." }, { status: 400 });
    const accountResponse = await cfFetch("/accounts/" + encodeURIComponent(accountId), token);
    const account = accountResponse.result as { id: string; name: string };
    const { error } = await ctx.service.from("integration_connections").upsert({
      owner_id: ctx.user.id, provider: "cloudflare", label: "cloudflare", status: "connected",
      account_label: account.name || "Cloudflare account",
      public_config: { account_id: account.id, access: "read-only-r2-bucket-inventory" },
      secret_ciphertext: encryptIntegrationSecret(token),
      last_checked_at: new Date().toISOString()
    }, { onConflict: "owner_id,provider,label" });
    if (error) throw error;
    return NextResponse.json({ ok: true, account: account.name || "Cloudflare account" });
  } catch (error) { return apiError(error); }
}

export async function GET() {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const { data: connection, error } = await ctx.service.from("integration_connections")
      .select("status,secret_ciphertext,account_label,public_config")
      .eq("owner_id", ctx.user.id).eq("provider", "cloudflare").eq("label", "cloudflare").maybeSingle();
    if (error) throw error;
    if (!connection || connection.status !== "connected" || !connection.secret_ciphertext) {
      return NextResponse.json({ error: "Connect Cloudflare first." }, { status: 409 });
    }
    const config = connection.public_config as { account_id?: string } | null;
    const accountId = config?.account_id || "";
    if (!/^[a-f0-9]{32}$/i.test(accountId)) return NextResponse.json({ error: "Saved Cloudflare account configuration is invalid. Reconnect the account." }, { status: 409 });
    const token = decryptIntegrationSecret(connection.secret_ciphertext);
    const [accountResponse, bucketResponse] = await Promise.all([
      cfFetch("/accounts/" + encodeURIComponent(accountId), token),
      cfFetch("/accounts/" + encodeURIComponent(accountId) + "/r2/buckets", token)
    ]);
    const account = accountResponse.result as { id: string; name: string };
    const bucketData = bucketResponse.result as { buckets?: Array<{ name?: string; creation_date?: string; location?: string; jurisdiction?: string; storage_class?: string }> };
    const buckets = (bucketData.buckets || []).slice(0, 100).map(bucket => ({
      name: bucket.name || "Unnamed bucket",
      createdAt: bucket.creation_date || null,
      location: bucket.location || null,
      jurisdiction: bucket.jurisdiction || null,
      storageClass: bucket.storage_class || null
    }));
    await ctx.service.from("integration_connections").update({ last_checked_at: new Date().toISOString(), status: "connected" })
      .eq("owner_id", ctx.user.id).eq("provider", "cloudflare").eq("label", "cloudflare");
    return NextResponse.json({ account: account.name || connection.account_label, buckets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && /not authorized|unauthorized|invalid token|authentication/i.test(error.message)) {
      await ctx.service.from("integration_connections").update({ status: "error" })
        .eq("owner_id", ctx.user.id).eq("provider", "cloudflare").eq("label", "cloudflare");
    }
    return apiError(error);
  }
}
