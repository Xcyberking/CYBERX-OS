import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptIntegrationSecret } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await createClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 });
    const service = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: connection, error } = await service.from("integration_connections")
      .select("secret_ciphertext,status,account_label").eq("owner_id", user.id)
      .eq("provider", "github").eq("label", "github").maybeSingle();
    if (error) throw error;
    if (!connection || connection.status !== "connected" || !connection.secret_ciphertext) {
      return NextResponse.json({ error: "Connect GitHub first." }, { status: 409 });
    }

    const token = decryptIntegrationSecret(connection.secret_ciphertext);
    const profileResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store"
    });
    if (!profileResponse.ok) {
      if (profileResponse.status === 401) await service.from("integration_connections").update({ status: "error" })
        .eq("owner_id", user.id).eq("provider", "github").eq("label", "github");
      return NextResponse.json({ error: "GitHub authorization expired or was revoked. Reconnect the account." }, { status: 401 });
    }
    const profile = await profileResponse.json() as { login?: string };
    if (!profile.login) throw new Error("GitHub account profile is unavailable.");

    const reposResponse = await fetch("https://api.github.com/users/" + encodeURIComponent(profile.login) + "/repos?type=owner&sort=updated&per_page=100", {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store"
    });
    if (!reposResponse.ok) throw new Error("Could not load public repositories from GitHub.");
    const repos = await reposResponse.json() as Array<{ id: number; name: string; full_name: string; html_url: string; description: string | null; private: boolean; default_branch: string; updated_at: string }>;
    await service.from("integration_connections").update({ last_checked_at: new Date().toISOString(), status: "connected" })
      .eq("owner_id", user.id).eq("provider", "github").eq("label", "github");
    return NextResponse.json({
      account: profile.login,
      access: "public-repositories-read-only",
      repositories: repos.map(repo => ({
        id: repo.id, name: repo.name, full_name: repo.full_name, html_url: repo.html_url,
        description: repo.description, private: repo.private, default_branch: repo.default_branch, updated_at: repo.updated_at
      }))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load GitHub repositories." }, { status: 500 });
  }
}
