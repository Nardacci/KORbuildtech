-- KORbuild · fatia 3 do banco (docs/banco.md §4 e §10): o Daily.
-- Diários (rdos), fotos (rdo_fotos + Storage "diarios") e histórico; tudo o que muda a situação do diário passa por
-- funções do banco, que conferem quem pode:
--   · preencher: quem tem daily.preencher, em qualquer obra da empresa (decisão de outubro de 2026);
--   · aprovar e pedir ajustes: obra sem vínculo, a própria empresa (HS-13); obra com vínculo, só a contratante (HS-11),
--     sempre com daily.aprovar;
--   · aprovado = lacrado: o banco calcula o hash (SHA-256) e o código, e depois disso nada muda nem sai;
--   · sem internet (BD-08): ids gerados no aparelho, repetir o envio não duplica; cada gravação leva a versão que o
--     aparelho conhecia, e outra versão no banco (outro aparelho) é recusada como conflito;
--   · a contratante lê os diários enviados das prestadoras só por diarios_recebidos() (BD-03);
--   · o link do cliente (sem login) lê só o diário aprovado daquele código, por diario_por_codigo().
-- Fica para depois: equipe vinda do ponto (fatia 4), andamento no cronograma (fatia 5), lembretes por e-mail (fatia 8).
-- Só CRIA; não apaga nada. Rodar este arquivo e depois supabase/testes/0003_daily.sql.

begin;

-- ---------- Tabelas ----------

create table public.rdos (
  id uuid primary key default gen_random_uuid(),       -- normalmente gerado no aparelho
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  obra_id uuid not null,
  data date not null,
  numero integer not null,                               -- sequência por obra, dada pelo banco
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'ajustes', 'aprovado')),
  autor_id uuid,                                         -- o membro que começou o diário
  autor_nome text not null default '',
  conteudo jsonb not null default '{}'::jsonb,           -- clima, equipe, equipamentos, atividades, ocorrências, observações
  sem_atividade jsonb,                                   -- {motivo, obs} quando o dia foi registrado sem atividade
  motivo_ajuste text,
  versao integer not null default 1,
  criado_no_aparelho_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  enviado_em timestamptz, primeiro_envio_em timestamptz,
  aprovado_em timestamptz, aprovado_por text, aprovado_por_empresa text,
  hash_documento text, codigo text unique,
  unique (obra_id, data),
  unique (obra_id, numero),
  unique (empresa_id, id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id),
  check (jsonb_typeof(conteudo) = 'object')
);
create index rdos_obra on public.rdos (empresa_id, obra_id, data desc);
create index rdos_status on public.rdos (status) where status <> 'aprovado';

create table public.rdo_fotos (
  id uuid primary key,                                   -- gerado no aparelho
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  rdo_id uuid not null,
  path text not null, path_mini text,
  legenda text not null default '',
  tirada_em timestamptz, lat double precision, lon double precision, fonte_gps text, precisao integer,
  largura integer, altura integer, tamanho integer, hash_original text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  foreign key (empresa_id, rdo_id) references public.rdos (empresa_id, id) on delete cascade
);
create index rdo_fotos_rdo on public.rdo_fotos (rdo_id, ordem);

create table public.rdo_historico (
  id uuid primary key default gen_random_uuid(),         -- gerado no aparelho quando a ação foi lá
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  rdo_id uuid not null,
  em timestamptz not null default now(),
  quem text not null default '',
  acao text not null,
  foreign key (empresa_id, rdo_id) references public.rdos (empresa_id, id) on delete cascade
);
create index rdo_historico_rdo on public.rdo_historico (rdo_id, em);

-- ---------- Guardas ----------

-- O diário aprovado é lacrado; as colunas da situação só mudam pelas funções (que ligam kb.rdo_funcao nesta transação).
create or replace function public.guarda_rdo() returns trigger
language plpgsql as $f$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.empresas where id = old.empresa_id) then return old; end if;  -- empresa saindo (cascata)
    if old.status = 'aprovado' then raise exception 'O diário aprovado é lacrado: não pode ser apagado.'; end if;
    if coalesce(current_setting('kb.rdo_funcao', true), '') <> '1' then raise exception 'O diário só sai pelas funções do Daily.'; end if;
    return old;
  end if;
  if old.status = 'aprovado' then raise exception 'O diário aprovado é lacrado: não pode ser alterado.'; end if;
  if coalesce(current_setting('kb.rdo_funcao', true), '') <> '1' then
    raise exception 'O diário só muda pelas funções do Daily.';
  end if;
  if new.empresa_id <> old.empresa_id or new.obra_id <> old.obra_id or new.data <> old.data or new.numero <> old.numero then
    raise exception 'Não é possível trocar a empresa, a obra, a data ou o número de um diário.';
  end if;
  new.atualizado_em := now();
  return new;
end $f$;
create trigger rdos_guarda before update or delete on public.rdos for each row execute function public.guarda_rdo();

-- Fotos e histórico de diário aprovado também não mudam (o histórico só recebe linhas novas).
create or replace function public.guarda_filhos_rdo() returns trigger
language plpgsql as $f$
declare v_rdo uuid := coalesce(new.rdo_id, old.rdo_id);
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.empresas where id = old.empresa_id) then return old; end if;
  if tg_table_name = 'rdo_historico' and tg_op <> 'INSERT' then raise exception 'O histórico do diário só recebe linhas novas.'; end if;
  if tg_table_name = 'rdo_fotos' and (select status from public.rdos where id = v_rdo) = 'aprovado' then
    raise exception 'O diário aprovado é lacrado: as fotos não mudam.';
  end if;
  return coalesce(new, old);
end $f$;
create trigger rdo_fotos_guarda before insert or update or delete on public.rdo_fotos for each row execute function public.guarda_filhos_rdo();
create trigger rdo_historico_guarda before update or delete on public.rdo_historico for each row execute function public.guarda_filhos_rdo();

create trigger rdos_auditar after insert or update on public.rdos for each row execute function public.auditar();

-- ---------- Leitura (RLS): só a própria empresa, com alguma permissão do Daily ----------

create or replace function public.vejo_o_daily() returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select public.tenho_permissao('daily.preencher') or public.tenho_permissao('daily.acompanhar') or public.tenho_permissao('daily.aprovar')
$f$;

alter table public.rdos enable row level security;
alter table public.rdo_fotos enable row level security;
alter table public.rdo_historico enable row level security;
create policy rdos_ler on public.rdos for select to authenticated using (empresa_id = public.minha_empresa() and public.vejo_o_daily());
create policy rdo_fotos_ler on public.rdo_fotos for select to authenticated using (empresa_id = public.minha_empresa() and public.vejo_o_daily());
create policy rdo_historico_ler on public.rdo_historico for select to authenticated using (empresa_id = public.minha_empresa() and public.vejo_o_daily());

-- O app só lê; gravar é pelas funções abaixo.
revoke all on public.rdos, public.rdo_fotos, public.rdo_historico from anon, authenticated;
grant select on public.rdos, public.rdo_fotos, public.rdo_historico to authenticated;

-- ---------- Apoio ----------

create or replace function public.meu_membro() returns public.membros
language sql stable security definer set search_path to 'public' as $f$
  select * from public.membros where user_id = auth.uid() and ativo
$f$;

-- Pode aprovar este diário? Obra sem vínculo: a própria empresa; com vínculo: só a contratante. Sempre com daily.aprovar.
create or replace function public.aprovo_o_rdo(p_rdo public.rdos) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select public.tenho_permissao('daily.aprovar') and public.minha_empresa() = coalesce(
    (select o.vinculo_empresa_id from public.obras o where o.id = p_rdo.obra_id), p_rdo.empresa_id)
$f$;

-- Instante em texto fixo, em UTC: o lacre não pode depender do fuso horário de quem confere.
create or replace function public.instante_utc(t timestamptz) returns text
language sql immutable as $f$ select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') $f$;

-- O texto que o lacre assina (o mesmo conteúdo de js/lacre.js): obra, número, data, autor, conteúdo, fotos, envio e aprovação.
create or replace function public.texto_do_lacre(p_rdo public.rdos) returns text
language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object(
    'obra', (select jsonb_build_object('id', o.id, 'nome', o.nome, 'endereco', o.endereco, 'municipio', o.municipio, 'estado', o.estado) from public.obras o where o.id = p_rdo.obra_id),
    'rdo', p_rdo.numero, 'data', p_rdo.data, 'autor', p_rdo.autor_nome,
    'conteudo', p_rdo.conteudo, 'sem_atividade', p_rdo.sem_atividade,
    'fotos', coalesce((select jsonb_agg(jsonb_build_array(f.hash_original, f.legenda, public.instante_utc(f.tirada_em), f.lat, f.lon) order by f.ordem, f.id)
                       from public.rdo_fotos f where f.rdo_id = p_rdo.id), '[]'::jsonb),
    'primeiro_envio_em', public.instante_utc(p_rdo.primeiro_envio_em),
    'aprovado_por', p_rdo.aprovado_por, 'aprovado_por_empresa', p_rdo.aprovado_por_empresa, 'aprovado_em', public.instante_utc(p_rdo.aprovado_em)
  )::text
$f$;

-- Linhas do histórico vindas do aparelho ([{id, em, quem, acao}]); repetir não duplica.
create or replace function public.gravar_historico(p_rdo public.rdos, p jsonb) returns void
language plpgsql security definer set search_path to 'public' as $f$
begin
  insert into public.rdo_historico (id, empresa_id, rdo_id, em, quem, acao)
  select coalesce((h ->> 'id')::uuid, gen_random_uuid()), p_rdo.empresa_id, p_rdo.id, coalesce((h ->> 'em')::timestamptz, now()),
         coalesce(h ->> 'quem', ''), h ->> 'acao'
    from jsonb_array_elements(coalesce(p, '[]'::jsonb)) h
   where coalesce(btrim(h ->> 'acao'), '') <> ''
  on conflict (id) do nothing;
end $f$;

create or replace function public.registrar_no_rdo(p_rdo public.rdos, p_acao text) returns void
language sql security definer set search_path to 'public' as $f$
  insert into public.rdo_historico (empresa_id, rdo_id, quem, acao) values (p_rdo.empresa_id, p_rdo.id, coalesce((public.meu_membro()).nome, ''), p_acao)
$f$;

-- ---------- Preencher (quem tem daily.preencher, em qualquer obra da empresa) ----------

-- Grava o diário inteiro (criar ou editar o rascunho), as fotos e o histórico que vieram do aparelho.
-- p: {id, obra_id, data, versao (a que o aparelho conhecia; null = novo), conteudo, criado_no_aparelho_em, fotos: [...], historico: [...]}
-- Devolve {id, numero, versao, status}. Outra versão no banco = conflito ("KB_CONFLITO").
create or replace function public.salvar_rdo(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare
  eu public.membros := public.meu_membro();
  v_id uuid := coalesce((p ->> 'id')::uuid, gen_random_uuid());
  v_obra uuid := (p ->> 'obra_id')::uuid;
  v_data date := (p ->> 'data')::date;
  r public.rdos;
begin
  if eu.id is null then raise exception 'Entre com um usuário ativo da empresa.'; end if;
  if not public.tenho_permissao('daily.preencher') then raise exception 'Sem permissão para preencher o diário.'; end if;
  perform set_config('kb.rdo_funcao', '1', true);
  select * into r from public.rdos where id = v_id for update;
  if found then
    if r.empresa_id <> eu.empresa_id then raise exception 'Diário de outra empresa.'; end if;
    if r.status not in ('rascunho', 'ajustes') then raise exception 'Este diário já foi enviado: só muda se o escritório pedir ajustes.'; end if;
    if (p ->> 'versao')::int is distinct from r.versao then
      raise exception 'KB_CONFLITO: o diário mudou em outro aparelho (versão %).', r.versao using errcode = 'P0409';
    end if;
    update public.rdos set conteudo = coalesce(p -> 'conteudo', conteudo), versao = versao + 1 where id = v_id returning * into r;
  else
    if not exists (select 1 from public.obras where id = v_obra and empresa_id = eu.empresa_id) then raise exception 'Obra não encontrada.'; end if;
    if v_data is null or v_data > public.hoje_da_empresa(eu.empresa_id) + 1 then raise exception 'Data do diário inválida.'; end if;
    if exists (select 1 from public.rdos where obra_id = v_obra and data = v_data) then
      raise exception 'Já existe o diário deste dia nesta obra.' using errcode = 'P0409';
    end if;
    perform 1 from public.obras where id = v_obra for update;   -- numeração sem corrida
    insert into public.rdos (id, empresa_id, obra_id, data, numero, autor_id, autor_nome, conteudo, criado_no_aparelho_em)
    values (v_id, eu.empresa_id, v_obra, v_data, coalesce((select max(numero) from public.rdos where obra_id = v_obra), 0) + 1,
            eu.id, eu.nome, coalesce(p -> 'conteudo', '{}'::jsonb), (p ->> 'criado_no_aparelho_em')::timestamptz)
    returning * into r;
  end if;
  -- fotos: as que vieram ficam (repetir não duplica); as que sumiram da lista saem
  if p ? 'fotos' then
    delete from public.rdo_fotos where rdo_id = r.id and id not in (select (f ->> 'id')::uuid from jsonb_array_elements(p -> 'fotos') f);
    insert into public.rdo_fotos (id, empresa_id, rdo_id, path, path_mini, legenda, tirada_em, lat, lon, fonte_gps, precisao, largura, altura, tamanho, hash_original, ordem)
    select (f ->> 'id')::uuid, r.empresa_id, r.id, f ->> 'path', f ->> 'path_mini', coalesce(f ->> 'legenda', ''), (f ->> 'tirada_em')::timestamptz,
           (f ->> 'lat')::double precision, (f ->> 'lon')::double precision, f ->> 'fonte_gps', (f ->> 'precisao')::int,
           (f ->> 'largura')::int, (f ->> 'altura')::int, (f ->> 'tamanho')::int, f ->> 'hash_original', o - 1
      from jsonb_array_elements(p -> 'fotos') with ordinality as x(f, o)
     where coalesce(f ->> 'path', '') like r.empresa_id || '/' || r.obra_id || '/' || r.id || '/%'
    on conflict (id) do update set legenda = excluded.legenda, ordem = excluded.ordem;
  end if;
  perform public.gravar_historico(r, p -> 'historico');
  return jsonb_build_object('id', r.id, 'numero', r.numero, 'versao', r.versao, 'status', r.status);
end $f$;

-- Envia (ou reenvia depois dos ajustes). Confere as mesmas pendências do app.
create or replace function public.enviar_rdo(p_id uuid, p_versao int) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); r public.rdos; v_reenvio boolean;
begin
  if eu.id is null or not public.tenho_permissao('daily.preencher') then raise exception 'Sem permissão para enviar o diário.'; end if;
  perform set_config('kb.rdo_funcao', '1', true);
  select * into r from public.rdos where id = p_id and empresa_id = eu.empresa_id for update;
  if not found then raise exception 'Diário não encontrado.'; end if;
  if r.status = 'enviado' then return jsonb_build_object('id', r.id, 'versao', r.versao, 'status', r.status); end if;  -- repetido (sem sinal)
  if r.status not in ('rascunho', 'ajustes') then raise exception 'Este diário não pode ser enviado agora.'; end if;
  if p_versao is distinct from r.versao then raise exception 'KB_CONFLITO: o diário mudou em outro aparelho (versão %).', r.versao using errcode = 'P0409'; end if;
  if r.sem_atividade is null and (
       coalesce(r.conteudo #>> '{clima,manha,tempo}', '') = '' or coalesce(r.conteudo #>> '{clima,tarde,tempo}', '') = ''
       or not exists (select 1 from jsonb_array_elements(coalesce(r.conteudo -> 'equipe', '[]')) e where coalesce((e ->> 'presentes')::numeric, 0) > 0)
       or not exists (select 1 from jsonb_array_elements(coalesce(r.conteudo -> 'atividades', '[]')) a where btrim(coalesce(a ->> 'descricao', '')) <> '')) then
    raise exception 'Para enviar, preencha o clima da manhã e da tarde, pelo menos uma pessoa na equipe e uma atividade.';
  end if;
  v_reenvio := r.status = 'ajustes';
  update public.rdos set status = 'enviado', enviado_em = now(), primeiro_envio_em = coalesce(primeiro_envio_em, now()), motivo_ajuste = null, versao = versao + 1
   where id = p_id returning * into r;
  perform public.registrar_no_rdo(r, case when v_reenvio then 'Reenviou com os ajustes' else 'Enviou para aprovação' end);
  return jsonb_build_object('id', r.id, 'versao', r.versao, 'status', r.status);
end $f$;

-- Dia sem atividade: vira o diário do dia, já enviado. p: {id, obra_id, data, motivo, obs, criado_no_aparelho_em}
create or replace function public.dia_sem_atividade(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); r public.rdos; v_obra uuid := (p ->> 'obra_id')::uuid; v_data date := (p ->> 'data')::date;
begin
  if eu.id is null or not public.tenho_permissao('daily.preencher') then raise exception 'Sem permissão para registrar o dia.'; end if;
  if btrim(coalesce(p ->> 'motivo', '')) = '' then raise exception 'Escolha o motivo.'; end if;
  perform set_config('kb.rdo_funcao', '1', true);
  select * into r from public.rdos where id = (p ->> 'id')::uuid;
  if found then return jsonb_build_object('id', r.id, 'numero', r.numero, 'versao', r.versao, 'status', r.status); end if;  -- repetido
  if not exists (select 1 from public.obras where id = v_obra and empresa_id = eu.empresa_id) then raise exception 'Obra não encontrada.'; end if;
  if exists (select 1 from public.rdos where obra_id = v_obra and data = v_data) then raise exception 'Já existe o diário deste dia nesta obra.' using errcode = 'P0409'; end if;
  perform 1 from public.obras where id = v_obra for update;
  insert into public.rdos (id, empresa_id, obra_id, data, numero, status, autor_id, autor_nome, sem_atividade, criado_no_aparelho_em, enviado_em, primeiro_envio_em)
  values (coalesce((p ->> 'id')::uuid, gen_random_uuid()), eu.empresa_id, v_obra, v_data,
          coalesce((select max(numero) from public.rdos where obra_id = v_obra), 0) + 1, 'enviado', eu.id, eu.nome,
          jsonb_build_object('motivo', btrim(p ->> 'motivo'), 'obs', btrim(coalesce(p ->> 'obs', ''))), (p ->> 'criado_no_aparelho_em')::timestamptz, now(), now())
  returning * into r;
  perform public.registrar_no_rdo(r, 'Registrou dia sem atividade: ' || btrim(p ->> 'motivo'));
  return jsonb_build_object('id', r.id, 'numero', r.numero, 'versao', r.versao, 'status', r.status);
end $f$;

-- ---------- Aprovar (a própria empresa, ou a contratante quando a obra tem vínculo) ----------

create or replace function public.aprovar_rdo(p_id uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); r public.rdos; v_hash text;
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
  return jsonb_build_object('id', r.id, 'status', r.status, 'codigo', r.codigo, 'hash', r.hash_documento);
end $f$;

create or replace function public.pedir_ajustes(p_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); r public.rdos;
begin
  select * into r from public.rdos where id = p_id for update;
  if not found or eu.id is null or not public.aprovo_o_rdo(r) then raise exception 'Sem permissão para pedir ajustes neste diário.'; end if;
  if r.status <> 'enviado' then raise exception 'Só um diário enviado pode voltar para ajustes.'; end if;
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Escreva o que precisa ser corrigido.'; end if;
  perform set_config('kb.rdo_funcao', '1', true);
  update public.rdos set status = 'ajustes', motivo_ajuste = btrim(p_motivo), versao = versao + 1 where id = p_id returning * into r;
  perform public.registrar_no_rdo(r, 'Pediu ajustes: ' || btrim(p_motivo));
  return jsonb_build_object('id', r.id, 'versao', r.versao, 'status', r.status);
end $f$;

-- O lacre ainda confere? (true = o conteúdo gravado é o mesmo que foi aprovado)
create or replace function public.lacre_confere(p_id uuid) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select r.hash_documento = encode(extensions.digest(public.texto_do_lacre(r), 'sha256'), 'hex') from public.rdos r where r.id = p_id
$f$;

-- ---------- Entre empresas e link do cliente ----------

-- O diário completo, como o app usa (com fotos, histórico, obra e empresa).
create or replace function public.rdo_completo(p_rdo public.rdos) returns jsonb
language sql stable security definer set search_path to 'public' as $f$
  select to_jsonb(p_rdo) || jsonb_build_object(
    'fotos', coalesce((select jsonb_agg(to_jsonb(f) order by f.ordem, f.id) from public.rdo_fotos f where f.rdo_id = p_rdo.id), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(to_jsonb(h) order by h.em) from public.rdo_historico h where h.rdo_id = p_rdo.id), '[]'::jsonb),
    'obra', (select jsonb_build_object('id', o.id, 'nome', o.nome, 'endereco', o.endereco, 'municipio', o.municipio, 'estado', o.estado, 'zip', o.zip,
                                       'vinculo_obra_id', o.vinculo_obra_id) from public.obras o where o.id = p_rdo.obra_id),
    'empresa', (select jsonb_build_object('id', e.id, 'nome', e.nome, 'logo_path', e.logo_path) from public.empresas e where e.id = p_rdo.empresa_id))
$f$;

-- A contratante lê os diários enviados das prestadoras nas obras ligadas às dela (HS-11; BD-03). p_obra = a obra dela.
create or replace function public.diarios_recebidos(p_obra uuid default null) returns setof jsonb
language sql stable security definer set search_path to 'public' as $f$
  select public.rdo_completo(r)
    from public.rdos r join public.obras o on o.id = r.obra_id
   where o.vinculo_empresa_id = public.minha_empresa()
     and (p_obra is null or o.vinculo_obra_id = p_obra)
     and r.status <> 'rascunho'
     and (public.tenho_permissao('daily.acompanhar') or public.tenho_permissao('daily.aprovar'))
   order by r.data desc, r.numero desc
$f$;

-- Link do cliente (sem login): só o diário aprovado daquele código, com a conferência do lacre. As fotos saem por
-- links temporários assinados pela função de borda diario-publico (supabase/functions/diario-publico).
create or replace function public.diario_por_codigo(p_codigo text) returns jsonb
language sql stable security definer set search_path to 'public' as $f$
  select public.rdo_completo(r) - 'historico' - 'autor_id' - 'versao' || jsonb_build_object('lacre_confere', public.lacre_confere(r.id))
    from public.rdos r where r.codigo = upper(btrim(p_codigo)) and r.status = 'aprovado'
$f$;

-- ---------- Fotos no Storage (bucket privado "diarios": {empresa}/{obra}/{rdo}/{foto}.jpg) ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diarios', 'diarios', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

-- A pasta do diário é de um diário que esta empresa ainda pode mexer (rascunho ou ajustes)?
create or replace function public.posso_gravar_foto(p_nome text) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select public.tenho_permissao('daily.preencher')
     and (storage.foldername(p_nome))[1] = public.minha_empresa()::text
     and not exists (select 1 from public.rdos r where r.id::text = (storage.foldername(p_nome))[3] and r.status not in ('rascunho', 'ajustes'))
$f$;
-- Vê a foto: da própria empresa (com permissão do Daily), ou de um diário enviado a ela por uma prestadora (HS-11).
create or replace function public.posso_ver_foto(p_nome text) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select ((storage.foldername(p_nome))[1] = public.minha_empresa()::text and public.vejo_o_daily())
      or exists (select 1 from public.rdos r join public.obras o on o.id = r.obra_id
                  where r.id::text = (storage.foldername(p_nome))[3] and r.empresa_id::text = (storage.foldername(p_nome))[1]
                    and o.vinculo_empresa_id = public.minha_empresa() and r.status <> 'rascunho'
                    and (public.tenho_permissao('daily.acompanhar') or public.tenho_permissao('daily.aprovar')))
$f$;

create policy diarios_ler on storage.objects for select to authenticated using (bucket_id = 'diarios' and public.posso_ver_foto(name));
create policy diarios_gravar on storage.objects for insert to authenticated with check (bucket_id = 'diarios' and public.posso_gravar_foto(name));
create policy diarios_apagar on storage.objects for delete to authenticated using (bucket_id = 'diarios' and public.posso_gravar_foto(name));

-- ---------- Permissões das funções ----------

revoke all on function public.guarda_rdo(), public.guarda_filhos_rdo(), public.gravar_historico(public.rdos, jsonb), public.registrar_no_rdo(public.rdos, text),
  public.texto_do_lacre(public.rdos), public.rdo_completo(public.rdos), public.meu_membro(), public.aprovo_o_rdo(public.rdos) from public, anon, authenticated;
revoke all on function public.salvar_rdo(jsonb), public.enviar_rdo(uuid, int), public.dia_sem_atividade(jsonb), public.aprovar_rdo(uuid),
  public.pedir_ajustes(uuid, text), public.lacre_confere(uuid), public.diarios_recebidos(uuid), public.vejo_o_daily(),
  public.posso_gravar_foto(text), public.posso_ver_foto(text), public.diario_por_codigo(text) from public, anon;
grant execute on function public.salvar_rdo(jsonb), public.enviar_rdo(uuid, int), public.dia_sem_atividade(jsonb), public.aprovar_rdo(uuid),
  public.pedir_ajustes(uuid, text), public.lacre_confere(uuid), public.diarios_recebidos(uuid), public.vejo_o_daily(),
  public.posso_gravar_foto(text), public.posso_ver_foto(text) to authenticated;
grant execute on function public.diario_por_codigo(text) to anon, authenticated;

commit;
