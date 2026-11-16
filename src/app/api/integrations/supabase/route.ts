import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const API = "https://api.supabase.com/v1";

async function context() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { response: NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 }) };
  return { user, service: createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

async function supabaseFetch(path: string, token: string) {
  const response = await fetch(API + path, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message :
      typeof payload?.error_description === "string" ? payload.error_description :
      typeof payload?.error === "string" ? payload.error : "Supabase Management API request failed.";
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload;
}

function apiError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 502;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase Management API request failed." }, {
    status: status === 401 || status === 403 ? 401 : status === 429 ? 429 : 502
  });
}

export async function POST(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 20 || token.length > 5000) return NextResponse.json({ error: "Enter a valid Supabase personal access token." }, { status: 400 });
    const result = await supabaseFetch("/projects", token);
    if (!Array.isArray(result)) return NextResponse.json({ error: "Supabase did not return a project list. Check the token's Projects read permission." }, { status: 400 });
    const label = "Supabase account · " + result.length + " project" + (result.length === 1 ? "" : "s");
    const { error } = await ctx.service.from("integration_connections").upsert({
      owner_id: ctx.user.id, provider: "supabase", label: "supabase", status: "connected",
      account_label: label,
      public_config: { access: "read-only-project-inventory" },
      secret_ciphertext: encryptIntegrationSecret(token),
      last_checked_at: new Date().toISOString()
    }, { onConflict: "owner_id,provider,label" });
    if (error) throw error;
    return NextResponse.json({ ok: true, account: label, projectCount: result.length });
  } catch (error) { return apiError(error); }
}

export async function GET() {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const { data: connection, error } = await ctx.service.from("integration_connections")
      .select("status,secret_ciphertext,account_label")
      .eq("owner_id", ctx.user.id).eq("provider", "supabase").eq("label", "supabase").maybeSingle();
    if (error) throw error;
    if (!connection || connection.status !== "connected" || !connection.secret_ciphertext) {
      return NextResponse.json({ error: "Connect Supabase first." }, { status: 409 });
    }
    const token = decryptIntegrationSecret(connection.secret_ciphertext);
    const result = await supabaseFetch("/projects", token);
    if (!Array.isArray(result)) throw new Error("Unexpected Supabase projects response.");
    const projects = result.slice(0, 100).map((project: Record<string, unknown>) => ({
      id: String(project.id || ""),
      name: String(project.name || "Unnamed project"),
      region: typeof project.region === "string" ? project.region : null,
      status: typeof project.status === "string" ? project.status : "unknown",
      createdAt: typeof project.created_at === "string" ? project.created_at : null,
      organizationId: typeof project.organization_id === "string" ? project.organization_id : null,
      databaseVersion: typeof project.database?.version === "string" ? project.database.version : null
    })).filter((project: { id: string }) => project.id);
    const label = "Supabase account · " + result.length + " project" + (result.length === 1 ? "" : "s");
    await ctx.service.from("integration_connections").update({
      account_label: label, last_checked_at: new Date().toISOString(), status: "connected"
    }).eq("owner_id", ctx.user.id).eq("provider", "supabase").eq("label", "supabase");
    return NextResponse.json({ account: label, projects }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && /unauthorized|invalid token|not authenticated/i.test(error.message)) {
      await ctx.service.from("integration_connections").update({ status: "error" })
        .eq("owner_id", ctx.user.id).eq("provider", "supabase").eq("label", "supabase");
    }
    return apiError(error);
  }
}
