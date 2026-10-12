-- KORbuild · estrutura do banco Supabase gbdmtgephszxhaprpiss em 2026-10-12 (sem dados)
-- Gerado por tools/supabase-estrutura.mjs a partir dos catálogos do Postgres. Schemas do Supabase (auth, storage…) ficam de fora.


-- Extensões
create extension if not exists "pg_cron";
create extension if not exists "pg_net";
create extension if not exists "pg_stat_statements";
create extension if not exists "pgcrypto";
create extension if not exists "plpgsql";
create extension if not exists "supabase_vault";
create extension if not exists "uuid-ossp";

-- Tipos (enum)

-- Sequências

-- Tabelas
create table "public"."auditoria" (
  "id" bigint generated ALWAYS as identity not null,
  "quem" uuid,
  "tabela" text not null,
  "registro" uuid not null,
  "acao" text not null,
  "antes" jsonb,
  "depois" jsonb,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."contatos" (
  "user_id" uuid not null,
  "canal" text default 'whatsapp'::text not null,
  "telefone" text,
  "email" text
);
create table "public"."notificacao_prefs" (
  "user_id" uuid not null,
  "categoria" text not null,
  "push" boolean default true not null,
  "email" boolean default true not null
);
create table "public"."notificacoes" (
  "id" bigint generated ALWAYS as identity not null,
  "user_id" uuid not null,
  "categoria" text not null,
  "titulo" text not null,
  "texto" text,
  "link" text,
  "lida_em" timestamp with time zone,
  "email_em" timestamp with time zone,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."perfis" (
  "id" uuid not null,
  "tipo" text not null,
  "nome" text not null,
  "criado_em" timestamp with time zone default now() not null
);

-- Chaves e restrições (primárias e únicas antes das estrangeiras)
alter table "public"."auditoria" add constraint "auditoria_pkey" PRIMARY KEY (id);
alter table "public"."contatos" add constraint "contatos_pkey" PRIMARY KEY (user_id);
alter table "public"."contatos" add constraint "contatos_canal_check" CHECK ((canal = ANY (ARRAY['whatsapp'::text, 'sms'::text, 'email'::text])));
alter table "public"."contatos" add constraint "contatos_email_check" CHECK ((email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text));
alter table "public"."contatos" add constraint "contatos_telefone_check" CHECK ((telefone ~ '^\+?[0-9 ()-]{8,20}$'::text));
alter table "public"."contatos" add constraint "contatos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."notificacao_prefs" add constraint "notificacao_prefs_pkey" PRIMARY KEY (user_id, categoria);
alter table "public"."notificacao_prefs" add constraint "notificacao_prefs_categoria_check" CHECK ((categoria = ANY (ARRAY['mensagens'::text, 'candidaturas'::text, 'vagas'::text, 'contratacao'::text, 'avaliacoes'::text, 'convites'::text, 'plano'::text])));
alter table "public"."notificacao_prefs" add constraint "notificacao_prefs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."notificacoes" add constraint "notificacoes_pkey" PRIMARY KEY (id);
alter table "public"."notificacoes" add constraint "notificacoes_categoria_check" CHECK ((categoria = ANY (ARRAY['mensagens'::text, 'candidaturas'::text, 'vagas'::text, 'contratacao'::text, 'avaliacoes'::text, 'convites'::text, 'plano'::text])));
alter table "public"."notificacoes" add constraint "notificacoes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."perfis" add constraint "perfis_pkey" PRIMARY KEY (id);
alter table "public"."perfis" add constraint "perfis_nome_check" CHECK (((char_length(nome) >= 2) AND (char_length(nome) <= 120)));
alter table "public"."perfis" add constraint "perfis_tipo_check" CHECK ((tipo = ANY (ARRAY['empresa'::text, 'profissional'::text])));
alter table "public"."perfis" add constraint "perfis_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Índices
CREATE INDEX notificacoes_user_idx ON public.notificacoes USING btree (user_id, criado_em DESC);

-- Views

-- Funções
CREATE OR REPLACE FUNCTION public.auditar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.auditoria (quem, tabela, registro, acao, antes, depois)
  values (auth.uid(), tg_table_name, coalesce(new.id, old.id), lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.avisos_pendentes_email(p_limite integer DEFAULT 50, p_espera_min integer DEFAULT 3)
 RETURNS TABLE(user_id uuid, email text, nome text, avisos jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select n.user_id, u.email::text, coalesce(pf.nome, split_part(u.email, '@', 1))::text,
         jsonb_agg(jsonb_build_object('id', n.id, 'categoria', n.categoria, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link, 'criado_em', n.criado_em)
                   order by n.criado_em desc)
  from public.notificacoes n
  join auth.users u on u.id = n.user_id
  left join public.perfis pf on pf.id = n.user_id
  where n.email_em is null and n.lida_em is null
    and n.criado_em < now() - make_interval(mins => p_espera_min)
    and u.email is not null
    and not exists (select 1 from public.notificacao_prefs np where np.user_id = n.user_id and np.categoria = n.categoria and not np.email)
  group by n.user_id, u.email, pf.nome
  limit p_limite
$function$;

CREATE OR REPLACE FUNCTION public.criar_conta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tipo text := new.raw_user_meta_data ->> 'tipo';
  v_nome text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1));
begin
  if v_tipo not in ('empresa', 'profissional') then
    return new;
  end if;
  insert into public.perfis (id, tipo, nome) values (new.id, v_tipo, v_nome);
  insert into public.contatos (user_id, email) values (new.id, new.email);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.eh_sistema()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(current_setting('kor.sistema', true), '') = 'on' or auth.uid() is null
$function$;

CREATE OR REPLACE FUNCTION public.guarda_notificacao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if not public.eh_sistema() and (new.user_id, new.categoria, new.titulo, new.texto, new.link, new.email_em, new.criado_em)
     is distinct from (old.user_id, old.categoria, old.titulo, old.texto, old.link, old.email_em, old.criado_em) then
    raise exception 'Só dá para marcar o aviso como lido.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.ligar_sistema(ligado boolean)
 RETURNS void
 LANGUAGE sql
AS $function$
  select set_config('kor.sistema', case when ligado then 'on' else 'off' end, true)
$function$;

CREATE OR REPLACE FUNCTION public.marcar_avisos_enviados(p_ids bigint[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  antes text := coalesce(current_setting('kor.sistema', true), '');
  n integer;
begin
  perform set_config('kor.sistema', 'on', true);
  update public.notificacoes set email_em = now() where id = any(p_ids) and email_em is null;
  get diagnostics n = row_count;
  perform set_config('kor.sistema', antes, true);
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.notificar(p_user uuid, p_categoria text, p_titulo text, p_texto text, p_link text, p_agrupar boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  antes text := coalesce(current_setting('kor.sistema', true), '');  -- devolve como estava (pode rodar dentro de outra ação do sistema)
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.notificacao_prefs where user_id = p_user and categoria = p_categoria and not push) then return; end if;
  perform set_config('kor.sistema', 'on', true);
  if p_agrupar then
    update public.notificacoes set titulo = p_titulo, texto = left(p_texto, 200), criado_em = now(), email_em = null
      where user_id = p_user and link = p_link and lida_em is null;
  end if;
  if not p_agrupar or not found then
    insert into public.notificacoes (user_id, categoria, titulo, texto, link) values (p_user, p_categoria, p_titulo, left(p_texto, 200), p_link);
  end if;
  perform set_config('kor.sistema', antes, true);
end $function$;

CREATE OR REPLACE FUNCTION public.tocar_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.atualizado_em := now();
  return new;
end $function$;

-- Triggers
CREATE TRIGGER ao_criar_usuario AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION criar_conta();
CREATE TRIGGER cron_job_cache_invalidate AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON cron.job FOR EACH STATEMENT EXECUTE FUNCTION cron.job_cache_invalidate();
CREATE TRIGGER notificacoes_guarda BEFORE UPDATE ON public.notificacoes FOR EACH ROW EXECUTE FUNCTION guarda_notificacao();
CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();
CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();
CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');
CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();
CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');
CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

-- Segurança por linha (RLS) e políticas
alter table "public"."auditoria" enable row level security;
alter table "public"."contatos" enable row level security;
alter table "public"."notificacao_prefs" enable row level security;
alter table "public"."notificacoes" enable row level security;
alter table "public"."perfis" enable row level security;
create policy "cron_job_policy" on "cron"."job" as permissive for all to public using ((username = CURRENT_USER));
create policy "cron_job_run_details_policy" on "cron"."job_run_details" as permissive for all to public using ((username = CURRENT_USER));
create policy "contatos_dono" on "public"."contatos" as permissive for all to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "notificacao_prefs_dono" on "public"."notificacao_prefs" as permissive for all to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "notificacoes_apagar" on "public"."notificacoes" as permissive for delete to authenticated using ((user_id = auth.uid()));
create policy "notificacoes_ler" on "public"."notificacoes" as permissive for select to authenticated using ((user_id = auth.uid()));
create policy "notificacoes_marcar" on "public"."notificacoes" as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "perfis_ler" on "public"."perfis" as permissive for select to authenticated using ((id = auth.uid()));

-- Buckets do Storage (só a configuração; os arquivos não entram)
insert into storage.buckets (id, name, public) values ('curriculos', 'curriculos', false) on conflict (id) do nothing;
