-- CYBERX OS private cloud file bucket.
-- Apply after 0004_tighten_privileged_data.sql.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cyberx-files', 'cyberx-files', false, 26214400, null)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "cyberx_files_read_own" on storage.objects;
drop policy if exists "cyberx_files_upload_own" on storage.objects;
drop policy if exists "cyberx_files_delete_own" on storage.objects;

create policy "cyberx_files_read_own" on storage.objects
for select to authenticated
using (bucket_id = 'cyberx-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "cyberx_files_upload_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'cyberx-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "cyberx_files_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'cyberx-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
