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
