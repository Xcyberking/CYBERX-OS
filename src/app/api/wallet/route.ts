import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const [{ data: profile, error: profileError }, { data: transactions, error: txError }] = await Promise.all([
    supabase.from("profiles").select("credits").eq("id", user.id).single(),
    supabase.from("credit_transactions").select("id,amount,balance_after,reason,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
  ]);
  if (profileError || txError) return NextResponse.json({ error: profileError?.message || txError?.message || "Wallet unavailable." }, { status: 500 });
  return NextResponse.json({ balance: profile.credits, transactions: transactions || [] });
}
