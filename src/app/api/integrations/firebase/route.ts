import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptIntegrationSecret } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function context() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { response: NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 }) };
  return { user, service: createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

async function googleFetch(path: string, accessToken: string) {
  const response = await fetch("https://firebase.googleapis.com/v1beta1" + path, {
    headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string }; results?: unknown[]; apps?: unknown[]; nextPageToken?: string };
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Firebase Management API request failed.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload;
}
async function accessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth environment variables are missing.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store", signal: AbortSignal.timeout(12000)
  });
  const payload = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    const error = new Error(payload.error || "Google access token refresh failed.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload.access_token;
}
function apiError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 502;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Firebase API request failed." }, {
    status: status === 401 || status === 403 ? 401 : status === 429 ? 429 : 502
  });
}

export async function GET() {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const { data: connection, error } = await ctx.service.from("integration_connections")
      .select("status,secret_ciphertext,account_label")
      .eq("owner_id", ctx.user.id).eq("provider", "firebase").eq("label", "firebase").maybeSingle();
    if (error) throw error;
    if (!connection || connection.status !== "connected" || !connection.secret_ciphertext) {
      return NextResponse.json({ error: "Connect Google/Firebase first." }, { status: 409 });
    }
    const refreshToken = decryptIntegrationSecret(connection.secret_ciphertext);
    const token = await accessToken(refreshToken);
    const result = await googleFetch("/projects?pageSize=100", token);
    const rawProjects = Array.isArray(result.results) ? result.results : [];
    const projects = await Promise.all(rawProjects.slice(0, 100).map(async (raw: unknown) => {
      const project = raw as Record<string, unknown>;
      const projectId = typeof project.projectId === "string" ? project.projectId : "";
      if (!projectId) return null;
      let apps: Array<{ appId: string; displayName: string; platform: string; namespace: string | null }> = [];
      try {
        const appResult = await googleFetch("/projects/" + encodeURIComponent(projectId) + ":searchApps?pageSize=100", token);
        apps = (Array.isArray(appResult.apps) ? appResult.apps : []).slice(0, 100).map((rawApp: unknown) => {
          const app = rawApp as Record<string, unknown>;
          return {
            appId: typeof app.appId === "string" ? app.appId : "",
            displayName: typeof app.displayName === "string" ? app.displayName : "Unnamed app",
            platform: typeof app.platform === "string" ? app.platform : "UNKNOWN",
            namespace: typeof app.namespace === "string" ? app.namespace : null
          };
        }).filter(app => app.appId);
      } catch { /* project inventory remains useful if app listing is restricted */ }
      return {
        projectId, projectNumber: typeof project.projectNumber === "string" ? project.projectNumber : null,
        displayName: typeof project.displayName === "string" ? project.displayName : projectId,
        state: typeof project.state === "string" ? project.state : "ACTIVE",
        apps
      };
    }));
    await ctx.service.from("integration_connections").update({
      last_checked_at: new Date().toISOString(), status: "connected"
    }).eq("owner_id", ctx.user.id).eq("provider", "firebase").eq("label", "firebase");
    return NextResponse.json({ account: connection.account_label, projects: projects.filter(Boolean) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && /invalid_grant|invalid token|unauthorized/i.test(error.message)) {
      await ctx.service.from("integration_connections").update({ status: "error" })
        .eq("owner_id", ctx.user.id).eq("provider", "firebase").eq("label", "firebase");
    }
    return apiError(error);
  }
}
