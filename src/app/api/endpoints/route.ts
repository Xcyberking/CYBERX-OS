import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime="nodejs";

export async function GET(){
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const {data,error}=await supabase.from("api_endpoints").select("id,name,endpoint_url,method,description,is_enabled,created_at").eq("owner_id",user.id).order("created_at",{ascending:false});
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({endpoints:data||[]});
}
export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  try{
    const body=await request.json();
    const name=typeof body.name==="string"?body.name.trim().slice(0,80):"";
    const description=typeof body.description==="string"?body.description.trim().slice(0,500):"";
    const method=String(body.method||"GET").toUpperCase();
    const endpoint= new URL(String(body.endpoint_url||""));
    if(!name||!["GET","POST","PUT","PATCH","DELETE"].includes(method)||endpoint.protocol!=="https:"||endpoint.username||endpoint.password) return NextResponse.json({error:"Enter a name and a valid HTTPS endpoint."},{status:400});
    const {data,error}=await supabase.from("api_endpoints").insert({owner_id:user.id,name,description,method,endpoint_url:endpoint.toString()}).select("id,name,endpoint_url,method,description,is_enabled,created_at").single();
    if(error)throw error;
    return NextResponse.json({endpoint:data},{status:201});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid endpoint details."},{status:400});}
}
export async function DELETE(request:Request){
  const supabase=await createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({error:"Endpoint id required."},{status:400});
  const {error}=await supabase.from("api_endpoints").delete().eq("id",id).eq("owner_id",user.id);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true});
}
