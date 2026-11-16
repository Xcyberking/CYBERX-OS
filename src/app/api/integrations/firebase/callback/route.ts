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
  return NextResponse.redirect(new URL("/developer-hub?firebase=" + encodeURIComponent(result), request.url));
}
function clearState(response: NextResponse) {
  response.cookies.set("cyberx_firebase_oauth_state", "", { path: "/api/integrations/firebase/callback", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const cookie = request.headers.get("cookie") || "";
  const expectedState = cookie.split(";").map(v => v.trim()).find(v => v.startsWith("cyberx_firebase_oauth_state="))?.split("=").slice(1).join("=") || "";
  if (!code || !expectedState || expectedState.length !== state.length ||
      !timingSafeEqual(Buffer.from(expectedState), Buffer.from(state))) {
    return clearState(redirect(request, "state-error"));
  }

  try {
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return clearState(redirect(request, "sign-in-required"));

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) throw new Error("Google OAuth environment variables are missing.");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      cache: "no-store", signal: AbortSignal.timeout(12000)
    });
    const tokenData = await tokenResponse.json() as { access_token?: string; refresh_token?: string; error?: string };
    if (!tokenResponse.ok || !tokenData.access_token || !tokenData.refresh_token) {
      throw new Error(tokenData.error || "Google did not return a refresh token. Reconnect and approve offline access.");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + tokenData.access_token }, cache: "no-store", signal: AbortSignal.timeout(10000)
    });
    if (!profileResponse.ok) throw new Error("Could not verify the Google account.");
    const profile = await profileResponse.json() as { email?: string; name?: string; sub?: string };
    if (!profile.sub || !profile.email) throw new Error("Google returned an incomplete account profile.");

    const { error } = await serviceClient().from("integration_connections").upsert({
      owner_id: user.id, provider: "firebase", label: "firebase", status: "connected",
      account_label: profile.email,
      public_config: { google_subject: profile.sub, email: profile.email, access: "firebase-project-and-app-metadata-read-only" },
      secret_ciphertext: encryptIntegrationSecret(tokenData.refresh_token),
      last_checked_at: new Date().toISOString()
    }, { onConflict: "owner_id,provider,label" });
    if (error) throw error;
    return clearState(redirect(request, "connected"));
  } catch {
    return clearState(redirect(request, "failed"));
  }
}
