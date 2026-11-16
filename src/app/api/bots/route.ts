import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime="nodejs";

export async function GET(){
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const {data,error}=await supabase.from("bot_instances").select("id,name,runtime,provider,status,entrypoint,created_at").eq("owner_id",user.id).order("created_at",{ascending:false});
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({bots:data||[]});
}
export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  try{
    const body=await request.json();
    const name=typeof body.name==="string"?body.name.trim().slice(0,80):"";
    const runtime=body.runtime==="node"?"node":"python";
    const provider=typeof body.provider==="string"?body.provider.trim().slice(0,60):null;
    const entrypoint=typeof body.entrypoint==="string"?body.entrypoint.trim().slice(0,120):null;
    if(!name)return NextResponse.json({error:"Bot name is required."},{status:400});
    const {data,error}=await supabase.from("bot_instances").insert({owner_id:user.id,name,runtime,provider,entrypoint}).select("id,name,runtime,provider,status,entrypoint,created_at").single();
    if(error)throw error;
    return NextResponse.json({bot:data},{status:201});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not save bot."},{status:400});}
}
export async function DELETE(request:Request){
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({error:"Bot id required."},{status:400});
  const {error}=await supabase.from("bot_instances").delete().eq("id",id).eq("owner_id",user.id);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true});
}
