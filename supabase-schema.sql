-- Supabase schema for BudgetApp
-- Run this SQL in your Supabase SQL Editor.
-- Notes:
-- - The app code expects `transactions.merchant` and `transactions.card_last4` (not `merchant_name` / `card_number`).
-- - These statements are written to be safe to run multiple times.

-- Enable UUID generation (usually already enabled in Supabase projects)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- transactions (app expects these columns)
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  amount numeric(10,2) not null,
  merchant text not null,
  category text not null,
  manual_category_override boolean not null default false,
  card_last4 text null,
  include_in_insights boolean not null default true,
  raw_text text null
);

create index if not exists idx_transactions_created_at on public.transactions(created_at);
create index if not exists idx_transactions_merchant on public.transactions(merchant);
create index if not exists idx_transactions_category on public.transactions(category);

-- If you previously created different column names, add the expected ones.
alter table public.transactions add column if not exists merchant text;
alter table public.transactions add column if not exists card_last4 text;
alter table public.transactions add column if not exists raw_text text;
alter table public.transactions add column if not exists manual_category_override boolean not null default false;

-- ---------------------------------------------------------------------------
-- categories: configurable icon/color/name
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon_key text not null,
  color_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_name on public.categories(name);

-- ---------------------------------------------------------------------------
-- merchant_settings: merchant -> category mapping + optional image
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_settings (
  merchant text primary key,
  category_name text not null,
  image_url text null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_merchant_settings_category on public.merchant_settings(category_name);

-- ---------------------------------------------------------------------------
-- Storage: merchant-images bucket + permissive policies (no auth in app)
-- ---------------------------------------------------------------------------
-- Bucket creation (id must be unique)
insert into storage.buckets (id, name, public)
values ('merchant-images', 'merchant-images', true)
on conflict (id) do nothing;

-- Ensure RLS is enabled for storage objects (Supabase defaults may already do this)
alter table storage.objects enable row level security;

-- Allow public read of merchant images
drop policy if exists "merchant_images_public_read" on storage.objects;
create policy "merchant_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'merchant-images');

-- Allow anon/authenticated uploads into the merchant-images bucket
drop policy if exists "merchant_images_public_insert" on storage.objects;
create policy "merchant_images_public_insert"
on storage.objects
for insert
to public
with check (bucket_id = 'merchant-images');

-- Allow overwriting/updating objects in the bucket (needed for upsert uploads)
drop policy if exists "merchant_images_public_update" on storage.objects;
create policy "merchant_images_public_update"
on storage.objects
for update
to public
using (bucket_id = 'merchant-images')
with check (bucket_id = 'merchant-images');

-- Optional: allow deletes (handy for cleanup)
drop policy if exists "merchant_images_public_delete" on storage.objects;
create policy "merchant_images_public_delete"
on storage.objects
for delete
to public
using (bucket_id = 'merchant-images');
