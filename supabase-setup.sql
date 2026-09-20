-- شغّل هذا الملف مرة واحدة داخل Supabase > SQL Editor.
create table if not exists public.app_state (
  id text primary key,
  rev bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "teachers can read app state" on public.app_state;
create policy "teachers can read app state" on public.app_state for select to anon, authenticated using (true);
drop policy if exists "teachers can create app state" on public.app_state;
create policy "teachers can create app state" on public.app_state for insert to anon, authenticated with check (true);
drop policy if exists "teachers can update app state" on public.app_state;
create policy "teachers can update app state" on public.app_state for update to anon, authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public student photos" on storage.objects;
create policy "public student photos" on storage.objects for select to public using (bucket_id = 'student-photos');
drop policy if exists "teachers upload student photos" on storage.objects;
create policy "teachers upload student photos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'student-photos');
drop policy if exists "teachers update student photos" on storage.objects;
create policy "teachers update student photos" on storage.objects for update to anon, authenticated using (bucket_id = 'student-photos') with check (bucket_id = 'student-photos');
