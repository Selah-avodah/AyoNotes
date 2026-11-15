-- ============================================================
-- Jar of Notes: run this once in Supabase → SQL Editor → New query
-- ============================================================

-- 1. Table for notes
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  from_name   text not null check (char_length(btrim(from_name)) between 1 and 60),
  message     text check (char_length(message) <= 2000),
  image_path  text check (image_path ~ '^[a-z0-9-]+\.(jpg|png|webp|gif)$'),
  approved    boolean not null default true,
  constraint note_has_content check (message is not null or image_path is not null)
);

alter table public.notes enable row level security;

-- Visitors may read approved notes and add new ones,
-- but can't edit, delete, or approve anything.
revoke all on public.notes from anon, authenticated;
grant usage on schema public to anon;
grant select on public.notes to anon;
grant insert (from_name, message, image_path) on public.notes to anon;

drop policy if exists "Read approved notes" on public.notes;
create policy "Read approved notes" on public.notes
  for select to anon using (approved);

drop policy if exists "Anyone can add a note" on public.notes;
create policy "Anyone can add a note" on public.notes
  for insert to anon with check (true);

-- 2. Public storage bucket for photos (max 5 MB, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-images', 'note-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "Anyone can upload note images" on storage.objects;
create policy "Anyone can upload note images" on storage.objects
  for insert to anon
  with check (bucket_id = 'note-images' and name ~ '^[a-z0-9-]+\.(jpg|png|webp|gif)$');


-- ============================================================
-- OPTIONAL: approve notes before they appear
-- Run the line below, then set requireApproval: true in notes.js.
-- New notes will wait until you tick "approved" in Table Editor → notes.
-- ============================================================
-- alter table public.notes alter column approved set default false;
