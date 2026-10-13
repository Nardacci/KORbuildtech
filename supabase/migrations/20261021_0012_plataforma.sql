-- KORbuild · fatia 8c do banco (docs/banco.md §15.5): a administração da plataforma.
-- Quem está em admins_plataforma cuida das empresas pelo mesmo login, numa página à parte (admin.html), SÓ por funções do
-- banco que conferem eh_admin_plataforma(); nenhuma política abre as tabelas das empresas.
--   · plataforma: os valores padrão para empresas novas (dias de teste, configuração inicial);
--   · admin_log: o que a plataforma fez (só insert);
--   · plano da empresa (status, teste_ate, limites, nome) e módulos mudam por funções, com motivo, auditoria da empresa e
--     aviso (sininho e e-mail) para quem administra a conta; empresa "suspensa" não grava (a leitura e o login continuam);
--   · criar_empresa passa a gravar o teste de 14 dias (valor padrão da plataforma) e a configuração padrão;
--   · a fila de e-mails e os administradores se veem e se mudam por aqui (sem o token do link).
-- Os limites (limite_obras, limite_usuarios) ficam gravados; só passam a valer junto com o preço (pagamento é a última etapa).
-- Só CRIA e redefine funções; não apaga dado. Rodar e depois supabase/testes/0010_plataforma.sql.

begin;

-- ---------- Valores padrão e o registro do que a plataforma fez ----------

create table public.plataforma (
  id boolean primary key default true check (id),                       -- uma linha só
  valores jsonb not null default '{"teste_dias": 14, "configuracao": {}}'::jsonb check (jsonb_typeof(valores) = 'object'),
  atualizado_em timestamptz not null default now(), por uuid
);
insert into public.plataforma default values;
alter table public.plataforma enable row level security;               -- sem política: só as funções admin_*
revoke all on public.plataforma from anon, authenticated;

create table public.admin_log (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  quem uuid, quem_nome text not null default '',
  acao text not null,                                                   -- plano · modulos · valores · reenvio · administrador
  empresa_id uuid references public.empresas (id) on delete set null,
  detalhe jsonb not null default '{}'::jsonb
);
create index admin_log_empresa on public.admin_log (empresa_id, em desc);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;
create or replace function public.guarda_admin_log() returns trigger
language plpgsql as $f$
begin
  -- a empresa excluída zera o vínculo (set null); o resto do registro não muda nem sai
  if tg_op = 'UPDATE' and old.empresa_id is not null and new.empresa_id is null and not exists (select 1 from public.empresas where id = old.empresa_id)
     and (to_jsonb(new) - 'empresa_id') = (to_jsonb(old) - 'empresa_id') then return new; end if;
  raise exception 'O registro da plataforma não pode ser alterado nem apagado.';
end $f$;
create trigger admin_log_guarda before update or delete on public.admin_log for each row execute function public.guarda_admin_log();

-- ---------- Empresa suspensa não grava ----------

create or replace function public.empresa_ativa() returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select coalesce((select plano ->> 'status' from public.empresas where id = public.minha_empresa()), 'teste') <> 'suspensa'
$f$;

create or replace function public.exigir_empresa_ativa() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare v_empresa uuid := (to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> 'empresa_id')::uuid;
begin
  if (select plano ->> 'status' from public.empresas where id = v_empresa) = 'suspensa' then
    raise exception 'Esta conta está suspensa. Fale com o KORbuild.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $f$;

-- em todas as tabelas de dados da empresa (as funções que gravam passam pelos gatilhos também); ficam de fora o que o sistema grava
do $$
declare t text;
begin
  for t in select c.table_name from information_schema.columns c join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name and x.table_type = 'BASE TABLE'
            where c.table_schema = 'public' and c.column_name = 'empresa_id'
              and c.table_name not in ('empresas', 'admins_plataforma', 'membros', 'notificacoes', 'auditoria', 'fila_email', 'admin_log') loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.exigir_empresa_ativa()', t || '_ativa', t);
  end loop;
end $$;

-- ---------- Empresa nova: teste e configuração padrão da plataforma ----------

create or replace function public.criar_empresa(p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare
  v_empresa uuid; v_admin uuid;
  v_nome text := btrim(coalesce(p ->> 'nome', ''));
  v_pessoa text := btrim(coalesce(p ->> 'nome_pessoa', (select raw_user_meta_data ->> 'nome' from auth.users where id = auth.uid()), ''));
  v_atuacao text := coalesce(p ->> 'atuacao', 'prestadora');
  v_dias integer := coalesce((select (valores ->> 'teste_dias')::int from public.plataforma), 14);
  v_config jsonb := coalesce((select valores -> 'configuracao' from public.plataforma), '{}'::jsonb);
  todas text[] := array['crew.ponto.proprio','crew.ponto.equipe','crew.acompanhar','crew.aprovar','crew.custos','daily.preencher','daily.acompanhar','daily.aprovar','daily.cronograma','concorrencias.gerir','measure.medir','measure.catalogo','concorrencias.responder','settings.funcionarios','settings.regras','settings.acesso','settings.conta','settings.contatos','settings.obras'];
begin
  if auth.uid() is null then raise exception 'Entre para criar a empresa.'; end if;
  if exists (select 1 from public.membros where user_id = auth.uid()) then raise exception 'Esta conta já pertence a uma empresa.'; end if;
  if char_length(v_pessoa) < 2 then v_pessoa := split_part((select email from auth.users where id = auth.uid()), '@', 1); end if;
  if char_length(v_pessoa) < 2 then v_pessoa := rpad(v_pessoa, 2, '_'); end if;
  insert into public.empresas (nome, atuacao, modulos, plano, configuracao)
  values (v_nome, v_atuacao, case when v_atuacao = 'construtora' then array['daily'] else array['daily','crew','measure'] end,
          jsonb_build_object('nome', 'Teste', 'status', 'teste', 'teste_ate', (current_date + v_dias)::text), v_config)
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

-- ---------- As funções da administração ----------

create or replace function public.admin_exigir() returns void
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  if not public.eh_admin_plataforma() then raise exception 'Sem acesso à administração da plataforma.'; end if;
end $f$;

create or replace function public.admin_registrar(p_acao text, p_empresa uuid, p_detalhe jsonb) returns void
language plpgsql security definer set search_path to 'public' as $f$
begin
  insert into public.admin_log (quem, quem_nome, acao, empresa_id, detalhe)
  values (auth.uid(), coalesce((select email from auth.users where id = auth.uid()), ''), p_acao, p_empresa, coalesce(p_detalhe, '{}'::jsonb));
end $f$;

-- A lista: uma linha por empresa.
create or replace function public.admin_empresas(p_busca text default null) returns setof jsonb
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  perform public.admin_exigir();
  return query
    select jsonb_build_object('id', e.id, 'nome', e.nome, 'atuacao', e.atuacao, 'plano', e.plano, 'modulos', to_jsonb(e.modulos), 'criada_em', e.criada_em,
             'usuarios', (select count(*) from public.membros m where m.empresa_id = e.id and m.ativo),
             'obras', (select count(*) from public.obras o where o.empresa_id = e.id),
             'ultimo_acesso', (select max(m.ultimo_acesso) from public.membros m where m.empresa_id = e.id),
             'dias_de_teste', case when e.plano ->> 'teste_ate' ~ '^\d{4}-\d{2}-\d{2}' then left(e.plano ->> 'teste_ate', 10)::date - public.hoje_da_empresa(e.id) end)
      from public.empresas e
     where p_busca is null or btrim(p_busca) = '' or e.nome ilike '%' || btrim(p_busca) || '%'
     order by e.criada_em desc;
end $f$;

-- O detalhe de uma empresa: dados, pessoas (com e-mail), contagens e o que a plataforma já fez nela.
create or replace function public.admin_empresa(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $f$
declare e public.empresas;
begin
  perform public.admin_exigir();
  select * into e from public.empresas where id = p_id;
  if e.id is null then raise exception 'Empresa não encontrada.'; end if;
  return jsonb_build_object(
    'empresa', to_jsonb(e) - 'logo_path',
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object('nome', m.nome, 'cargo', m.cargo, 'email', u.email, 'perfil', pa.nome, 'ativo', m.ativo, 'ultimo_acesso', m.ultimo_acesso) order by m.criado_em)
                           from public.membros m join auth.users u on u.id = m.user_id join public.perfis_acesso pa on pa.id = m.perfil_id where m.empresa_id = e.id), '[]'::jsonb),
    'obras', (select count(*) from public.obras where empresa_id = e.id),
    'funcionarios', (select count(*) from public.funcionarios where empresa_id = e.id),
    'concorrencias', (select count(*) from public.concorrencias where empresa_id = e.id),
    'projetos', (select count(*) from public.projetos where empresa_id = e.id),
    'log', coalesce((select jsonb_agg(jsonb_build_object('em', l.em, 'quem', l.quem_nome, 'acao', l.acao, 'detalhe', l.detalhe) order by l.em desc) from (select * from public.admin_log where empresa_id = e.id order by em desc limit 20) l), '[]'::jsonb));
end $f$;

-- Mudar o plano (status, teste_ate, limites, nome). Com motivo; vai para a auditoria da empresa e avisa quem a administra.
create or replace function public.admin_alterar_plano(p_empresa uuid, p_plano jsonb, p_motivo text) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare e public.empresas; novo jsonb; k text; v jsonb;
begin
  perform public.admin_exigir();
  select * into e from public.empresas where id = p_empresa for update;
  if e.id is null then raise exception 'Empresa não encontrada.'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Diga o motivo da mudança.'; end if;
  if jsonb_typeof(p_plano) is distinct from 'object' then raise exception 'Plano inválido.'; end if;
  novo := e.plano;
  for k, v in select key, value from jsonb_each(p_plano) loop
    if k not in ('nome', 'status', 'teste_ate', 'limite_obras', 'limite_usuarios') then raise exception 'Campo do plano desconhecido: %', k; end if;
    if jsonb_typeof(v) = 'null' then novo := novo - k; continue; end if;
    if k = 'status' and (v #>> '{}') not in ('teste', 'ativa', 'atraso', 'cancelada', 'suspensa') then raise exception 'Situação inválida: %', v #>> '{}'; end if;
    if k = 'teste_ate' and (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data do fim do teste inválida (AAAA-MM-DD).'; end if;
    if k in ('limite_obras', 'limite_usuarios') and (jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric)) then raise exception 'Limite inválido: % (número inteiro, 0 ou mais).', k; end if;
    if k = 'nome' and char_length(btrim(v #>> '{}')) not between 1 and 60 then raise exception 'Nome do plano inválido.'; end if;
    novo := novo || jsonb_build_object(k, v);
  end loop;
  update public.empresas set plano = novo where id = e.id;
  perform public.admin_registrar('plano', e.id, jsonb_build_object('antes', e.plano, 'depois', novo, 'motivo', btrim(p_motivo)));
  insert into public.auditoria (quem, tabela, registro, acao, antes, depois, empresa_id, motivo)
  values (auth.uid(), 'empresas', e.id, 'plano', jsonb_build_object('plano', e.plano), jsonb_build_object('plano', novo), e.id, 'Plataforma: ' || btrim(p_motivo));
  perform public.notificar_empresa(e.id, 'settings.conta', 'conta', 'O plano da sua empresa foi alterado pelo KORbuild', '{}'::jsonb, '#/conta/empresa', btrim(p_motivo), false, true);
  return novo;
end $f$;

-- Os módulos que a empresa usa (a construtora só tem o Daily, HS-09).
create or replace function public.admin_alterar_modulos(p_empresa uuid, p_modulos text[], p_motivo text) returns text[]
language plpgsql security definer set search_path to 'public' as $f$
declare e public.empresas; novos text[];
begin
  perform public.admin_exigir();
  select * into e from public.empresas where id = p_empresa for update;
  if e.id is null then raise exception 'Empresa não encontrada.'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Diga o motivo da mudança.'; end if;
  novos := array(select distinct x from unnest(coalesce(p_modulos, '{}')) x order by x);
  if cardinality(novos) = 0 or not (novos <@ array['daily', 'crew', 'measure']) then raise exception 'Módulos inválidos (daily, crew, measure; pelo menos um).'; end if;
  if e.atuacao = 'construtora' and novos <> array['daily'] then raise exception 'A construtora só usa o Daily.'; end if;
  update public.empresas set modulos = novos where id = e.id;
  perform public.admin_registrar('modulos', e.id, jsonb_build_object('antes', to_jsonb(e.modulos), 'depois', to_jsonb(novos), 'motivo', btrim(p_motivo)));
  insert into public.auditoria (quem, tabela, registro, acao, antes, depois, empresa_id, motivo)
  values (auth.uid(), 'empresas', e.id, 'modulos', jsonb_build_object('modulos', e.modulos), jsonb_build_object('modulos', novos), e.id, 'Plataforma: ' || btrim(p_motivo));
  return novos;
end $f$;

-- Os valores padrão das empresas novas. Sem argumento, só lê.
create or replace function public.admin_valores_padrao(p_valores jsonb default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare antes jsonb;
begin
  perform public.admin_exigir();
  select valores into antes from public.plataforma;
  if p_valores is null then return antes; end if;
  if jsonb_typeof(p_valores) <> 'object' then raise exception 'Valores inválidos.'; end if;
  if p_valores ? 'teste_dias' and (jsonb_typeof(p_valores -> 'teste_dias') <> 'number' or (p_valores ->> 'teste_dias')::numeric not between 1 and 365 or (p_valores ->> 'teste_dias')::numeric <> trunc((p_valores ->> 'teste_dias')::numeric)) then
    raise exception 'Dias de teste: um número inteiro de 1 a 365.'; end if;
  if p_valores ? 'configuracao' and jsonb_typeof(p_valores -> 'configuracao') <> 'object' then raise exception 'A configuração padrão precisa ser um objeto.'; end if;
  if exists (select 1 from jsonb_object_keys(p_valores) k where k not in ('teste_dias', 'configuracao')) then raise exception 'Valor padrão desconhecido.'; end if;
  update public.plataforma set valores = antes || p_valores, atualizado_em = now(), por = auth.uid();
  perform public.admin_registrar('valores', null, jsonb_build_object('antes', antes, 'depois', antes || p_valores));
  return antes || p_valores;
end $f$;

-- A fila de e-mails (sem o token do link) e o resumo do que está parado.
create or replace function public.admin_fila_email(p_limite integer default 100) returns setof jsonb
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  perform public.admin_exigir();
  return query
    select jsonb_build_object('id', f.id, 'empresa', (select nome from public.empresas where id = f.empresa_id), 'para_email', f.para_email, 'modelo', f.modelo, 'idioma', f.idioma,
             'criado_em', f.criado_em, 'enviado_em', f.enviado_em, 'tentativas', f.tentativas, 'erro', f.erro)
      from public.fila_email f order by f.id desc limit least(greatest(coalesce(p_limite, 100), 1), 500);
end $f$;
create or replace function public.admin_resumo_email() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  perform public.admin_exigir();
  return jsonb_build_object(
    'fila_pendente', (select count(*) from public.fila_email where enviado_em is null and tentativas < 5),
    'fila_parada', (select count(*) from public.fila_email where enviado_em is null and tentativas >= 5),
    'fila_com_erro', (select count(*) from public.fila_email where enviado_em is null and erro is not null),
    'avisos_pendentes', (select count(*) from public.notificacoes where email_em is null and lida_em is null));
end $f$;
create or replace function public.admin_reenviar(p_id bigint) returns boolean
language plpgsql security definer set search_path to 'public' as $f$
declare n integer;
begin
  perform public.admin_exigir();
  update public.fila_email set tentativas = 0, erro = null where id = p_id and enviado_em is null;
  get diagnostics n = row_count;
  if n > 0 then perform public.admin_registrar('reenvio', (select empresa_id from public.fila_email where id = p_id), jsonb_build_object('fila', p_id)); end if;
  return n > 0;
end $f$;

-- Quem administra a plataforma.
create or replace function public.admin_administradores() returns setof jsonb
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  perform public.admin_exigir();
  return query select jsonb_build_object('user_id', a.user_id, 'email', u.email, 'desde', a.criado_em) from public.admins_plataforma a join auth.users u on u.id = a.user_id order by a.criado_em;
end $f$;
create or replace function public.admin_definir(p_email text, p_ligado boolean) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare v_user uuid;
begin
  perform public.admin_exigir();
  select id into v_user from auth.users where lower(email) = lower(btrim(coalesce(p_email, '')));
  if v_user is null then raise exception 'Não há usuário com esse e-mail.'; end if;
  if p_ligado then
    insert into public.admins_plataforma (user_id) values (v_user) on conflict do nothing;
  else
    if (select count(*) from public.admins_plataforma) <= 1 then raise exception 'Não dá para tirar o último administrador da plataforma.'; end if;
    delete from public.admins_plataforma where user_id = v_user;
  end if;
  perform public.admin_registrar('administrador', null, jsonb_build_object('email', lower(btrim(p_email)), 'ligado', p_ligado));
end $f$;

-- ---------- Acesso ----------

revoke all on function public.guarda_admin_log(), public.exigir_empresa_ativa(), public.admin_exigir(), public.admin_registrar(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.empresa_ativa(), public.admin_empresas(text), public.admin_empresa(uuid), public.admin_alterar_plano(uuid, jsonb, text), public.admin_alterar_modulos(uuid, text[], text),
  public.admin_valores_padrao(jsonb), public.admin_fila_email(integer), public.admin_resumo_email(), public.admin_reenviar(bigint), public.admin_administradores(), public.admin_definir(text, boolean) from public, anon;
grant execute on function public.empresa_ativa(), public.admin_empresas(text), public.admin_empresa(uuid), public.admin_alterar_plano(uuid, jsonb, text), public.admin_alterar_modulos(uuid, text[], text),
  public.admin_valores_padrao(jsonb), public.admin_fila_email(integer), public.admin_resumo_email(), public.admin_reenviar(bigint), public.admin_administradores(), public.admin_definir(text, boolean) to authenticated;
revoke all on function public.criar_empresa(jsonb) from public, anon;
grant execute on function public.criar_empresa(jsonb) to authenticated;

commit;
