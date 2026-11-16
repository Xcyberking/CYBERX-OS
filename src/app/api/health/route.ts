import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  return NextResponse.json({
    ok: true, service: "cyberx-os", status: "healthy", timestamp: new Date().toISOString(),
    integrations: { supabase_public_configured: configured, admin_api_configured: configured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) }
  });
}
