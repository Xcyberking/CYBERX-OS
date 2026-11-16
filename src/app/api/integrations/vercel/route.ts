import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { encryptIntegrationSecret,decryptIntegrationSecret } from "@/lib/integrations/crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function context(){
 const auth=await createClient();const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return {response:NextResponse.json({error:"Sign in required."},{status:401})};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return {response:NextResponse.json({error:"Server admin configuration is missing."},{status:503})};
 return {user,service:createServiceClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})};
}
export async function POST(request:Request){
 const ctx=await context();if("response" in ctx)return ctx.response;
 try{
  const body=await request.json();const token=typeof body.token==="string"?body.token.trim():"";
  if(token.length<10||token.length>5000)return NextResponse.json({error:"Enter a valid Vercel access token."},{status:400});
  const verify=await fetch("https://api.vercel.com/v2/user",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
  const identity=await verify.json() as {user?:{username?:string;name?:string};error?:{message?:string}};
  if(!verify.ok||!identity.user)return NextResponse.json({error:identity.error?.message||"Vercel rejected this token."},{status:401});
  const {error}=await ctx.service.from("integration_connections").upsert({
   owner_id:ctx.user.id,provider:"vercel",label:"vercel",status:"connected",
   account_label:identity.user.username||identity.user.name||"Vercel account",
   public_config:{access:"read-only-projects-and-deployments"},
   secret_ciphertext:encryptIntegrationSecret(token),last_checked_at:new Date().toISOString()
  },{onConflict:"owner_id,provider,label"});
  if(error)throw error;
  return NextResponse.json({ok:true,account:identity.user.username||identity.user.name||"Vercel account"});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not connect Vercel."},{status:500});}
}
export async function GET(){
 const ctx=await context();if("response" in ctx)return ctx.response;
 try{
  const {data:connection,error}=await ctx.service.from("integration_connections").select("status,secret_ciphertext,account_label").eq("owner_id",ctx.user.id).eq("provider","vercel").eq("label","vercel").maybeSingle();
  if(error)throw error;
  if(!connection||connection.status!=="connected"||!connection.secret_ciphertext)return NextResponse.json({error:"Connect Vercel first."},{status:409});
  const token=decryptIntegrationSecret(connection.secret_ciphertext);
  const headers={Authorization:"Bearer "+token};
  const response=await fetch("https://api.vercel.com/v9/projects?limit=30",{headers,cache:"no-store"});
  const data=await response.json() as {projects?:Array<{id:string;name:string;framework:string|null}>;error?:{message?:string}};
  if(!response.ok){
   if(response.status===401)await ctx.service.from("integration_connections").update({status:"error"}).eq("owner_id",ctx.user.id).eq("provider","vercel").eq("label","vercel");
   return NextResponse.json({error:data.error?.message||"Vercel API request failed. Reconnect the token."},{status:response.status===401?401:502});
  }
  const projects=(data.projects||[]).slice(0,30);
  const results=await Promise.all(projects.map(async p=>{
   const r=await fetch("https://api.vercel.com/v6/deployments?projectId="+encodeURIComponent(p.id)+"&limit=3",{headers,cache:"no-store"});
   if(!r.ok)return {...p,latestDeployments:[]};
   const d=await r.json() as {deployments?:Array<{uid:string;url:string;state:string;createdAt:number;target:string|null}>};
   return {...p,latestDeployments:(d.deployments||[]).map(x=>({uid:x.uid,url:x.url,state:x.state,createdAt:x.createdAt,target:x.target}))};
  }));
  await ctx.service.from("integration_connections").update({last_checked_at:new Date().toISOString(),status:"connected"}).eq("owner_id",ctx.user.id).eq("provider","vercel").eq("label","vercel");
  return NextResponse.json({account:connection.account_label,projects:results},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not load Vercel projects."},{status:500});}
}
