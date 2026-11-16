import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  S3Client, HeadBucketCommand, ListObjectsV2Command, HeadObjectCommand,
  PutObjectCommand, DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PROVIDER = "cloudflare";
const LABEL = "r2-storage";
const MAX_BYTES = 25 * 1024 * 1024;
const URL_TTL = 300;

type SavedConfig = { account_id?: string; bucket?: string };
type R2Credentials = { accessKeyId: string; secretAccessKey: string };

async function context() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { response: NextResponse.json({ error: "Server admin configuration is missing." }, { status: 503 }) };
  const service = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return { user, service };
}

async function saved(ctx: { user: { id: string }; service: ReturnType<typeof createServiceClient> }) {
  const { data, error } = await ctx.service.from("integration_connections")
    .select("id,status,account_label,public_config,secret_ciphertext")
    .eq("owner_id", ctx.user.id).eq("provider", PROVIDER).eq("label", LABEL).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "connected" || !data.secret_ciphertext) return null;
  const config = (data.public_config || {}) as SavedConfig;
  if (!/^[a-f0-9]{32}$/i.test(config.account_id || "") || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket || "")) {
    throw new Error("Saved R2 account or bucket configuration is invalid. Reconnect R2.");
  }
  const credentials = JSON.parse(decryptIntegrationSecret(data.secret_ciphertext)) as R2Credentials;
  if (!credentials.accessKeyId || !credentials.secretAccessKey) throw new Error("Saved R2 credentials are invalid. Reconnect R2.");
  const client = new S3Client({
    region: "auto",
    endpoint: "https://" + config.account_id + ".r2.cloudflarestorage.com",
    credentials
  });
  return { id: data.id as string, accountLabel: data.account_label as string | null, bucket: config.bucket, client };
}

function safeName(input: string) {
  return input.normalize("NFKC").split(/[\\/]/).pop()!.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+|\.{2,}/g, "_").slice(0, 120) || "upload.bin";
}
function ownedKey(key: string, userId: string) {
  return key.startsWith(userId + "/") && !key.includes("..") && key.length <= 220;
}
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "R2 storage request failed.";
  const status = /NoSuchBucket|NotFound|NoSuchKey/i.test(message) ? 404 : /AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch|Forbidden/i.test(message) ? 403 : 502;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const connection = await saved(ctx);
    if (!connection) return NextResponse.json({ connected: false, files: [] });
    const url = new URL(request.url);
    const downloadKey = url.searchParams.get("download");
    if (downloadKey) {
      if (!ownedKey(downloadKey, ctx.user.id)) return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
      const signedUrl = await getSignedUrl(connection.client, new (await import("@aws-sdk/client-s3")).GetObjectCommand({
        Bucket: connection.bucket, Key: downloadKey
      }), { expiresIn: 60 });
      return NextResponse.json({ url: signedUrl, expiresIn: 60 }, { headers: { "Cache-Control": "no-store" } });
    }
    const result = await connection.client.send(new ListObjectsV2Command({
      Bucket: connection.bucket, Prefix: ctx.user.id + "/", MaxKeys: 100
    }));
    const files = (result.Contents || []).filter(item => item.Key && item.Key !== ctx.user.id + "/").map(item => ({
      key: item.Key!,
      name: item.Key!.slice(item.Key!.lastIndexOf("/") + 1).replace(/^[a-f0-9-]{36}-/, ""),
      size: item.Size || 0,
      lastModified: item.LastModified?.toISOString() || null
    }));
    return NextResponse.json({ connected: true, account: connection.accountLabel, bucket: connection.bucket, files, limit: 100 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "connect") {
      const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
      const bucket = typeof body.bucket === "string" ? body.bucket.trim().toLowerCase() : "";
      const accessKeyId = typeof body.accessKeyId === "string" ? body.accessKeyId.trim() : "";
      const secretAccessKey = typeof body.secretAccessKey === "string" ? body.secretAccessKey.trim() : "";
      if (!/^[a-f0-9]{32}$/i.test(accountId)) return NextResponse.json({ error: "Account ID must be 32 hexadecimal characters." }, { status: 400 });
      if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || bucket.includes("..")) return NextResponse.json({ error: "Enter a valid R2 bucket name." }, { status: 400 });
      if (accessKeyId.length < 8 || accessKeyId.length > 256 || secretAccessKey.length < 16 || secretAccessKey.length > 512) return NextResponse.json({ error: "Enter a valid R2 Access Key ID and Secret Access Key." }, { status: 400 });
      const client = new S3Client({ region: "auto", endpoint: "https://" + accountId + ".r2.cloudflarestorage.com", credentials: { accessKeyId, secretAccessKey } });
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      const { error } = await ctx.service.from("integration_connections").upsert({
        owner_id: ctx.user.id, provider: PROVIDER, label: LABEL, status: "connected",
        account_label: bucket,
        public_config: { account_id: accountId, bucket, access: "user-prefix-object-management" },
        secret_ciphertext: encryptIntegrationSecret(JSON.stringify({ accessKeyId, secretAccessKey })),
        last_checked_at: new Date().toISOString()
      }, { onConflict: "owner_id,provider,label" });
      if (error) throw error;
      return NextResponse.json({ ok: true, bucket });
    }
    if (body.action === "presign-upload") {
      const connection = await saved(ctx);
      if (!connection) return NextResponse.json({ error: "Connect your R2 bucket first." }, { status: 409 });
      const fileName = typeof body.fileName === "string" ? safeName(body.fileName) : "upload.bin";
      const contentType = typeof body.contentType === "string" && body.contentType.length <= 150 ? body.contentType : "application/octet-stream";
      const size = Number(body.size);
      if (!Number.isFinite(size) || size < 1 || size > MAX_BYTES) return NextResponse.json({ error: "File size must be between 1 byte and 25 MB." }, { status: 413 });
      const key = ctx.user.id + "/" + crypto.randomUUID() + "-" + fileName;
      const command = new PutObjectCommand({ Bucket: connection.bucket, Key: key, ContentType: contentType });
      const uploadUrl = await getSignedUrl(connection.client, command, { expiresIn: URL_TTL });
      return NextResponse.json({ uploadUrl, key, contentType, expiresIn: URL_TTL }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "confirm-upload") {
      const connection = await saved(ctx);
      const key = typeof body.key === "string" ? body.key : "";
      if (!connection) return NextResponse.json({ error: "Connect your R2 bucket first." }, { status: 409 });
      if (!ownedKey(key, ctx.user.id)) return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
      const head = await connection.client.send(new HeadObjectCommand({ Bucket: connection.bucket, Key: key }));
      if (!head.ContentLength || head.ContentLength > MAX_BYTES) {
        await connection.client.send(new DeleteObjectCommand({ Bucket: connection.bucket, Key: key }));
        return NextResponse.json({ error: "Uploaded object exceeded the 25 MB limit and was removed." }, { status: 413 });
      }
      return NextResponse.json({ ok: true, size: head.ContentLength, contentType: head.ContentType || "application/octet-stream" });
    }
    return NextResponse.json({ error: "Unsupported R2 action." }, { status: 400 });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("disconnect") === "1") {
      const { error } = await ctx.service.from("integration_connections").delete()
        .eq("owner_id", ctx.user.id).eq("provider", PROVIDER).eq("label", LABEL);
      if (error) throw error;
      return NextResponse.json({ ok: true, note: "Connection removed. R2 bucket and its objects were not deleted." });
    }
    const key = url.searchParams.get("key") || "";
    if (!ownedKey(key, ctx.user.id)) return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
    const connection = await saved(ctx);
    if (!connection) return NextResponse.json({ error: "Connect your R2 bucket first." }, { status: 409 });
    await connection.client.send(new DeleteObjectCommand({ Bucket: connection.bucket, Key: key }));
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
