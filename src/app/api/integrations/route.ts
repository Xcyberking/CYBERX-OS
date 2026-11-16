import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
const providers = new Set(["github","vercel","railway","render","cloudflare","supabase","firebase","huggingface"]);
export async function GET() {
 try {
  const supabase=await createClient(); const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const {data,error}=await supabase.from("integration_connections").select("id,provider,label,status,account_label,last_checked_at,created_at,updated_at").eq("owner_id",user.id).order("created_at",{ascending:false}).limit(100);
  if(error)throw error; return NextResponse.json({connections:data||[]});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not load integrations."},{status:500});}
}
export async function POST(request:Request) {
 try {
  const supabase=await createClient(); const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const body=await request.json(); const provider=typeof body.provider==="string"?body.provider.trim().toLowerCase():"";
  const accountLabel=typeof body.accountLabel==="string"?body.accountLabel.trim().slice(0,100):"";
  if(!providers.has(provider))return NextResponse.json({error:"Choose a supported provider."},{status:400});
  const {data,error}=await supabase.from("integration_connections").upsert({owner_id:user.id,provider,label:provider,status:"pending",account_label:accountLabel||null},{onConflict:"owner_id,provider,label"}).select("id,provider,label,status,account_label,last_checked_at,created_at,updated_at").single();
  if(error)throw error; return NextResponse.json({connection:data,message:"Setup record saved. Provider authorization is not connected yet."},{status:201});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not save integration."},{status:500});}
}
export async function DELETE(request:Request) {
 try {
  const supabase=await createClient(); const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const id=new URL(request.url).searchParams.get("id"); if(!id)return NextResponse.json({error:"Connection id is required."},{status:400});
  const {error}=await supabase.from("integration_connections").delete().eq("id",id).eq("owner_id",user.id);
  if(error)throw error; return NextResponse.json({ok:true});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not remove integration."},{status:500});}
}
