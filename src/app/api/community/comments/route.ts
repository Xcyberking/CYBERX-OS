import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const postId=new URL(request.url).searchParams.get("post_id");
 if(!postId)return NextResponse.json({error:"Post id required."},{status:400});
 const {data,error}=await supabase.from("community_comments").select("id,post_id,author_id,body,created_at").eq("post_id",postId).order("created_at",{ascending:true}).limit(100);
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({comments:data||[]});
}
export async function POST(request:Request) {
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const body=await request.json().catch(()=>null);
 const postId=body&&typeof body.post_id==="string"?body.post_id:"";
 const text=body&&typeof body.body==="string"?body.body.trim():"";
 if(!postId||text.length<1||text.length>2000)return NextResponse.json({error:"Post and comment (1–2000 chars) required."},{status:400});
 const {data,error}=await supabase.from("community_comments").insert({post_id:postId,author_id:user.id,body:text}).select("id,post_id,author_id,body,created_at").single();
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({comment:data},{status:201});
}
