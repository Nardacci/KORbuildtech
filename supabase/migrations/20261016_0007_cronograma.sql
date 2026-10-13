-- KORbuild · fatia 5 do banco (docs/banco.md §4 e §12): o cronograma da obra.
-- Etapas, avanços (só insert), linhas de base (só insert) e publicações para a contratante (só insert). O banco garante:
--   · montar (criar, editar, excluir, reordenar, modelo, linha de base, % à mão, publicar) exige daily.cronograma, na própria empresa;
--   · o % da etapa muda só por um avanço registrado (gatilho), com histórico (CR-04);
--   · etapa com andamento de RDO aprovado não sai e só quem aprovou esse RDO altera (decisão de outubro de 2026);
--   · a primeira linha de base nasce com a primeira etapa; as outras, por decisão, com motivo (CR-03);
--   · publicar só numa obra ligada à do contratante; a contratante lê só por cronogramas_recebidos() (BD-03, CR-09);
--   · aprovar_rdo() passa a registrar, na empresa que fez o diário, o avanço de cada atividade que aponta uma etapa (o item
--     que ficou da fatia 3), mesmo quando quem aprova é a construtora.
-- Só CRIA (e reescreve aprovar_rdo); não apaga nada. Rodar este arquivo e depois supabase/testes/0005_cronograma.sql.

begin;

-- ---------- Tabelas ----------

create table public.cronograma_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  obra_id uuid not null,
  nome text not null check (char_length(btrim(nome)) between 1 and 160),
  inicio date not null, fim date not null check (fim >= inicio),
  responsavel_id uuid,                                  -- membro (opcional)
  pct smallint not null default 0 check (pct between 0 and 100),   -- só pelos avanços
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id) on delete cascade,
  foreign key (empresa_id, responsavel_id) references public.membros (empresa_id, id)
);
create index cronograma_etapas_obra on public.cronograma_etapas (empresa_id, obra_id, ordem);

create table public.etapa_avancos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  etapa_id uuid not null,
  data date not null,
  antes smallint not null, pct smallint not null check (pct between 0 and 100),
  fonte text not null check (fonte in ('rdo', 'manual')),
  rdo_id uuid, rdo_numero integer,
  por uuid, por_nome text not null default '',               -- por = o login (auth.uid()), como nas outras versões
  em timestamptz not null default now(),
  foreign key (empresa_id, etapa_id) references public.cronograma_etapas (empresa_id, id) on delete cascade
);
create index etapa_avancos_etapa on public.etapa_avancos (etapa_id, em);

create table public.linhas_base (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  obra_id uuid not null,
  motivo text not null check (btrim(motivo) <> ''),
  etapas jsonb not null,                                -- {etapa_id: {inicio, fim}}
  por uuid, por_nome text not null default '',
  em timestamptz not null default now(),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id) on delete cascade
);
create index linhas_base_obra on public.linhas_base (empresa_id, obra_id, em);

create table public.publicacoes_cronograma (
  id uuid primary key default gen_random_uuid(),
  de_empresa_id uuid not null references public.empresas (id) on delete cascade,
  obra_id uuid not null,                                -- a obra da prestadora
  para_empresa_id uuid not null references public.empresas (id) on delete cascade,
  para_obra_id uuid not null,
  versao integer not null,
  retrato jsonb not null,
  por uuid, por_nome text not null default '',
  em timestamptz not null default now(),
  unique (obra_id, versao),
  foreign key (de_empresa_id, obra_id) references public.obras (empresa_id, id) on delete cascade
);
create index publicacoes_cronograma_para on public.publicacoes_cronograma (para_empresa_id, para_obra_id, em desc);

-- ---------- Guardas ----------

-- Nome, datas, responsável e ordem mudam pelas funções (kb.cron_funcao); pct só pelo gatilho dos avanços.
create or replace function public.guarda_etapa() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.empresas where id = old.empresa_id) then return old; end if;
    if coalesce(current_setting('kb.cron_funcao', true), '') <> '1' then raise exception 'A etapa só sai pelas funções do cronograma.'; end if;
    if exists (select 1 from public.etapa_avancos where etapa_id = old.id and fonte = 'rdo') then
      raise exception 'Esta etapa já recebeu andamento de um diário aprovado: ela não pode ser excluída.';
    end if;
    return old;
  end if;
  if coalesce(current_setting('kb.cron_funcao', true), '') <> '1' then raise exception 'A etapa só muda pelas funções do cronograma.'; end if;
  if new.empresa_id <> old.empresa_id or new.obra_id <> old.obra_id then raise exception 'Não é possível trocar a empresa ou a obra de uma etapa.'; end if;
  if new.pct <> old.pct and coalesce(current_setting('kb.cron_avanco', true), '') <> '1' then raise exception 'O %% concluído muda só por um avanço registrado.'; end if;
  new.nome := btrim(new.nome);
  new.atualizado_em := now();
  return new;
end $f$;
create trigger cronograma_etapas_guarda before update or delete on public.cronograma_etapas for each row execute function public.guarda_etapa();
-- (a função de insert existe só para aparar o nome)
create or replace function public.guarda_etapa_insert() returns trigger
language plpgsql as $f$ begin new.nome := btrim(new.nome); return new; end $f$;
create trigger cronograma_etapas_ajustar before insert on public.cronograma_etapas for each row execute function public.guarda_etapa_insert();

-- Avanços, linhas de base e publicações: só insert. O avanço leva o pct para a etapa.
create or replace function public.guarda_so_insert_cron() returns trigger
language plpgsql as $f$
declare emp uuid;
begin
  if tg_op = 'DELETE' then
    emp := coalesce(to_jsonb(old) ->> 'empresa_id', to_jsonb(old) ->> 'de_empresa_id')::uuid;   -- a publicação tem de_empresa_id
    if not exists (select 1 from public.empresas where id = emp) then return old; end if;
  end if;
  raise exception 'Este registro não pode ser alterado nem apagado.';
end $f$;
create trigger etapa_avancos_guarda before update or delete on public.etapa_avancos for each row execute function public.guarda_so_insert_cron();
create trigger linhas_base_guarda before update or delete on public.linhas_base for each row execute function public.guarda_so_insert_cron();
create trigger publicacoes_cronograma_guarda before update or delete on public.publicacoes_cronograma for each row execute function public.guarda_so_insert_cron();

create or replace function public.aplicar_avanco() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  perform set_config('kb.cron_funcao', '1', true);
  perform set_config('kb.cron_avanco', '1', true);
  update public.cronograma_etapas set pct = new.pct where id = new.etapa_id;
  perform set_config('kb.cron_avanco', '0', true);
  return new;
end $f$;
create trigger etapa_avancos_aplicar after insert on public.etapa_avancos for each row execute function public.aplicar_avanco();

create trigger cronograma_etapas_auditar after insert or update or delete on public.cronograma_etapas for each row execute function public.auditar();
create trigger etapa_avancos_auditar after insert on public.etapa_avancos for each row when (new.fonte = 'manual') execute function public.auditar();
create trigger linhas_base_auditar after insert on public.linhas_base for each row execute function public.auditar();
-- a publicação tem de_empresa_id no lugar de empresa_id: a auditoria vai para a empresa que publicou
create or replace function public.auditar_publicacao() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  insert into public.auditoria (quem, tabela, registro, acao, depois, empresa_id)
  values (auth.uid(), tg_table_name, new.id, 'insert', to_jsonb(new) - 'retrato', new.de_empresa_id);
  return null;
end $f$;
create trigger publicacoes_cronograma_auditar_de after insert on public.publicacoes_cronograma for each row execute function public.auditar_publicacao();

-- ---------- Leitura (RLS): a própria empresa, com alguma permissão do Daily ----------

alter table public.cronograma_etapas enable row level security;
alter table public.etapa_avancos enable row level security;
alter table public.linhas_base enable row level security;
alter table public.publicacoes_cronograma enable row level security;
create policy cronograma_etapas_ler on public.cronograma_etapas for select to authenticated using (empresa_id = public.minha_empresa() and public.vejo_o_daily());
create policy etapa_avancos_ler on public.etapa_avancos for select to authenticated using (empresa_id = public.minha_empresa() and public.vejo_o_daily());
create policy linhas_base_ler on public.linhas_base for select to authenticated using (empresa_id = public.minha_empresa() and public.vejo_o_daily());
-- a prestadora vê o que ela mesma publicou; a contratante lê pela função
create policy publicacoes_cronograma_ler on public.publicacoes_cronograma for select to authenticated using (de_empresa_id = public.minha_empresa() and public.vejo_o_daily());

revoke all on public.cronograma_etapas, public.etapa_avancos, public.linhas_base, public.publicacoes_cronograma from anon, authenticated;
grant select on public.cronograma_etapas, public.etapa_avancos, public.linhas_base, public.publicacoes_cronograma to authenticated;

-- ---------- Apoio ----------

-- Quem aprovou o último diário que levou andamento a esta etapa (null = nenhum): só essa pessoa altera a etapa.
create or replace function public.quem_travou_a_etapa(p_etapa uuid) returns uuid
language sql stable security definer set search_path to 'public' as $f$
  select por from public.etapa_avancos where etapa_id = p_etapa and fonte = 'rdo' order by em desc, id desc limit 1
$f$;

create or replace function public.monto_o_cronograma(p_obra uuid, out eu public.membros) returns public.membros
language plpgsql security definer set search_path to 'public' as $f$
begin
  eu := public.meu_membro();
  if eu.id is null or not public.tenho_permissao('daily.cronograma') then raise exception 'Sem permissão para montar o cronograma.'; end if;
  if not exists (select 1 from public.obras where id = p_obra and empresa_id = eu.empresa_id) then raise exception 'Obra não encontrada.'; end if;
  perform set_config('kb.cron_funcao', '1', true);
end $f$;

create or replace function public.pode_mexer_na_etapa(p_etapa public.cronograma_etapas) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare v uuid := public.quem_travou_a_etapa(p_etapa.id);
begin
  if v is not null and v is distinct from auth.uid() then
    raise exception 'Esta etapa já recebeu andamento de um diário aprovado: só quem aprovou pode alterá-la.';
  end if;
end $f$;

-- ---------- Montar ----------

-- p: {id (null = nova), obra_id, nome, inicio, fim, responsavel_id}. Devolve o id. A primeira etapa grava a primeira linha de base.
create or replace function public.salvar_etapa(p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros; e public.cronograma_etapas; v_obra uuid := (p ->> 'obra_id')::uuid; v_id uuid := (p ->> 'id')::uuid; primeira boolean;
begin
  if v_id is not null then select obra_id into v_obra from public.cronograma_etapas where id = v_id; end if;
  eu := public.monto_o_cronograma(v_obra);
  if btrim(coalesce(p ->> 'nome', '')) = '' then raise exception 'Dê um nome à etapa (ex.: Framing do 2º pavimento).'; end if;
  if (p ->> 'inicio') is null or (p ->> 'fim') is null then raise exception 'Informe o início e o fim da etapa.'; end if;
  if (p ->> 'fim')::date < (p ->> 'inicio')::date then raise exception 'O fim não pode ser antes do início.'; end if;
  if v_id is null then
    primeira := not exists (select 1 from public.cronograma_etapas where obra_id = v_obra);
    insert into public.cronograma_etapas (empresa_id, obra_id, nome, inicio, fim, responsavel_id, ordem)
    values (eu.empresa_id, v_obra, p ->> 'nome', (p ->> 'inicio')::date, (p ->> 'fim')::date, (p ->> 'responsavel_id')::uuid,
            coalesce((select max(ordem) from public.cronograma_etapas where obra_id = v_obra), -1) + 1)
    returning * into e;
    if primeira then perform public.nova_linha_base(v_obra, 'Primeira versão do cronograma'); end if;
  else
    select * into e from public.cronograma_etapas where id = v_id and empresa_id = eu.empresa_id for update;
    if not found then raise exception 'Etapa não encontrada.'; end if;
    perform public.pode_mexer_na_etapa(e);
    update public.cronograma_etapas set nome = p ->> 'nome', inicio = (p ->> 'inicio')::date, fim = (p ->> 'fim')::date, responsavel_id = (p ->> 'responsavel_id')::uuid
     where id = v_id returning * into e;
  end if;
  return e.id;
end $f$;

create or replace function public.excluir_etapa(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros; e public.cronograma_etapas;
begin
  select * into e from public.cronograma_etapas where id = p_id;
  if not found then raise exception 'Etapa não encontrada.'; end if;
  eu := public.monto_o_cronograma(e.obra_id);
  delete from public.cronograma_etapas where id = p_id;
end $f$;

-- A ordem nova: a lista inteira dos ids da obra.
create or replace function public.ordenar_etapas(p_obra uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros;
begin
  eu := public.monto_o_cronograma(p_obra);
  if (select count(*) from public.cronograma_etapas where obra_id = p_obra) <> cardinality(p_ids)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.cronograma_etapas where id = x and obra_id = p_obra)) then
    raise exception 'A lista de etapas não confere com a obra.';
  end if;
  update public.cronograma_etapas e set ordem = x.n - 1 from unnest(p_ids) with ordinality as x(id, n) where e.id = x.id;
end $f$;

-- Começar com um modelo (modelos_cronograma, fatia 2): as etapas dividem o período da obra na proporção do modelo (js/obras.js distribuir()).
create or replace function public.aplicar_modelo(p_obra uuid, p_modelo uuid) returns integer
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros; o public.obras; m public.modelos_cronograma; total int; soma numeric; acumulado numeric := 0; dia int := 0; fim_dia int; n int := 0; e jsonb; qtd int;
begin
  eu := public.monto_o_cronograma(p_obra);
  select * into o from public.obras where id = p_obra;
  select * into m from public.modelos_cronograma where id = p_modelo and empresa_id = eu.empresa_id;
  if m.id is null then raise exception 'Modelo não encontrado.'; end if;
  if exists (select 1 from public.cronograma_etapas where obra_id = p_obra) then raise exception 'O cronograma desta obra já tem etapas.'; end if;
  total := (o.prazo - o.inicio) + 1;
  select sum((x ->> 'pct')::numeric), count(*) into soma, qtd from jsonb_array_elements(m.etapas) x;
  if coalesce(soma, 0) = 0 then soma := 1; end if;
  for e in select x from jsonb_array_elements(m.etapas) x loop
    acumulado := acumulado + (e ->> 'pct')::numeric;
    fim_dia := case when n = qtd - 1 then total - 1 else round(acumulado / soma * total)::int - 1 end;
    fim_dia := greatest(dia, least(fim_dia, total - 1));
    insert into public.cronograma_etapas (empresa_id, obra_id, nome, inicio, fim, ordem)
    values (eu.empresa_id, p_obra, e ->> 'nome', o.inicio + least(dia, total - 1), o.inicio + fim_dia, n);
    dia := least(fim_dia + 1, total - 1);
    n := n + 1;
  end loop;
  perform public.nova_linha_base(p_obra, 'Primeira versão do cronograma (modelo ' || m.nome || ')');
  return n;
end $f$;

-- % à mão (fonte manual). A regra de quem travou vale aqui também.
create or replace function public.registrar_avanco(p_etapa uuid, p_pct integer, p_data date default null) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros; e public.cronograma_etapas;
begin
  select * into e from public.cronograma_etapas where id = p_etapa;
  if not found then raise exception 'Etapa não encontrada.'; end if;
  eu := public.monto_o_cronograma(e.obra_id);
  if p_pct is null or p_pct < 0 or p_pct > 100 then raise exception 'O %% concluído vai de 0 a 100.'; end if;
  perform public.pode_mexer_na_etapa(e);
  insert into public.etapa_avancos (empresa_id, etapa_id, data, antes, pct, fonte, por, por_nome)
  values (e.empresa_id, e.id, coalesce(p_data, public.hoje_da_empresa(e.empresa_id)), e.pct, p_pct, 'manual', auth.uid(), eu.nome);
end $f$;

create or replace function public.nova_linha_base(p_obra uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros; v uuid;
begin
  eu := public.monto_o_cronograma(p_obra);
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'O motivo é obrigatório: fica no histórico.'; end if;
  if not exists (select 1 from public.cronograma_etapas where obra_id = p_obra) then raise exception 'O cronograma ainda não tem etapas.'; end if;
  insert into public.linhas_base (empresa_id, obra_id, motivo, etapas, por, por_nome)
  select eu.empresa_id, p_obra, btrim(p_motivo), jsonb_object_agg(e.id, jsonb_build_object('inicio', e.inicio, 'fim', e.fim)), eu.id, eu.nome
    from public.cronograma_etapas e where e.obra_id = p_obra
  returning id into v;
  return v;
end $f$;

-- ---------- Publicar (CR-09) e receber (BD-03) ----------

create or replace function public.retrato_do_cronograma(p_obra uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object(
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'inicio', e.inicio, 'fim', e.fim, 'pct', e.pct, 'responsavelId', e.responsavel_id) order by e.ordem, e.criado_em)
                        from public.cronograma_etapas e where e.obra_id = p_obra), '[]'::jsonb),
    'bases', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'em', b.em, 'por', b.por_nome, 'motivo', b.motivo, 'etapas', b.etapas))
                       from (select * from public.linhas_base where obra_id = p_obra order by em desc, id desc limit 1) b), '[]'::jsonb),
    'responsaveis', coalesce((select jsonb_object_agg(m.id, m.nome) from public.cronograma_etapas e join public.membros m on m.id = e.responsavel_id where e.obra_id = p_obra), '{}'::jsonb))
$f$;

create or replace function public.publicar_cronograma(p_obra uuid) returns integer
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros; o public.obras; emp public.empresas; v int;
begin
  eu := public.monto_o_cronograma(p_obra);
  select * into o from public.obras where id = p_obra;
  if not exists (select 1 from public.cronograma_etapas where obra_id = p_obra) then raise exception 'O cronograma ainda não tem etapas.'; end if;
  if o.vinculo_empresa_id is null or o.vinculo_obra_id is null then raise exception 'Esta obra não está ligada a uma obra do contratante.'; end if;
  select * into emp from public.empresas where id = eu.empresa_id;
  perform 1 from public.obras where id = p_obra for update;   -- numeração sem corrida
  v := coalesce((select max(versao) from public.publicacoes_cronograma where obra_id = p_obra), 0) + 1;
  insert into public.publicacoes_cronograma (de_empresa_id, obra_id, para_empresa_id, para_obra_id, versao, retrato, por, por_nome)
  values (eu.empresa_id, p_obra, o.vinculo_empresa_id, o.vinculo_obra_id, v,
          jsonb_build_object('de', jsonb_build_object('empresaId', emp.id, 'nome', emp.nome, 'sigla', emp.sigla, 'telefone', emp.telefone, 'email', emp.email),
                             'obraNome', o.nome, 'cronograma', public.retrato_do_cronograma(p_obra) - 'responsaveis', 'responsaveis', public.retrato_do_cronograma(p_obra) -> 'responsaveis'),
          eu.id, eu.nome);
  return v;
end $f$;

-- A contratante: as publicações das prestadoras nas obras ligadas à dela (todas as versões; o app mostra a última).
create or replace function public.cronogramas_recebidos(p_obra uuid default null) returns setof jsonb
language sql stable security definer set search_path to 'public' as $f$
  select to_jsonb(p) - 'por' || jsonb_build_object('de_obra_id', p.obra_id)
    from public.publicacoes_cronograma p
   where p.para_empresa_id = public.minha_empresa() and (p_obra is null or p.para_obra_id = p_obra)
     and public.tenho_permissao('daily.acompanhar')
   order by p.em desc, p.versao desc
$f$;

-- ---------- O RDO aprovado leva o andamento ao cronograma (CR-04; o item que ficou da fatia 3) ----------

create or replace function public.aprovar_rdo(p_id uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); r public.rdos; v_hash text; a jsonb; e public.cronograma_etapas; n int := 0;
begin
  select * into r from public.rdos where id = p_id for update;
  if not found or eu.id is null or not public.aprovo_o_rdo(r) then raise exception 'Sem permissão para aprovar este diário.'; end if;
  if r.status = 'aprovado' then return jsonb_build_object('id', r.id, 'status', r.status, 'codigo', r.codigo); end if;
  if r.status <> 'enviado' then raise exception 'Só um diário enviado pode ser aprovado.'; end if;
  perform set_config('kb.rdo_funcao', '1', true);
  update public.rdos set aprovado_em = date_trunc('second', now()), aprovado_por = eu.nome,
         aprovado_por_empresa = (select nome from public.empresas where id = eu.empresa_id), versao = versao + 1
   where id = p_id returning * into r;
  v_hash := encode(extensions.digest(public.texto_do_lacre(r), 'sha256'), 'hex');
  update public.rdos set status = 'aprovado', hash_documento = v_hash,
         codigo = upper(substr(v_hash, 1, 4) || '-' || substr(v_hash, 5, 4) || '-' || substr(v_hash, 9, 4))
   where id = p_id returning * into r;
  perform public.registrar_no_rdo(r, 'Aprovou · código ' || r.codigo || case when eu.empresa_id <> r.empresa_id then ' (' || r.aprovado_por_empresa || ')' else '' end);
  -- cada atividade que aponta uma etapa do cronograma (da empresa que fez o diário) vira um avanço, com quem aprovou
  for a in select x from jsonb_array_elements(coalesce(r.conteudo -> 'atividades', '[]'::jsonb)) x
            where coalesce(x ->> 'cronoEtapaId', '') <> '' and coalesce(x ->> 'cronoPct', '') ~ '^\d+(\.\d+)?$' loop
    select * into e from public.cronograma_etapas where id = (a ->> 'cronoEtapaId')::uuid and obra_id = r.obra_id;
    if e.id is null then continue; end if;
    insert into public.etapa_avancos (empresa_id, etapa_id, data, antes, pct, fonte, rdo_id, rdo_numero, por, por_nome)
    values (e.empresa_id, e.id, r.data, e.pct, least(100, greatest(0, round((a ->> 'cronoPct')::numeric)))::int, 'rdo', r.id, r.numero, auth.uid(), eu.nome);
    n := n + 1;
  end loop;
  return jsonb_build_object('id', r.id, 'status', r.status, 'codigo', r.codigo, 'hash', r.hash_documento, 'etapas', n);
end $f$;

-- ---------- Permissões das funções ----------

revoke all on function public.guarda_etapa(), public.guarda_etapa_insert(), public.guarda_so_insert_cron(), public.aplicar_avanco(), public.auditar_publicacao(),
  public.quem_travou_a_etapa(uuid), public.monto_o_cronograma(uuid), public.pode_mexer_na_etapa(public.cronograma_etapas), public.retrato_do_cronograma(uuid)
  from public, anon, authenticated;
revoke all on function public.salvar_etapa(jsonb), public.excluir_etapa(uuid), public.ordenar_etapas(uuid, uuid[]), public.aplicar_modelo(uuid, uuid),
  public.registrar_avanco(uuid, integer, date), public.nova_linha_base(uuid, text), public.publicar_cronograma(uuid), public.cronogramas_recebidos(uuid)
  from public, anon;
grant execute on function public.salvar_etapa(jsonb), public.excluir_etapa(uuid), public.ordenar_etapas(uuid, uuid[]), public.aplicar_modelo(uuid, uuid),
  public.registrar_avanco(uuid, integer, date), public.nova_linha_base(uuid, text), public.publicar_cronograma(uuid), public.cronogramas_recebidos(uuid)
  to authenticated;

commit;
