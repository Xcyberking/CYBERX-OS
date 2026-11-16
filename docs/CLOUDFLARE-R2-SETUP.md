# Cloudflare R2 Storage Setup

CYBERX OS connects to one R2 bucket using S3-compatible credentials. The credentials are encrypted in `integration_connections` with the existing `INTEGRATION_ENCRYPTION_KEY`; they are never returned to the browser.

## Create a bucket and token

1. In Cloudflare Dashboard, open **R2 Object Storage** and create or choose a bucket.
2. Open **Manage R2 API Tokens** and create an S3 API token with **Object Read & Write** permissions.
3. Restrict the token to the single bucket you intend to connect.
4. Copy the Access Key ID, Secret Access Key and the account ID. The secret is shown only once.
5. In CYBERX OS open **Cloud Storage → Cloudflare R2 Storage**, enter those four values and connect. CYBERX verifies the credentials by checking the bucket before saving them.

Use R2 S3 credentials here. They are different from the Cloudflare REST API token used for read-only bucket inventory in Developer Hub.

## Bucket CORS for browser uploads

The upload flow uses short-lived, object-specific presigned PUT URLs so the secret credentials never reach the browser. Configure the bucket CORS policy with your exact deployed site origin (replace the example origin):

```json
[
  {
    "AllowedOrigins": ["https://YOUR_DOMAIN"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Do not use `*` for a bucket that stores private user files. Add `http://localhost:3000` only while testing locally, then remove it from production if it is not needed.

## What is enabled

- Private per-user object prefixes: `<supabase-user-id>/<random-id>-<filename>`.
- List up to 100 objects for the signed-in user.
- Direct browser uploads up to 25 MB, verified by a server-side HEAD request.
- Temporary download links valid for 60 seconds.
- Delete only objects under the signed-in user's prefix.
- Disconnecting removes the encrypted connection record only. It does not delete the bucket or any objects.

No new environment variables or SQL migrations are required. Existing Supabase server credentials and `INTEGRATION_ENCRYPTION_KEY` must already be configured. The existing Supabase Storage bucket and files are not changed.
