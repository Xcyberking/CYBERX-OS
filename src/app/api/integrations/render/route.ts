import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { encryptIntegrationSecret, decryptIntegrationSecret } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const RENDER_API = "https://api.render.com/v1";

async function context() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { response: NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 }) };
  return { user, service: createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

async function renderFetch(path: string, token: string) {
  return fetch(RENDER_API + path, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000)
  });
}

function renderError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status: status === 401 || status === 403 ? 401 : status === 429 ? 429 : 502 });
}

export async function POST(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 12 || token.length > 5000) return NextResponse.json({ error: "Enter a valid Render API key." }, { status: 400 });
    const verify = await renderFetch("/services?limit=1&includePreviews=false", token);
    if (!verify.ok) {
      const details = await verify.json().catch(() => ({})) as { message?: string; error?: string };
      return renderError(verify.status, details.message || details.error || "Render rejected this API key.");
    }
    const { error } = await ctx.service.from("integration_connections").upsert({
      owner_id: ctx.user.id, provider: "render", label: "render", status: "connected",
      account_label: "Render account",
      public_config: { access: "read-only-services-and-deploys" },
      secret_ciphertext: encryptIntegrationSecret(token),
      last_checked_at: new Date().toISOString()
    }, { onConflict: "owner_id,provider,label" });
    if (error) throw error;
    return NextResponse.json({ ok: true, account: "Render account" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not connect Render." }, { status: 500 });
  }
}

export async function GET() {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const { data: connection, error } = await ctx.service.from("integration_connections")
      .select("status,secret_ciphertext,account_label")
      .eq("owner_id", ctx.user.id).eq("provider", "render").eq("label", "render").maybeSingle();
    if (error) throw error;
    if (!connection || connection.status !== "connected" || !connection.secret_ciphertext) {
      return NextResponse.json({ error: "Connect Render first." }, { status: 409 });
    }
    const token = decryptIntegrationSecret(connection.secret_ciphertext);
    const response = await renderFetch("/services?limit=50&includePreviews=false", token);
    if (!response.ok) {
      const details = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (response.status === 401 || response.status === 403) {
        await ctx.service.from("integration_connections").update({ status: "error" })
          .eq("owner_id", ctx.user.id).eq("provider", "render").eq("label", "render");
      }
      return renderError(response.status, details.message || details.error || "Render API request failed. Reconnect the API key.");
    }
    const rows = await response.json() as Array<{ service?: Record<string, unknown>; cursor?: string } | Record<string, unknown>>;
    const services = rows.slice(0, 50).map(row => ("service" in row && row.service ? row.service : row) as {
      id?: string; name?: string; type?: string; ownerId?: string; suspended?: string;
      dashboardUrl?: string; createdAt?: string; updatedAt?: string;
      serviceDetails?: { url?: string };
    }).filter(service => typeof service.id === "string");
    const results = await Promise.all(services.map(async service => {
      const deployResponse = await renderFetch("/services/" + encodeURIComponent(service.id!) + "/deploys?limit=3", token);
      if (!deployResponse.ok) return { ...service, latestDeploys: [] };
      const deployRows = await deployResponse.json() as Array<{ deploy?: Record<string, unknown> } & Record<string, unknown>>;
      const latestDeploys = deployRows.slice(0, 3).map(row => {
        const deploy = (row.deploy || row) as { id?: string; status?: string; createdAt?: string; finishedAt?: string; trigger?: string };
        return { id: deploy.id || "", status: deploy.status || "unknown", createdAt: deploy.createdAt || null, finishedAt: deploy.finishedAt || null, trigger: deploy.trigger || null };
      });
      return { ...service, latestDeploys };
    }));
    await ctx.service.from("integration_connections").update({ last_checked_at: new Date().toISOString(), status: "connected" })
      .eq("owner_id", ctx.user.id).eq("provider", "render").eq("label", "render");
    return NextResponse.json({ account: connection.account_label, services: results }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load Render services." }, { status: 500 });
  }
}
