import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
export const runtime="nodejs";

async function adminClient(){
  const auth=await createClient();
  const {data:{user},error}=await auth.auth.getUser();
  if(error||!user)return {response:NextResponse.json({error:"Sign in required."},{status:401})};
  const {data:profile}=await auth.from("profiles").select("role").eq("id",user.id).single();
  if(profile?.role!=="admin")return {response:NextResponse.json({error:"Admin access required."},{status:403})};
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return {response:NextResponse.json({error:"Server admin configuration is missing."},{status:503})};
  return {client:createSupabaseClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}}),actorId:user.id};
}
function validate(body: unknown){
  if(typeof body!=="object"||body===null) throw new Error("Tool details are required.");
  const input=body as Record<string,unknown>;
  const name=typeof input.name==="string"?input.name.trim().slice(0,80):"";
  const description=typeof input.description==="string"?input.description.trim().slice(0,500):"";
  const category=typeof input.category==="string"?input.category.trim().slice(0,60)||"general":"general";
  const method=String(input.method||"GET").toUpperCase();
  const creditCost=Number(input.credit_cost);
  const endpoint=new URL(String(input.endpoint_url||""));
  if(!name||endpoint.protocol!=="https:"||endpoint.username||endpoint.password||!["GET","POST","PUT","PATCH","DELETE"].includes(method)||!Number.isSafeInteger(creditCost)||creditCost<0||creditCost>100000)throw new Error("Enter a name, valid HTTPS endpoint, method and non-negative credit cost.");
  return {name,description,category,method,credit_cost:creditCost,endpoint_url:endpoint.toString(),is_active:Boolean(input.is_active)};
}
export async function GET(){
  const ctx=await adminClient();if("response" in ctx)return ctx.response;
  const {data,error}=await ctx.client.from("tool_catalog").select("*").order("created_at",{ascending:false});
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({tools:data||[]});
}
export async function POST(request:Request){
  const ctx=await adminClient();if("response" in ctx)return ctx.response;
  try{
    const values=validate(await request.json());
    const {data,error}=await ctx.client.from("tool_catalog").insert({...values,created_by:ctx.actorId}).select("*").single();
    if(error)throw error;
    await ctx.client.from("audit_logs").insert({actor_id:ctx.actorId,action:"admin.tool.created",target_id:data.id,details:{name:data.name}});
    return NextResponse.json({tool:data},{status:201});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid tool details."},{status:400});}
}
export async function PATCH(request:Request){
  const ctx=await adminClient();if("response" in ctx)return ctx.response;
  try{
    const body=await request.json();const id=typeof body.id==="string"?body.id:"";
    if(!id)return NextResponse.json({error:"Tool id required."},{status:400});
    const values=validate(body);
    const {data,error}=await ctx.client.from("tool_catalog").update({...values,updated_at:new Date().toISOString()}).eq("id",id).select("*").single();
    if(error)throw error;
    await ctx.client.from("audit_logs").insert({actor_id:ctx.actorId,action:"admin.tool.updated",target_id:id,details:{name:data.name}});
    return NextResponse.json({tool:data});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid tool details."},{status:400});}
}
export async function DELETE(request:Request){
  const ctx=await adminClient();if("response" in ctx)return ctx.response;
  const id=new URL(request.url).searchParams.get("id");
  if(!id)return NextResponse.json({error:"Tool id required."},{status:400});
  const {error}=await ctx.client.from("tool_catalog").delete().eq("id",id);
  if(error)return NextResponse.json({error:error.message},{status:500});
  await ctx.client.from("audit_logs").insert({actor_id:ctx.actorId,action:"admin.tool.deleted",target_id:id,details:{}});
  return NextResponse.json({ok:true});
}
