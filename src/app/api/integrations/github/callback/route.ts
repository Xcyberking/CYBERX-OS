import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { encryptIntegrationSecret } from "@/lib/integrations/crypto";

export const runtime = "nodejs";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server admin configuration is missing.");
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function redirect(request: Request, result: string) {
  return NextResponse.redirect(new URL("/developer-hub?github=" + encodeURIComponent(result), request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith("cyberx_github_oauth_state="))?.split("=").slice(1).join("=") || "";
  const actualState = state || "";
  if (!code || !expectedState || expectedState.length !== actualState.length ||
      !timingSafeEqual(Buffer.from(expectedState), Buffer.from(actualState))) {
    const response = redirect(request, "state-error");
    response.cookies.set("cyberx_github_oauth_state", "", { path: "/api/integrations/github/callback", maxAge: 0 });
    return response;
  }

  try {
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return redirect(request, "sign-in-required");

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) throw new Error("GitHub OAuth environment variables are missing.");

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
      cache: "no-store"
    });
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error || "GitHub token exchange failed.");

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + tokenData.access_token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store"
    });
    if (!profileResponse.ok) throw new Error("Could not verify the GitHub account.");
    const githubUser = await profileResponse.json() as { login?: string; html_url?: string };
    if (!githubUser.login) throw new Error("GitHub returned an invalid account profile.");

    const service = serviceClient();
    const secret_ciphertext = encryptIntegrationSecret(tokenData.access_token);
    const { error } = await service.from("integration_connections").upsert({
      owner_id: user.id,
      provider: "github",
      label: "github",
      status: "connected",
      account_label: githubUser.login,
      public_config: { login: githubUser.login, profile_url: githubUser.html_url || null, access: "public-repositories-read-only" },
      secret_ciphertext,
      last_checked_at: new Date().toISOString()
    }, { onConflict: "owner_id,provider,label" });
    if (error) throw error;

    const response = redirect(request, "connected");
    response.cookies.set("cyberx_github_oauth_state", "", { path: "/api/integrations/github/callback", maxAge: 0 });
    return response;
  } catch (error) {
    const response = redirect(request, error instanceof Error ? "failed" : "failed");
    response.cookies.set("cyberx_github_oauth_state", "", { path: "/api/integrations/github/callback", maxAge: 0 });
    return response;
  }
}
