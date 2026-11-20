import { NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  S3Client, HeadBucketCommand, ListObjectsV2Command, HeadObjectCommand,
  PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand, DeleteObjectsCommand
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
const BACKUP_ROOT = "__cyberx_backups";
const MAX_BACKUP_FILES = 100;
const MAX_BACKUPS_SHOWN = 20;

type SavedConfig = { account_id?: string; bucket?: string };
type R2Credentials = { accessKeyId: string; secretAccessKey: string };
type BackupItem = { sourceKey: string; backupKey: string; name: string; size: number; contentType: string; lastModified: string | null };
type BackupManifest = { version: 1; id: string; createdAt: string; fileCount: number; totalBytes: number; items: BackupItem[] };

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

async function saved(ctx: { user: { id: string }; service: SupabaseClient }) {
  const { data, error } = await ctx.service.from("integration_connections")
    .select("id,status,account_label,public_config,secret_ciphertext")
    .eq("owner_id", ctx.user.id).eq("provider", PROVIDER).eq("label", LABEL).maybeSingle();
  if (error) throw error;
  const row = data as unknown as { id: string; status: string; account_label: string | null; public_config: SavedConfig | null; secret_ciphertext: string | null } | null;
  if (!row || row.status !== "connected" || !row.secret_ciphertext) return null;
  const config = row.public_config || {};
  if (!/^[a-f0-9]{32}$/i.test(config.account_id || "") || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket || "")) {
    throw new Error("Saved R2 account or bucket configuration is invalid. Reconnect R2.");
  }
  const credentials = JSON.parse(decryptIntegrationSecret(row.secret_ciphertext)) as R2Credentials;
  if (!credentials.accessKeyId || !credentials.secretAccessKey) throw new Error("Saved R2 credentials are invalid. Reconnect R2.");
  const client = new S3Client({
    region: "auto",
    endpoint: "https://" + config.account_id + ".r2.cloudflarestorage.com",
    credentials
  });
  return { id: row.id, accountLabel: row.account_label, bucket: config.bucket!, client };
}

function safeName(input: string) {
  return input.normalize("NFKC").split(/[\\/]/).pop()!.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+|\.{2,}/g, "_").slice(0, 120) || "upload.bin";
}
function ownedKey(key: string, userId: string) {
  return key.startsWith(userId + "/") && !key.includes("..") && key.length <= 220;
}
function backupPrefix(userId: string, backupId: string) {
  return userId + "/" + BACKUP_ROOT + "/" + backupId + "/";
}
function validBackupId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function copySource(bucket: string, key: string) {
  return encodeURIComponent(bucket + "/" + key).replace(/%2F/gi, "/");
}
async function listAll(client: S3Client, bucket: string, prefix: string, cap: number) {
  const objects: Array<{ Key: string; Size?: number; LastModified?: Date; ETag?: string }> = [];
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000, ContinuationToken: token }));
    for (const item of page.Contents || []) if (item.Key) objects.push({ Key: item.Key, Size: item.Size, LastModified: item.LastModified, ETag: item.ETag });
    if (objects.length > cap) throw new Error("This operation is limited to " + cap + " objects. Please split the backup into smaller sets.");
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects;
}
async function readManifest(client: S3Client, bucket: string, userId: string, backupId: string): Promise<BackupManifest> {
  const prefix = backupPrefix(userId, backupId);
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: prefix + "manifest.json" }));
  if (!object.Body) throw new Error("Backup manifest is empty or unavailable.");
  const parsed = JSON.parse(await object.Body.transformToString()) as BackupManifest;
  if (parsed.version !== 1 || parsed.id !== backupId || !Array.isArray(parsed.items) || parsed.items.length > MAX_BACKUP_FILES) {
    throw new Error("Backup manifest is invalid.");
  }
  for (const item of parsed.items) {
    if (!ownedKey(item.sourceKey, userId) || item.sourceKey.startsWith(userId + "/" + BACKUP_ROOT + "/") ||
      !item.backupKey.startsWith(prefix + "objects/") || item.backupKey.includes("..")) {
      throw new Error("Backup contains an invalid object reference.");
    }
  }
  return parsed;
}
async function deletePrefix(client: S3Client, bucket: string, prefix: string) {
  const objects = await listAll(client, bucket, prefix, 1100);
  if (!objects.length) return 0;
  await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects.map(item => ({ Key: item.Key })), Quiet: true } }));
  return objects.length;
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
    if (!connection) return NextResponse.json({ connected: false, files: [], backups: [] });
    const url = new URL(request.url);
    const downloadKey = url.searchParams.get("download");
    if (downloadKey) {
      if (!ownedKey(downloadKey, ctx.user.id) || downloadKey.startsWith(ctx.user.id + "/" + BACKUP_ROOT + "/")) {
        return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
      }
      const signedUrl = await getSignedUrl(connection.client, new GetObjectCommand({ Bucket: connection.bucket, Key: downloadKey }), { expiresIn: 60 });
      return NextResponse.json({ url: signedUrl, expiresIn: 60 }, { headers: { "Cache-Control": "no-store" } });
    }
    if (url.searchParams.get("backups") === "1") {
      const objects = await listAll(connection.client, connection.bucket, ctx.user.id + "/" + BACKUP_ROOT + "/", 1000);
      const manifests = objects.filter(item => item.Key.endsWith("/manifest.json")).slice(-MAX_BACKUPS_SHOWN).reverse();
      const backups = await Promise.all(manifests.map(async item => {
        try {
          const backupId = item.Key.split("/")[2];
          const manifest = await readManifest(connection.client, connection.bucket, ctx.user.id, backupId);
          return { id: manifest.id, createdAt: manifest.createdAt, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes };
        } catch { return null; }
      }));
      return NextResponse.json({ backups: backups.filter(Boolean) }, { headers: { "Cache-Control": "no-store" } });
    }
    const result = await connection.client.send(new ListObjectsV2Command({
      Bucket: connection.bucket, Prefix: ctx.user.id + "/", MaxKeys: 100
    }));
    const files = (result.Contents || []).filter(item => item.Key && item.Key !== ctx.user.id + "/" && !item.Key.startsWith(ctx.user.id + "/" + BACKUP_ROOT + "/")).map(item => ({
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
      if (!ownedKey(key, ctx.user.id) || key.startsWith(ctx.user.id + "/" + BACKUP_ROOT + "/")) return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
      const head = await connection.client.send(new HeadObjectCommand({ Bucket: connection.bucket, Key: key }));
      if (!head.ContentLength || head.ContentLength > MAX_BYTES) {
        await connection.client.send(new DeleteObjectCommand({ Bucket: connection.bucket, Key: key }));
        return NextResponse.json({ error: "Uploaded object exceeded the 25 MB limit and was removed." }, { status: 413 });
      }
      return NextResponse.json({ ok: true, size: head.ContentLength, contentType: head.ContentType || "application/octet-stream" });
    }
    if (body.action === "create-backup") {
      const connection = await saved(ctx);
      if (!connection) return NextResponse.json({ error: "Connect your R2 bucket first." }, { status: 409 });
      const userPrefix = ctx.user.id + "/";
      const objects = await listAll(connection.client, connection.bucket, userPrefix, 2000);
      const sources = objects.filter(item => !item.Key.startsWith(userPrefix + BACKUP_ROOT + "/"));
      if (sources.length > MAX_BACKUP_FILES) return NextResponse.json({ error: "A snapshot can contain up to 100 files. Remove or split files and try again." }, { status: 413 });
      const id = crypto.randomUUID();
      const prefix = backupPrefix(ctx.user.id, id);
      const items: BackupItem[] = [];
      try {
        for (const source of sources) {
          const head = await connection.client.send(new HeadObjectCommand({ Bucket: connection.bucket, Key: source.Key }));
          const name = safeName(source.Key.slice(source.Key.lastIndexOf("/") + 1).replace(/^[a-f0-9-]{36}-/, ""));
          const backupKey = prefix + "objects/" + crypto.randomUUID() + "-" + name;
          await connection.client.send(new CopyObjectCommand({
            Bucket: connection.bucket, Key: backupKey, CopySource: copySource(connection.bucket, source.Key),
            MetadataDirective: "COPY"
          }));
          items.push({
            sourceKey: source.Key, backupKey, name, size: head.ContentLength || source.Size || 0,
            contentType: head.ContentType || "application/octet-stream",
            lastModified: head.LastModified?.toISOString() || source.LastModified?.toISOString() || null
          });
        }
        const manifest: BackupManifest = {
          version: 1, id, createdAt: new Date().toISOString(),
          fileCount: items.length, totalBytes: items.reduce((sum, item) => sum + item.size, 0), items
        };
        await connection.client.send(new PutObjectCommand({
          Bucket: connection.bucket, Key: prefix + "manifest.json",
          Body: JSON.stringify(manifest), ContentType: "application/json", CacheControl: "no-store"
        }));
        return NextResponse.json({ ok: true, backup: { id, createdAt: manifest.createdAt, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes } }, { status: 201 });
      } catch (error) {
        await deletePrefix(connection.client, connection.bucket, prefix).catch(() => undefined);
        throw error;
      }
    }
    if (body.action === "restore-backup") {
      const connection = await saved(ctx);
      if (!connection) return NextResponse.json({ error: "Connect your R2 bucket first." }, { status: 409 });
      if (!validBackupId(body.backupId)) return NextResponse.json({ error: "Invalid backup ID." }, { status: 400 });
      const manifest = await readManifest(connection.client, connection.bucket, ctx.user.id, body.backupId);
      const restored: string[] = [];
      for (const item of manifest.items) {
        const target = ctx.user.id + "/" + crypto.randomUUID() + "-" + safeName(item.name);
        await connection.client.send(new CopyObjectCommand({
          Bucket: connection.bucket, Key: target, CopySource: copySource(connection.bucket, item.backupKey),
          MetadataDirective: "COPY"
        }));
        restored.push(target);
      }
      return NextResponse.json({ ok: true, restoredCount: restored.length, note: "Restored copies were created. Existing files were not overwritten." });
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
    const connection = await saved(ctx);
    if (!connection) return NextResponse.json({ error: "Connect your R2 bucket first." }, { status: 409 });
    const backupId = url.searchParams.get("backupId");
    if (backupId) {
      if (!validBackupId(backupId)) return NextResponse.json({ error: "Invalid backup ID." }, { status: 400 });
      await readManifest(connection.client, connection.bucket, ctx.user.id, backupId);
      const removed = await deletePrefix(connection.client, connection.bucket, backupPrefix(ctx.user.id, backupId));
      return NextResponse.json({ ok: true, removedObjects: removed });
    }
    const key = url.searchParams.get("key") || "";
    if (!ownedKey(key, ctx.user.id) || key.startsWith(ctx.user.id + "/" + BACKUP_ROOT + "/")) return NextResponse.json({ error: "Invalid file path." }, { status: 403 });
    await connection.client.send(new DeleteObjectCommand({ Bucket: connection.bucket, Key: key }));
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
