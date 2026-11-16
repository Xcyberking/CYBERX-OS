import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const BUCKET = "cyberx-files";
const MAX_BYTES = 25 * 1024 * 1024;

async function getUserClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase: null, user: null };
  return { supabase, user };
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getUserClient();
    if (!supabase || !user) return NextResponse.json({ error: "Sign in to access your files." }, { status: 401 });
    const url = new URL(request.url);
    const download = url.searchParams.get("download");
    if (download) {
      if (!download.startsWith(user.id + "/") || download.includes("..")) return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(download, 60);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ url: data.signedUrl, expiresIn: 60 });
    }
    const { data, error } = await supabase.storage.from(BUCKET).list(user.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const files = (data || []).filter(item => item.name && item.id).map(item => ({
      name: item.name,
      path: user.id + "/" + item.name,
      size: item.metadata?.size ?? 0,
      contentType: item.metadata?.mimetype ?? "application/octet-stream",
      createdAt: item.created_at
    }));
    return NextResponse.json({ files, limit: 100 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Storage is unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getUserClient();
    if (!supabase || !user) return NextResponse.json({ error: "Sign in to upload files." }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "File size must be between 1 byte and 25 MB." }, { status: 413 });
    const safeName = file.name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".").slice(0, 120) || "upload.bin";
    const path = user.id + "/" + crypto.randomUUID() + "-" + safeName;
    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ file: { name: safeName, path: data.path, size: file.size, contentType: file.type || "application/octet-stream" } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await getUserClient();
    if (!supabase || !user) return NextResponse.json({ error: "Sign in to delete files." }, { status: 401 });
    const path = new URL(request.url).searchParams.get("path");
    if (!path || !path.startsWith(user.id + "/") || path.includes("..")) return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed." }, { status: 500 });
  }
}
