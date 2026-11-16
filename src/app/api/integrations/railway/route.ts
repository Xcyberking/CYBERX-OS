import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const RAILWAY_API = "https://backboard.railway.com/graphql/v2";
const PROJECTS_QUERY = `query CyberxProjects {
  projects {
    edges {
      node {
        id
        name
        createdAt
        services { edges { node { id name } } }
        environments { edges { node { id name } } }
      }
    }
  }
}`;
const VERIFY_QUERY = `query CyberxVerify { me { id name email } }`;

async function context() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { response: NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 }) };
  return { user, service: createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

async function railwayQuery(token: string, query: string) {
  const response = await fetch(RAILWAY_API, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({})) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message?: string; extensions?: { code?: string; traceId?: string } }>;
  };
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.map(e => e.message).filter(Boolean).join("; ") || "Railway API request failed.";
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status || (message.toLowerCase().includes("not authorized") ? 401 : 502);
    throw error;
  }
  return payload.data || {};
}

function apiError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 502;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Railway API request failed." }, {
    status: status === 401 || status === 403 ? 401 : status === 429 ? 429 : 502
  });
}

export async function POST(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 12 || token.length > 5000) return NextResponse.json({ error: "Enter a valid Railway account API token." }, { status: 400 });
    const data = await railwayQuery(token, VERIFY_QUERY);
    const me = data.me as { name?: string; username?: string } | null;
    if (!me) return NextResponse.json({ error: "Railway did not return an account profile. Use an account API token; workspace and project tokens are not supported in this connection form." }, { status: 400 });
    const { error } = await ctx.service.from("integration_connections").upsert({
      owner_id: ctx.user.id, provider: "railway", label: "railway", status: "connected",
      account_label: me.name || me.username || "Railway account",
      public_config: { access: "read-only-project-service-inventory" },
      secret_ciphertext: encryptIntegrationSecret(token),
      last_checked_at: new Date().toISOString()
    }, { onConflict: "owner_id,provider,label" });
    if (error) throw error;
    return NextResponse.json({ ok: true, account: me.name || me.username || "Railway account" });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET() {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const { data: connection, error } = await ctx.service.from("integration_connections")
      .select("status,secret_ciphertext,account_label")
      .eq("owner_id", ctx.user.id).eq("provider", "railway").eq("label", "railway").maybeSingle();
    if (error) throw error;
    if (!connection || connection.status !== "connected" || !connection.secret_ciphertext) {
      return NextResponse.json({ error: "Connect Railway first." }, { status: 409 });
    }
    const token = decryptIntegrationSecret(connection.secret_ciphertext);
    const data = await railwayQuery(token, PROJECTS_QUERY);
    const root = data.projects as { edges?: Array<{ node?: {
      id: string; name: string; createdAt?: string;
      services?: { edges?: Array<{ node?: { id: string; name: string } }> };
      environments?: { edges?: Array<{ node?: { id: string; name: string } }> };
    } }> } | undefined;
    const projects = (root?.edges || []).map(edge => edge.node).filter((p): p is NonNullable<typeof p> => Boolean(p)).slice(0, 50).map(project => ({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt || null,
      services: (project.services?.edges || []).map(edge => edge.node).filter(Boolean).slice(0, 50),
      environments: (project.environments?.edges || []).map(edge => edge.node).filter(Boolean).slice(0, 30)
    }));
    await ctx.service.from("integration_connections").update({ last_checked_at: new Date().toISOString(), status: "connected" })
      .eq("owner_id", ctx.user.id).eq("provider", "railway").eq("label", "railway");
    return NextResponse.json({ account: connection.account_label, projects }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && /not authorized|unauthorized|invalid token/i.test(error.message)) {
      await ctx.service.from("integration_connections").update({ status: "error" })
        .eq("owner_id", ctx.user.id).eq("provider", "railway").eq("label", "railway");
    }
    return apiError(error);
  }
}
