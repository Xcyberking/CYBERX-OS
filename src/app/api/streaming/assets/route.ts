import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function GET() {
 const supabase=await createClient();const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data,error}=await supabase.from("video_assets").select("id,title,description,category,storage_provider,storage_key,visibility,created_at").eq("owner_id",user.id).order("created_at",{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({assets:data||[]});
}
export async function POST(request:Request){
 const supabase=await createClient();const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
 let input:Record<string,unknown>;try{input=await request.json();}catch{return NextResponse.json({error:"Invalid JSON."},{status:400});}
 const title=typeof input.title==="string"?input.title.trim():"";const description=typeof input.description==="string"?input.description.trim():"";const category=typeof input.category==="string"?input.category.trim():"General";const visibility=input.visibility==="public"||input.visibility==="unlisted"?input.visibility:"private";
 if(title.length<2||title.length>120)return NextResponse.json({error:"Title must be 2–120 characters."},{status:400});
 if(description.length>2000||category.length>60)return NextResponse.json({error:"Description or category is too long."},{status:400});
 const {data,error}=await supabase.from("video_assets").insert({owner_id:user.id,title,description,category,visibility}).select("id,title,description,category,storage_provider,storage_key,visibility,created_at").single();
 if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({asset:data},{status:201});
}
export async function DELETE(request:Request){
 const supabase=await createClient();const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const id=new URL(request.url).searchParams.get("id");if(!id)return NextResponse.json({error:"Asset id is required."},{status:400});
 const {error}=await supabase.from("video_assets").delete().eq("id",id).eq("owner_id",user.id);
 if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true});
}
