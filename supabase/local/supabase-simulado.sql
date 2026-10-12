-- KORbuild — o mínimo do Supabase para testar as migrações num Postgres local (tools/banco-local.sh).
-- Papéis anon/authenticated/service_role, auth.users e auth.uid() como no Supabase, pgcrypto no schema extensions
-- e as permissões padrão do public (toda tabela nova já nasce liberada para anon e authenticated: quem protege é o RLS).
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions; create extension pgcrypto with schema extensions; create extension "uuid-ossp" with schema extensions;
alter database postgres set search_path to public, extensions;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', aud text, role text, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
grant select on auth.users to service_role;
-- como no Supabase: toda tabela/função nova do public já nasce liberada para anon e authenticated (o RLS é quem protege)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- Storage (o mínimo para testar as políticas das fotos): buckets, objects com RLS e storage.foldername()
create schema storage;
create table storage.buckets (id text primary key, name text not null, owner uuid, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text, owner uuid default auth.uid(), metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (bucket_id, name));
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated;
