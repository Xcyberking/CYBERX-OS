# R2 Backup and Restore

CYBERX OS stores manual snapshots in a private per-user prefix in the same R2 bucket:

`<user-id>/__cyberx_backups/<snapshot-id>/`

Each snapshot contains copies of the user's current R2 objects and a JSON manifest. The snapshot process is server-side and uses the existing encrypted R2 connection.

## Current limits

- Up to 100 user files per snapshot.
- Each normal upload is limited to 25 MB.
- The UI lists the latest 20 snapshots.
- Restore creates new copies; it does not overwrite or delete current files.
- Deleting a snapshot removes only that snapshot's objects.
- Disconnecting R2 does not remove files or snapshots.
- No SQL migration or additional environment variable is required.

## Important recovery limitation

Snapshots are stored in the same R2 bucket as the source files. They help recover from accidental file deletion or replacement, but they are not protection against loss or deletion of the entire bucket/account. For disaster recovery, configure a second independent bucket/account or another storage provider. Scheduled snapshots and cross-provider restore are future work.

The API verifies the signed-in user's ownership prefix for every operation and validates manifest object paths before restore.
