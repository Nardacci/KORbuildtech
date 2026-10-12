-- KORbuild · fatia 1 do banco (docs/banco.md §2, §9): empresas, perfis de acesso, membros, convites de usuário,
-- administradores da plataforma e auditoria por empresa.
-- Decisões (outubro de 2026): uma pessoa pertence a UMA empresa (membros.user_id único) e pode estar em N obras
-- (alocação, fatia 2); a empresa tem 1 ou N funcionários; pagamento e preço por número de funcionários ficam para o fim.
-- Esta migração só CRIA e reescreve funções; não apaga nada. A saída do perfis/contatos antigos é um passo à parte,
-- com o ok do usuário (supabase/0001b-remover-perfis-antigos.sql, a escrever depois do ok).
-- Rodar: a sessão com acesso ao Supabase executa este arquivo e depois supabase/testes/0001_acesso.sql.

begin;

-- ---------- Tabelas ----------

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  razao_social text not null default '',
  sigla text not null default '' check (char_length(sigla) <= 3),
  ein text not null default '',
  atuacao text not null default 'prestadora' check (atuacao in ('prestadora', 'construtora', 'ambas')),
  especialidades text not null default '',
  endereco text not null default '', cidade text not null default '', estado text not null default '', zip text not null default '',
  telefone text not null default '', email text not null default '', site text not null default '',
  licencas text not null default '', seguros text not null default '', termos_proposta text not null default '',
  logo_path text,
  plano jsonb not null default jsonb_build_object('nome', 'Teste', 'status', 'teste'),
  modulos text[] not null default array['daily'],
  configuracao jsonb not null default '{}'::jsonb,   -- valores que hoje estão fixos no código (BD-07)
  criada_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.perfis_acesso (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  chave text check (chave in ('administrador', 'gestor', 'encarregado', 'trabalhador')),  -- só os quatro padrão
  nome text not null check (char_length(btrim(nome)) between 2 and 60),
  descricao text not null default '',
  sistema boolean not null default false,          -- o Administrador: travado (SET-061)
  permissoes text[] not null default '{}',
  criado_em timestamptz not null default now(),
  unique (empresa_id, nome),
  unique (empresa_id, chave)
);

create table public.membros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,  -- uma pessoa, uma empresa
  perfil_id uuid not null references public.perfis_acesso (id),               -- perfil em uso não se exclui (SET-064)
  funcionario_id uuid,                                                         -- liga ao funcionário (fatia 2)
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  cargo text not null default '', telefone text not null default '',
  ativo boolean not null default true,
  ultimo_acesso timestamptz,
  criado_em timestamptz not null default now()
);
create index membros_empresa on public.membros (empresa_id);

create table public.convites_usuario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  nome text not null default '',
  perfil_id uuid not null references public.perfis_acesso (id),
  token_hash text not null unique,                 -- só o hash; o token vai no link (e-mail na fatia 8)
  convidado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  aceito_em timestamptz, aceito_por uuid references auth.users (id),
  cancelado_em timestamptz
);
create index convites_usuario_empresa on public.convites_usuario (empresa_id);

create table public.admins_plataforma (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- ---------- Funções de acesso (usadas pelas políticas) ----------

create or replace function public.minha_empresa() returns uuid
language sql stable security definer set search_path to 'public' as $f$
  select empresa_id from public.membros where user_id = auth.uid() and ativo
$f$;

create or replace function public.tenho_permissao(p text) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select exists (select 1 from public.membros m join public.perfis_acesso pa on pa.id = m.perfil_id
                 where m.user_id = auth.uid() and m.ativo and p = any (pa.permissoes))
$f$;

create or replace function public.eh_admin_plataforma() returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select exists (select 1 from public.admins_plataforma where user_id = auth.uid())
$f$;

-- ---------- Regras que o banco garante ----------

-- Administrador travado; perfis padrão não mudam de chave nem de empresa (SET-061).
create or replace function public.guarda_perfil_acesso() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  if tg_op = 'DELETE' then
    if old.sistema then raise exception 'O perfil Administrador não pode ser excluído.'; end if;
    return old;
  end if;
  if old.sistema and (new.permissoes is distinct from old.permissoes or new.sistema is distinct from old.sistema) then
    raise exception 'O perfil Administrador é travado.';
  end if;
  if new.chave is distinct from old.chave or new.empresa_id <> old.empresa_id then
    raise exception 'Não é possível trocar a empresa ou a chave de um perfil.';
  end if;
  return new;
end $f$;
create trigger perfis_acesso_guarda before update or delete on public.perfis_acesso for each row execute function public.guarda_perfil_acesso();

-- Ninguém altera o próprio acesso; a empresa sempre mantém alguém ativo com settings.acesso (SET-061).
create or replace function public.guarda_membro() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare restantes int;
begin
  if tg_op = 'UPDATE' then
    if new.empresa_id <> old.empresa_id or new.user_id <> old.user_id then
      raise exception 'Não é possível trocar a empresa ou o login de um membro.';
    end if;
    if (select empresa_id from public.perfis_acesso where id = new.perfil_id) <> new.empresa_id then
      raise exception 'Perfil de outra empresa.';
    end if;
    if old.user_id = auth.uid() and (new.ativo is distinct from old.ativo or new.perfil_id <> old.perfil_id) then
      raise exception 'Ninguém altera o próprio acesso.';
    end if;
  end if;
  -- quantos continuam ativos com settings.acesso depois desta mudança
  select count(*) into restantes
    from public.membros m join public.perfis_acesso pa on pa.id = m.perfil_id
   where m.empresa_id = old.empresa_id and m.id <> old.id and m.ativo and 'settings.acesso' = any (pa.permissoes);
  if tg_op = 'UPDATE' and new.ativo and exists (select 1 from public.perfis_acesso where id = new.perfil_id and 'settings.acesso' = any (permissoes)) then
    restantes := restantes + 1;
  end if;
  if restantes = 0 then
    raise exception 'A empresa precisa manter alguém ativo que cuide dos acessos.';
  end if;
  return coalesce(new, old);
end $f$;
create trigger membros_guarda before update or delete on public.membros for each row execute function public.guarda_membro();

create trigger empresas_tocar before update on public.empresas for each row execute function public.tocar_atualizado_em();

-- ---------- Auditoria por empresa (reaproveita a tabela que ficou; docs/banco.md §7) ----------

alter table public.auditoria add column empresa_id uuid references public.empresas (id) on delete cascade, add column motivo text;
create index auditoria_empresa on public.auditoria (empresa_id, criado_em desc);

-- o motivo vem de set_config('kb.motivo', '...', true) na mesma transação, quando o app informa
create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare linha jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.auditoria (quem, tabela, registro, acao, antes, depois, empresa_id, motivo)
  values (auth.uid(), tg_table_name, (linha ->> 'id')::uuid, lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end,
          case when tg_table_name = 'empresas' then (linha ->> 'id')::uuid else (linha ->> 'empresa_id')::uuid end,
          nullif(current_setting('kb.motivo', true), ''));
  return null;
end $f$;
create trigger empresas_auditar after insert or update on public.empresas for each row execute function public.auditar();
create trigger perfis_acesso_auditar after insert or update or delete on public.perfis_acesso for each row execute function public.auditar();
create trigger membros_auditar after insert or update or delete on public.membros for each row execute function public.auditar();
create trigger convites_usuario_auditar after insert or update on public.convites_usuario for each row execute function public.auditar();

-- ---------- RLS ----------

alter table public.empresas enable row level security;
alter table public.perfis_acesso enable row level security;
alter table public.membros enable row level security;
alter table public.convites_usuario enable row level security;
alter table public.admins_plataforma enable row level security;

create policy empresas_ler on public.empresas for select to authenticated using (id = public.minha_empresa() or public.eh_admin_plataforma());
create policy empresas_editar on public.empresas for update to authenticated
  using (id = public.minha_empresa() and public.tenho_permissao('settings.conta')) with check (id = public.minha_empresa());

create policy perfis_acesso_ler on public.perfis_acesso for select to authenticated using (empresa_id = public.minha_empresa());
create policy perfis_acesso_criar on public.perfis_acesso for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.acesso') and not sistema and chave is null);
create policy perfis_acesso_editar on public.perfis_acesso for update to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.acesso')) with check (empresa_id = public.minha_empresa());
create policy perfis_acesso_excluir on public.perfis_acesso for delete to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.acesso'));

create policy membros_ler on public.membros for select to authenticated using (empresa_id = public.minha_empresa());
create policy membros_editar on public.membros for update to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.acesso')) with check (empresa_id = public.minha_empresa());

create policy convites_usuario_ler on public.convites_usuario for select to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.acesso'));
create policy convites_usuario_cancelar on public.convites_usuario for update to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.acesso')) with check (empresa_id = public.minha_empresa());

create policy admins_plataforma_ler on public.admins_plataforma for select to authenticated using (user_id = auth.uid());

create policy auditoria_ler on public.auditoria for select to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.acesso'));

-- ---------- Operações (funções chamadas pelo app) ----------

-- Criar a empresa no primeiro acesso: a empresa, os quatro perfis padrão (iguais a PERFIS_INICIAIS em js/settings.js)
-- e quem criou como Administrador. Uma pessoa, uma empresa.
create or replace function public.criar_empresa(p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare
  v_empresa uuid; v_admin uuid;
  v_nome text := btrim(coalesce(p ->> 'nome', ''));
  v_pessoa text := btrim(coalesce(p ->> 'nome_pessoa', (select raw_user_meta_data ->> 'nome' from auth.users where id = auth.uid()), ''));
  v_atuacao text := coalesce(p ->> 'atuacao', 'prestadora');
  todas text[] := array['crew.ponto.proprio','crew.ponto.equipe','crew.acompanhar','crew.aprovar','crew.custos','daily.preencher','daily.acompanhar','daily.aprovar','daily.cronograma','concorrencias.gerir','measure.medir','measure.catalogo','concorrencias.responder','settings.funcionarios','settings.regras','settings.acesso','settings.conta','settings.contatos','settings.obras'];
begin
  if auth.uid() is null then raise exception 'Entre para criar a empresa.'; end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then raise exception 'Esta conta já pertence a uma empresa.'; end if;
  if char_length(v_pessoa) < 2 then v_pessoa := split_part((select email from auth.users where id = auth.uid()), '@', 1); end if;
  if char_length(v_pessoa) < 2 then v_pessoa := rpad(v_pessoa, 2, '_'); end if;
  insert into public.empresas (nome, atuacao, modulos)
  values (v_nome, v_atuacao, case when v_atuacao = 'construtora' then array['daily'] else array['daily','crew','measure'] end)
  returning id into v_empresa;
  insert into public.perfis_acesso (empresa_id, chave, nome, descricao, sistema, permissoes) values
    (v_empresa, 'administrador', 'Administrador', 'Escritório: tudo, inclusive o Settings', true,
       array(select x from unnest(todas) x where x not in ('crew.ponto.proprio','crew.ponto.equipe','daily.preencher'))),
    (v_empresa, 'gestor', 'Gestor de obras', 'Vê tudo dos módulos e aprova, sem mexer nas configurações', false,
       array['crew.acompanhar','crew.aprovar','crew.custos','daily.acompanhar','daily.aprovar','daily.cronograma','concorrencias.gerir','measure.medir','concorrencias.responder','settings.obras']),
    (v_empresa, 'encarregado', 'Encarregado', 'Campo: ponto da equipe e diário de obra', false, array['crew.ponto.proprio','crew.ponto.equipe','daily.preencher']),
    (v_empresa, 'trabalhador', 'Trabalhador', 'Só bate o próprio ponto', false, array['crew.ponto.proprio']);
  select id into v_admin from public.perfis_acesso where empresa_id = v_empresa and chave = 'administrador';
  insert into public.membros (empresa_id, user_id, perfil_id, nome) values (v_empresa, auth.uid(), v_admin, v_pessoa);
  return v_empresa;
end $f$;

-- Convidar alguém para a empresa: devolve o token (vai no link; o banco guarda só o hash).
create or replace function public.convidar_usuario(p_email text, p_nome text, p_perfil uuid) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v_token text := encode(gen_random_bytes(24), 'hex'); v_email text := lower(btrim(p_email));
begin
  if not public.tenho_permissao('settings.acesso') then raise exception 'Sem permissão para convidar.'; end if;
  if not exists (select 1 from public.perfis_acesso where id = p_perfil and empresa_id = public.minha_empresa()) then raise exception 'Perfil inválido.'; end if;
  if exists (select 1 from public.membros m join auth.users u on u.id = m.user_id where lower(u.email) = v_email) then
    raise exception 'Este e-mail já pertence a uma empresa no KORbuild.';
  end if;
  insert into public.convites_usuario (empresa_id, email, nome, perfil_id, token_hash, convidado_por)
  values (public.minha_empresa(), v_email, btrim(coalesce(p_nome, '')), p_perfil, encode(digest(v_token, 'sha256'), 'hex'), auth.uid());
  return v_token;
end $f$;

-- Aceitar o convite: o login precisa ter o mesmo e-mail do convite, que precisa estar válido.
create or replace function public.aceitar_convite(p_token text) returns uuid
language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare c public.convites_usuario; v_email text := lower((select email from auth.users where id = auth.uid()));
begin
  if auth.uid() is null then raise exception 'Entre para aceitar o convite.'; end if;
  select * into c from public.convites_usuario where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if c.id is null or c.cancelado_em is not null or c.aceito_em is not null or c.expira_em < now() then raise exception 'Convite inválido ou vencido.'; end if;
  if c.email <> v_email then raise exception 'Este convite é para outro e-mail.'; end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then raise exception 'Esta conta já pertence a uma empresa.'; end if;
  insert into public.membros (empresa_id, user_id, perfil_id, nome)
  values (c.empresa_id, auth.uid(), c.perfil_id, coalesce(nullif(c.nome, ''), split_part(v_email, '@', 1)));
  update public.convites_usuario set aceito_em = now(), aceito_por = auth.uid() where id = c.id;
  return c.empresa_id;
end $f$;

create or replace function public.registrar_acesso() returns void
language sql security definer set search_path to 'public' as $f$
  update public.membros set ultimo_acesso = now() where user_id = auth.uid()
$f$;

revoke all on function public.criar_empresa(jsonb), public.convidar_usuario(text, text, uuid), public.aceitar_convite(text), public.registrar_acesso() from public, anon;
grant execute on function public.criar_empresa(jsonb), public.convidar_usuario(text, text, uuid), public.aceitar_convite(text), public.registrar_acesso() to authenticated;
grant select, update on public.empresas, public.membros, public.convites_usuario to authenticated;
grant select, insert, update, delete on public.perfis_acesso to authenticated;
grant select on public.admins_plataforma, public.auditoria to authenticated;

-- ---------- Aviso por e-mail: o nome vem de membros (não mais de perfis, que vai sair) ----------

create or replace function public.avisos_pendentes_email(p_limite integer default 50, p_espera_min integer default 3)
returns table(user_id uuid, email text, nome text, avisos jsonb)
language sql stable security definer set search_path to 'public' as $f$
  select n.user_id, u.email::text, coalesce(m.nome, split_part(u.email, '@', 1))::text,
         jsonb_agg(jsonb_build_object('id', n.id, 'categoria', n.categoria, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link, 'criado_em', n.criado_em)
                   order by n.criado_em desc)
  from public.notificacoes n
  join auth.users u on u.id = n.user_id
  left join public.membros m on m.user_id = n.user_id
  where n.email_em is null and n.lida_em is null
    and n.criado_em < now() - make_interval(mins => p_espera_min)
    and u.email is not null
    and not exists (select 1 from public.notificacao_prefs np where np.user_id = n.user_id and np.categoria = n.categoria and not np.email)
  group by n.user_id, u.email, m.nome
  limit p_limite
$f$;

alter table public.notificacoes add column empresa_id uuid references public.empresas (id) on delete cascade;

commit;
