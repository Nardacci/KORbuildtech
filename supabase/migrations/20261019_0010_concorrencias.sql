-- KORbuild · fatia 7 do banco (docs/banco.md §6 e §14): as concorrências (bid) e o canal entre contratante e contratada.
-- É o único lugar onde duas empresas escrevem no mesmo registro (a contratante monta e fecha; as convidadas respondem,
-- perguntam e mandam proposta; uma delas pode nem ter conta: o link, CO-07). Por isso, depois de enviada, nada muda por
-- gravação direta: toda ação passa por função do banco, que confere de que lado está quem chama e devolve só o combinado.
--   · as tabelas são da contratante (empresa_id); só quem tem concorrencias.gerir lê e, no rascunho, grava direto;
--   · a convidada nunca lê as tabelas: concorrencias_recebidas() entrega só o próprio convite, as próprias propostas e
--     as mensagens da própria conversa ou públicas (CO-04, CO-22); pelo link, convite_por_token() (só a função de borda);
--   · propostas, mensagens e histórico só entram (CO-05); o prazo vale (CO-10); fechar sela o vínculo (CO-06, CO-14):
--     criar_obra_da_concorrencia() é a única que grava obras.vinculo_* e obras.concorrencia_id;
--   · a quarteirização (CO-23, CO-24, CO-25) e o canal (§5) com as mesmas regras do protótipo (js/concorrencias.js).
-- Só CRIA (e acrescenta projetos.concorrencia); não apaga nada. Rodar e depois supabase/testes/0008_concorrencias.sql.

begin;

-- ---------- Apoio ----------

create or replace function public.giro_concorrencias() returns boolean
language sql stable security definer set search_path to 'public' as $f$ select public.tenho_permissao('concorrencias.gerir') $f$;
create or replace function public.respondo_concorrencias() returns boolean
language sql stable security definer set search_path to 'public' as $f$ select public.tenho_permissao('concorrencias.responder') $f$;
-- as funções desta fatia marcam a transação para os gatilhos deixarem passar o que só elas mudam
create or replace function public.em_funcao_de_concorrencia() returns boolean
language sql stable as $f$ select coalesce(current_setting('kb.conc_funcao', true), '') = '1' $f$;

-- ---------- Concorrências (da contratante) ----------

create table public.concorrencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,   -- a contratante
  origem_tipo text not null default 'obra' check (origem_tipo in ('obra', 'projeto')),
  obra_id uuid,                                           -- a obra da contratante (com origem projeto, só ao fechar: CO-24)
  projeto_id uuid,                                        -- o projeto do Measure de onde saiu (quarteirização antes de ganhar)
  pai_id uuid references public.concorrencias (id) on delete set null,   -- a concorrência de cima (a que a contratante ganhou)
  servico text not null default '',
  etapas text[] not null default '{}',
  incluso text[] not null default '{}', excluso text[] not null default '{}',
  observacoes text not null default '',
  prazo timestamptz,
  inicio date, termino date,
  orcamento jsonb not null default '{"mostrar":"nao"}'::jsonb,   -- {valor, porEtapa, mostrar: nao|total|etapa} (CO-03)
  exigencias jsonb not null default '{}'::jsonb,
  quarteirizacao text not null default 'permitida' check (quarteirizacao in ('permitida', 'com-aprovacao', 'nao-permitida')),
  situacao text not null default 'rascunho' check (situacao in ('rascunho', 'aberta', 'fechada', 'cancelada')),
  enviada_em timestamptz,
  fechamento jsonb, aprovacao jsonb, cancelamento jsonb,
  criada_por uuid, criada_por_nome text not null default '',
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  unique (empresa_id, id),
  check (jsonb_typeof(orcamento) = 'object' and jsonb_typeof(exigencias) = 'object'),
  check (coalesce(orcamento ->> 'mostrar', 'nao') in ('nao', 'total', 'etapa')),
  check (termino is null or inicio is null or termino >= inicio),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id) on delete set null,
  foreign key (empresa_id, projeto_id) references public.projetos (empresa_id, id) on delete set null
);
create index concorrencias_empresa on public.concorrencias (empresa_id, situacao, prazo);
create index concorrencias_pai on public.concorrencias (pai_id) where pai_id is not null;

-- A situação de fato: aberta com o prazo vencido é "para fechar" (não se grava; CO-09).
create or replace function public.situacao_da_concorrencia(c public.concorrencias) returns text
language sql stable as $f$
  select case when c.situacao = 'aberta' and c.prazo <= now() then 'para-fechar' else c.situacao end
$f$;

create or replace function public.ajustar_concorrencia() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  if tg_op = 'INSERT' then
    new.criada_por := auth.uid();
    new.criada_por_nome := coalesce((select nome from public.membros where user_id = auth.uid()), '');
    new.situacao := 'rascunho'; new.enviada_em := null; new.fechamento := null; new.aprovacao := null; new.cancelamento := null;
  end if;
  new.servico := btrim(new.servico);
  new.etapas := array(select distinct btrim(x) from unnest(new.etapas) x where btrim(x) <> '');
  new.incluso := array(select btrim(x) from unnest(new.incluso) x where btrim(x) <> '');
  new.excluso := array(select btrim(x) from unnest(new.excluso) x where btrim(x) <> '');
  if new.origem_tipo = 'projeto' then
    if new.situacao = 'rascunho' and new.projeto_id is null then raise exception 'Projeto não encontrado.'; end if;
    new.obra_id := case when new.situacao = 'rascunho' then null else new.obra_id end;
  else new.projeto_id := null; end if;
  if (new.orcamento ->> 'valor') is not null and (new.orcamento ->> 'valor')::numeric <= 0 then raise exception 'O orçamento precisa ser um valor maior que zero.'; end if;
  -- a concorrência de cima: a do projeto (cotando antes de ganhar) ou a da obra (já ganha)
  if new.situacao = 'rascunho' then
    new.pai_id := case when new.origem_tipo = 'projeto'
      then (select (p.concorrencia ->> 'id')::uuid from public.projetos p where p.id = new.projeto_id)
      else (select o.concorrencia_id from public.obras o where o.id = new.obra_id) end;
  end if;
  if tg_op = 'UPDATE' then new.atualizada_em := now(); end if;
  return new;
end $f$;
create trigger concorrencias_ajustar before insert or update on public.concorrencias for each row execute function public.ajustar_concorrencia();

-- Depois de enviada, só as funções mudam (CO-09); nunca se apaga (a cascata da empresa passa).
create or replace function public.guarda_concorrencia() returns trigger
language plpgsql as $f$
begin
  if not exists (select 1 from public.empresas where id = old.empresa_id) then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'UPDATE' and old.pai_id is not null and new.pai_id is null and not exists (select 1 from public.concorrencias where id = old.pai_id) then return new; end if;
  if tg_op = 'UPDATE' and old.obra_id is not null and new.obra_id is null and not exists (select 1 from public.obras where id = old.obra_id) then return new; end if;
  if tg_op = 'UPDATE' and old.projeto_id is not null and new.projeto_id is null and not exists (select 1 from public.projetos where id = old.projeto_id) then return new; end if;
  if public.em_funcao_de_concorrencia() then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'DELETE' then
    if old.situacao <> 'rascunho' then raise exception 'Uma concorrência enviada não se apaga: cancele.'; end if;
    return old;
  end if;
  if old.situacao <> 'rascunho' then raise exception 'Depois de enviada, a concorrência só muda por prorrogação, convidados a mais ou adendo.'; end if;
  if new.situacao <> 'rascunho' then raise exception 'Para enviar, use enviar_concorrencia.'; end if;
  return new;
end $f$;
create trigger concorrencias_guarda before update or delete on public.concorrencias for each row execute function public.guarda_concorrencia();

-- ---------- Desenhos (PDFs da contratante no Storage "concorrencias") ----------

create table public.concorrencia_desenhos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  concorrencia_id uuid not null,
  nome text not null check (btrim(nome) <> ''),
  arquivo_path text not null,                            -- {contratante}/{concorrencia}/desenhos/{arquivo}.pdf
  tamanho integer not null default 0,
  em timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, concorrencia_id) references public.concorrencias (empresa_id, id) on delete cascade
);
create index concorrencia_desenhos_conc on public.concorrencia_desenhos (concorrencia_id, em);
create or replace function public.guarda_desenho() returns trigger
language plpgsql as $f$
declare c public.concorrencias;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.empresas where id = old.empresa_id) or not exists (select 1 from public.concorrencias where id = old.concorrencia_id) then return old; end if;
    select * into c from public.concorrencias where id = old.concorrencia_id;
    if c.situacao <> 'rascunho' then raise exception 'Os desenhos de uma concorrência enviada não saem (mande um adendo).'; end if;
    return old;
  end if;
  select * into c from public.concorrencias where id = new.concorrencia_id;
  if new.arquivo_path not like c.empresa_id || '/' || c.id || '/desenhos/%' then raise exception 'O desenho precisa estar na pasta da concorrência.'; end if;
  if tg_op = 'UPDATE' then raise exception 'Um desenho não se altera.'; end if;
  if c.situacao <> 'rascunho' and not public.em_funcao_de_concorrencia() then raise exception 'Depois de enviada, desenho novo só por adendo.'; end if;
  return new;
end $f$;
create trigger concorrencia_desenhos_guarda before insert or update or delete on public.concorrencia_desenhos for each row execute function public.guarda_desenho();

-- ---------- Convites ----------

create table public.concorrencia_convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,   -- a contratante
  concorrencia_id uuid not null,
  contato_id uuid not null,
  nome text not null default '', email text not null default '',
  convidada_id uuid references public.empresas (id) on delete set null,   -- a convidada com conta; null = pelo link
  token_hash text unique,                                 -- só o hash; o token sai uma vez, em enviar_concorrencia/convidar_mais
  situacao text not null default 'enviado' check (situacao in ('enviado', 'visto', 'vai-cotar', 'nao-vai', 'proposta', 'vencedora', 'nao-escolhida', 'cancelado')),
  motivo text not null default '',
  visto_em timestamptz, respondido_em timestamptz,
  projeto_id uuid,                                        -- o projeto no Measure da convidada (sem chave: é de outra empresa)
  convidado_em timestamptz not null default now(),
  unique (empresa_id, id),
  unique (concorrencia_id, contato_id),                   -- CO-16
  foreign key (empresa_id, concorrencia_id) references public.concorrencias (empresa_id, id) on delete cascade,
  foreign key (empresa_id, contato_id) references public.contatos (empresa_id, id)
);
create index concorrencia_convites_convidada on public.concorrencia_convites (convidada_id) where convidada_id is not null;
create index concorrencia_convites_email on public.concorrencia_convites (lower(email)) where convidada_id is null;

create or replace function public.ajustar_convite() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare ct public.contatos;
begin
  if exists (select 1 from public.concorrencias where id = new.concorrencia_id and situacao <> 'rascunho') and not public.em_funcao_de_concorrencia() then
    raise exception 'Com a concorrência enviada, convide pelas funções (convidar_mais).';
  end if;
  select * into ct from public.contatos where id = new.contato_id and empresa_id = new.empresa_id;
  if ct.id is null then raise exception 'Convidado não encontrado nos Contatos.'; end if;
  new.nome := ct.nome; new.email := lower(btrim(ct.email));
  new.convidada_id := case when ct.conta_empresa_id = new.empresa_id then null else ct.conta_empresa_id end;
  new.situacao := 'enviado'; new.motivo := ''; new.visto_em := null; new.respondido_em := null; new.projeto_id := null; new.token_hash := null;
  return new;
end $f$;
create trigger concorrencia_convites_ajustar before insert on public.concorrencia_convites for each row execute function public.ajustar_convite();

create or replace function public.guarda_convite() returns trigger
language plpgsql as $f$
declare c public.concorrencias;
begin
  if not exists (select 1 from public.empresas where id = old.empresa_id) then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'UPDATE' and old.convidada_id is not null and new.convidada_id is null and not exists (select 1 from public.empresas where id = old.convidada_id) then return new; end if;
  if public.em_funcao_de_concorrencia() then return case when tg_op = 'DELETE' then old else new end; end if;
  select * into c from public.concorrencias where id = old.concorrencia_id;
  if c.id is not null and c.situacao <> 'rascunho' then raise exception 'Os convites de uma concorrência enviada só mudam pelas funções.'; end if;
  if tg_op = 'UPDATE' then raise exception 'Um convite não se edita: tire e convide de novo.'; end if;
  return old;
end $f$;
create trigger concorrencia_convites_guarda before update or delete on public.concorrencia_convites for each row execute function public.guarda_convite();

-- ---------- Propostas (só insert, CO-05) ----------

create table public.concorrencia_propostas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,   -- a contratante
  convite_id uuid not null,
  rev integer not null check (rev >= 1),
  numero text not null default '',                       -- o P-AAAA-NNN da convidada, quando veio do Measure
  proposta_emitida_id uuid,                              -- propostas_emitidas da convidada (sem chave: outra empresa)
  enviada_em timestamptz not null default now(),
  por_nome text not null default '',
  total numeric(12,2) not null check (total > 0),
  por_etapa jsonb not null default '{}'::jsonb,
  outros numeric(12,2) not null default 0 check (outros >= 0),
  prazo_execucao_dias integer check (prazo_execucao_dias is null or prazo_execucao_dias > 0),
  exclusoes text[] not null default '{}',
  pdf_path text,                                         -- {contratante}/{concorrencia}/propostas/{convite}/rev-N.pdf
  unique (empresa_id, id),
  unique (convite_id, rev),
  check (jsonb_typeof(por_etapa) = 'object'),
  foreign key (empresa_id, convite_id) references public.concorrencia_convites (empresa_id, id) on delete cascade
);

-- ---------- Mensagens (o canal, só insert; "publica" é o único que muda, pela função) ----------

create table public.concorrencia_mensagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,   -- a contratante
  concorrencia_id uuid not null,
  convite_id uuid,                                       -- a conversa de um convite; null = aviso a todos
  de text not null check (de in ('contratante', 'convidada')),
  autor text not null default '',
  texto text not null check (btrim(texto) <> ''),
  publica boolean not null default false,
  resposta_de uuid references public.concorrencia_mensagens (id),
  aviso boolean not null default false,
  em timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, concorrencia_id) references public.concorrencias (empresa_id, id) on delete cascade,
  foreign key (empresa_id, convite_id) references public.concorrencia_convites (empresa_id, id) on delete cascade
);
create index concorrencia_mensagens_conc on public.concorrencia_mensagens (concorrencia_id, em);

-- ---------- Histórico (só insert, pelas funções) ----------

create table public.concorrencia_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  concorrencia_id uuid not null,
  em timestamptz not null default now(),
  por uuid, por_nome text not null default '',
  acao text not null,                                    -- enviada · prorrogada · convidados · adendo · fechada · cancelada · aprovacao-pedida · aprovacao
  detalhe text not null default '',
  unique (empresa_id, id),
  foreign key (empresa_id, concorrencia_id) references public.concorrencias (empresa_id, id) on delete cascade
);
create index concorrencia_historico_conc on public.concorrencia_historico (concorrencia_id, em);

create or replace function public.guarda_so_insert_conc() returns trigger
language plpgsql as $f$
begin
  if not exists (select 1 from public.empresas where id = old.empresa_id) then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'DELETE' and (to_jsonb(old) ->> 'convite_id') is not null and not exists (select 1 from public.concorrencia_convites where id = (to_jsonb(old) ->> 'convite_id')::uuid) then return old; end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.concorrencias where id = coalesce(to_jsonb(old) ->> 'concorrencia_id', '')::uuid) then return old; end if;
  -- a função que responde para todos marca a pergunta como pública
  if tg_op = 'UPDATE' and tg_table_name = 'concorrencia_mensagens' and public.em_funcao_de_concorrencia()
     and to_jsonb(new) - 'publica' = to_jsonb(old) - 'publica' then return new; end if;
  raise exception 'Este registro não pode ser alterado nem apagado.';
end $f$;
create trigger concorrencia_propostas_guarda before update or delete on public.concorrencia_propostas for each row execute function public.guarda_so_insert_conc();
create trigger concorrencia_mensagens_guarda before update or delete on public.concorrencia_mensagens for each row execute function public.guarda_so_insert_conc();
create trigger concorrencia_historico_guarda before update or delete on public.concorrencia_historico for each row execute function public.guarda_so_insert_conc();

-- ---------- O projeto do Measure da convidada guarda a concorrência (só as funções gravam) ----------

alter table public.projetos add column concorrencia jsonb not null default '{}'::jsonb check (jsonb_typeof(concorrencia) = 'object');
create or replace function public.guarda_concorrencia_do_projeto() returns trigger
language plpgsql as $f$
begin
  if new.concorrencia is distinct from old.concorrencia and not public.em_funcao_de_concorrencia() then new.concorrencia := old.concorrencia; end if;
  return new;
end $f$;
create trigger projetos_guarda_concorrencia before update on public.projetos for each row execute function public.guarda_concorrencia_do_projeto();

-- ---------- Auditoria ----------

create trigger concorrencias_auditar after insert or update or delete on public.concorrencias for each row execute function public.auditar();
create trigger concorrencia_convites_auditar after insert or update or delete on public.concorrencia_convites for each row execute function public.auditar();
create trigger concorrencia_propostas_auditar after insert on public.concorrencia_propostas for each row execute function public.auditar();

-- a convidada com conta também registra na auditoria dela (CO-18)
create or replace function public.auditar_na_convidada(p_empresa uuid, p_registro uuid, p_acao text, p_detalhe jsonb) returns void
language plpgsql security definer set search_path to 'public' as $f$
begin
  if p_empresa is null then return; end if;
  insert into public.auditoria (quem, tabela, registro, acao, depois, empresa_id) values (auth.uid(), 'concorrencias', p_registro, p_acao, p_detalhe, p_empresa);
end $f$;

-- ---------- Apoio das funções ----------

create or replace function public.registrar_na_concorrencia(p_c public.concorrencias, p_acao text, p_detalhe text) returns void
language plpgsql security definer set search_path to 'public' as $f$
begin
  insert into public.concorrencia_historico (empresa_id, concorrencia_id, por, por_nome, acao, detalhe)
  values (p_c.empresa_id, p_c.id, auth.uid(), coalesce((select nome from public.membros where user_id = auth.uid()), ''), p_acao, coalesce(p_detalhe, ''));
end $f$;

-- a concorrência da contratante que chama, trancada para mudar
create or replace function public.minha_concorrencia(p_id uuid) returns public.concorrencias
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias;
begin
  if not public.giro_concorrencias() then raise exception 'Sem permissão para concorrências.'; end if;
  select * into c from public.concorrencias where id = p_id and empresa_id = public.minha_empresa() for update;
  if c.id is null then raise exception 'Concorrência não encontrada.'; end if;
  perform set_config('kb.conc_funcao', '1', true);
  return c;
end $f$;

create or replace function public.novo_token_do_convite(p_convite uuid) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v_token text := encode(gen_random_bytes(24), 'hex');
begin
  update public.concorrencia_convites set token_hash = encode(digest(v_token, 'sha256'), 'hex') where id = p_convite;
  return v_token;
end $f$;

-- O que falta para enviar (CO-08, CO-23, CO-25).
create or replace function public.pendencias_de_envio(c public.concorrencias) returns text[]
language plpgsql stable security definer set search_path to 'public' as $f$
declare p text[] := '{}'; pj public.projetos; pai public.concorrencias;
begin
  if c.origem_tipo = 'obra' and c.obra_id is null then p := array_append(p, 'Escolha a obra.'); end if;
  if c.servico = '' then p := array_append(p, 'Dê um nome ao serviço.'); end if;
  if cardinality(c.etapas) = 0 then p := array_append(p, 'Escolha pelo menos uma etapa a cotar.'); end if;
  if cardinality(c.incluso) = 0 then p := array_append(p, 'Descreva o que está incluso no escopo.'); end if;
  if c.prazo is null then p := array_append(p, 'Informe o prazo da proposta.');
  elsif c.prazo <= now() then p := array_append(p, 'O prazo da proposta precisa ser no futuro.'); end if;
  if not exists (select 1 from public.concorrencia_convites where concorrencia_id = c.id) then p := array_append(p, 'Convide pelo menos uma prestadora.'); end if;
  if c.origem_tipo = 'projeto' then
    select * into pj from public.projetos where id = c.projeto_id;
    if pj.prazo_proposta is not null and c.prazo is not null and (c.prazo at time zone 'UTC')::date >= pj.prazo_proposta then
      p := array_append(p, 'O prazo precisa vencer antes do prazo da sua proposta (' || pj.prazo_proposta || ').');
    end if;
  end if;
  if c.pai_id is not null then
    select * into pai from public.concorrencias where id = c.pai_id;
    if pai.quarteirizacao = 'nao-permitida' then p := array_append(p, 'A contratante desta obra não permite quarteirizar.'); end if;
  end if;
  return p;
end $f$;

-- ---------- Contratante ----------

-- Enviar: devolve, uma vez, os links dos convidados sem conta: [{convite_id, nome, email, token}] (CO-07).
create or replace function public.enviar_concorrencia(p_id uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias := public.minha_concorrencia(p_id); falta text[]; links jsonb := '[]'::jsonb; v public.concorrencia_convites;
begin
  if c.situacao <> 'rascunho' then raise exception 'Esta concorrência já foi enviada.'; end if;
  falta := public.pendencias_de_envio(c);
  if cardinality(falta) > 0 then raise exception '%', falta[1]; end if;
  update public.concorrencias set situacao = 'aberta', enviada_em = now() where id = c.id;
  for v in select * from public.concorrencia_convites where concorrencia_id = c.id order by convidado_em loop
    if v.convidada_id is null then links := links || jsonb_build_object('convite_id', v.id, 'nome', v.nome, 'email', v.email, 'token', public.novo_token_do_convite(v.id)); end if;
  end loop;
  perform public.registrar_na_concorrencia(c, 'enviada', (select string_agg(nome, ', ' order by convidado_em) from public.concorrencia_convites where concorrencia_id = c.id));
  return jsonb_build_object('links', links);
end $f$;

create or replace function public.prorrogar_concorrencia(p_id uuid, p_prazo timestamptz, p_motivo text default '') returns void
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias := public.minha_concorrencia(p_id);
begin
  if c.situacao <> 'aberta' then raise exception 'Só uma concorrência aberta pode ser prorrogada.'; end if;
  if p_prazo is null or p_prazo <= greatest(now(), c.prazo) then raise exception 'O novo prazo precisa ser depois do prazo atual e no futuro.'; end if;
  update public.concorrencias set prazo = p_prazo where id = c.id;
  perform public.registrar_na_concorrencia(c, 'prorrogada', to_char(c.prazo at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') || ' → ' || to_char(p_prazo at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') || case when btrim(coalesce(p_motivo, '')) <> '' then ' · ' || btrim(p_motivo) else '' end);
end $f$;

-- Convidar mais com a concorrência aberta (CO-09, CO-16); devolve os links dos novos sem conta.
create or replace function public.convidar_mais(p_id uuid, p_contatos uuid[]) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias := public.minha_concorrencia(p_id); links jsonb := '[]'::jsonb; v public.concorrencia_convites; ct uuid; nomes text := '';
begin
  if c.situacao <> 'aberta' then raise exception 'Só dá para convidar mais com a concorrência aberta.'; end if;
  for ct in select distinct x from unnest(p_contatos) x where not exists (select 1 from public.concorrencia_convites where concorrencia_id = c.id and contato_id = x) loop
    insert into public.concorrencia_convites (empresa_id, concorrencia_id, contato_id) values (c.empresa_id, c.id, ct) returning * into v;
    nomes := nomes || case when nomes = '' then '' else ', ' end || v.nome;
    if v.convidada_id is null then links := links || jsonb_build_object('convite_id', v.id, 'nome', v.nome, 'email', v.email, 'token', public.novo_token_do_convite(v.id)); end if;
  end loop;
  if nomes = '' then raise exception 'Essas prestadoras já foram convidadas.'; end if;
  perform public.registrar_na_concorrencia(c, 'convidados', nomes);
  return jsonb_build_object('links', links);
end $f$;

create or replace function public.autor_da_contratante(p_empresa uuid) returns text
language sql stable security definer set search_path to 'public' as $f$
  select coalesce((select nome || ' · ' from public.membros where user_id = auth.uid()), '') || coalesce((select nome from public.empresas where id = p_empresa), '')
$f$;

-- Adendo: aviso a todos (mensagem) e, se vier, um desenho novo (CO-09).
create or replace function public.adendo(p_id uuid, p_texto text, p_desenho jsonb default null) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias := public.minha_concorrencia(p_id); m uuid;
begin
  if c.situacao <> 'aberta' then raise exception 'Aviso a todos só com a concorrência aberta.'; end if;
  if btrim(coalesce(p_texto, '')) = '' then raise exception 'Escreva a mensagem.'; end if;
  if p_desenho is not null then
    insert into public.concorrencia_desenhos (empresa_id, concorrencia_id, nome, arquivo_path, tamanho)
    values (c.empresa_id, c.id, p_desenho ->> 'nome', p_desenho ->> 'arquivo_path', coalesce((p_desenho ->> 'tamanho')::int, 0));
  end if;
  insert into public.concorrencia_mensagens (empresa_id, concorrencia_id, convite_id, de, autor, texto, publica, aviso)
  values (c.empresa_id, c.id, null, 'contratante', public.autor_da_contratante(c.empresa_id), btrim(p_texto), true, true) returning id into m;
  perform public.registrar_na_concorrencia(c, 'adendo', left(btrim(p_texto), 80));
  return m;
end $f$;

create or replace function public.ultima_proposta(p_convite uuid) returns public.concorrencia_propostas
language sql stable security definer set search_path to 'public' as $f$
  select * from public.concorrencia_propostas where convite_id = p_convite order by rev desc limit 1
$f$;

create or replace function public.concluir_fechamento(c public.concorrencias, v public.concorrencia_convites, p public.concorrencia_propostas, p_observacao text, p_por uuid, p_por_nome text) returns void
language plpgsql security definer set search_path to 'public' as $f$
begin
  perform set_config('kb.conc_funcao', '1', true);
  update public.concorrencias set situacao = 'fechada',
    fechamento = jsonb_build_object('conviteId', v.id, 'nome', v.nome, 'rev', p.rev, 'valor', p.total, 'por', p_por, 'porNome', p_por_nome, 'em', now(), 'observacao', btrim(coalesce(p_observacao, '')))
   where id = c.id;
  update public.concorrencia_convites set situacao = 'vencedora' where id = v.id;
  update public.concorrencia_convites x set situacao = 'nao-escolhida' where x.concorrencia_id = c.id and x.id <> v.id and exists (select 1 from public.concorrencia_propostas where convite_id = x.id);
  insert into public.concorrencia_historico (empresa_id, concorrencia_id, por, por_nome, acao, detalhe) values (c.empresa_id, c.id, p_por, p_por_nome, 'fechada', v.nome || ' · rev. ' || p.rev);
  -- CO-14: na vencedora com conta, o projeto vira Ganha e guarda a ligação para a obra que ela criar
  if v.convidada_id is not null and v.projeto_id is not null then
    update public.projetos set situacao = 'ganha',
      concorrencia = concorrencia || jsonb_build_object('id', c.id, 'conviteId', v.id, 'contratanteId', c.empresa_id, 'vinculo', jsonb_build_object('empresaId', c.empresa_id, 'obraId', c.obra_id))
     where id = v.projeto_id and empresa_id = v.convidada_id;
  end if;
  perform public.auditar_na_convidada(v.convidada_id, c.id, 'vencedora', jsonb_build_object('servico', c.servico, 'rev', p.rev));
end $f$;

-- Fechar (CO-06, CO-13, CO-24): devolve {ok} ou {pendente: true} quando a contratante de cima precisa aprovar (CO-23).
create or replace function public.fechar_concorrencia(p_id uuid, p_convite uuid, p_observacao text default '') returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias := public.minha_concorrencia(p_id); v public.concorrencia_convites; p public.concorrencia_propostas; pj public.projetos; pai public.concorrencias; eu public.membros := public.meu_membro();
begin
  if c.situacao <> 'aberta' then raise exception 'Esta concorrência não está aberta.'; end if;
  select * into v from public.concorrencia_convites where id = p_convite and concorrencia_id = c.id;
  p := public.ultima_proposta(v.id);
  if v.id is null or p.id is null then raise exception 'Escolha uma prestadora que mandou proposta.'; end if;
  if c.origem_tipo = 'projeto' then
    select * into pj from public.projetos where id = c.projeto_id;
    if pj.id is null or pj.situacao <> 'ganha' then raise exception 'Esta concorrência saiu de um projeto em orçamento: só fecha depois que o projeto for ganho.'; end if;
    if pj.obra_id is null then raise exception 'Crie a obra a partir do projeto antes de fechar: a contratada fica ligada a ela.'; end if;
    update public.concorrencias set obra_id = pj.obra_id where id = c.id;
    c.obra_id := pj.obra_id;
  end if;
  if c.pai_id is not null then select * into pai from public.concorrencias where id = c.pai_id; end if;
  if pai.quarteirizacao = 'com-aprovacao' and not coalesce(c.aprovacao ->> 'situacao' = 'aprovada' and (c.aprovacao ->> 'conviteId')::uuid = v.id, false) then
    update public.concorrencias set aprovacao = jsonb_build_object('conviteId', v.id, 'nome', v.nome, 'situacao', 'pendente', 'pedidaEm', now(), 'observacao', btrim(coalesce(p_observacao, '')), 'pedidaPor', eu.id, 'pedidaPorNome', eu.nome) where id = c.id;
    perform public.registrar_na_concorrencia(c, 'aprovacao-pedida', v.nome);
    return jsonb_build_object('ok', true, 'pendente', true);
  end if;
  perform public.concluir_fechamento(c, v, p, p_observacao, auth.uid(), eu.nome);
  return jsonb_build_object('ok', true);
end $f$;

-- A contratante de cima aprova ou recusa a quarteirização (CO-23): vê só o nome, nunca o valor (CO-22).
create or replace function public.pedidos_de_quarteirizacao() returns setof jsonb
language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object('id', c.id, 'paiId', c.pai_id, 'servico', c.servico, 'contratante', e.nome, 'contratanteId', c.empresa_id, 'escolhida', c.aprovacao ->> 'nome', 'pedidaEm', c.aprovacao ->> 'pedidaEm')
    from public.concorrencias c join public.concorrencias pai on pai.id = c.pai_id join public.empresas e on e.id = c.empresa_id
   where pai.empresa_id = public.minha_empresa() and c.aprovacao ->> 'situacao' = 'pendente' and public.giro_concorrencias()
$f$;

create or replace function public.decidir_quarteirizacao(p_id uuid, p_aprovar boolean, p_motivo text default '') returns void
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias; pai public.concorrencias; v public.concorrencia_convites; eu public.membros := public.meu_membro();
begin
  if not public.giro_concorrencias() then raise exception 'Sem permissão para concorrências.'; end if;
  select * into c from public.concorrencias where id = p_id for update;
  if c.id is not null then select * into pai from public.concorrencias where id = c.pai_id; end if;
  if c.id is null or pai.empresa_id is distinct from public.minha_empresa() or c.aprovacao ->> 'situacao' is distinct from 'pendente' then raise exception 'Pedido não encontrado.'; end if;
  perform set_config('kb.conc_funcao', '1', true);
  update public.concorrencias set aprovacao = aprovacao || jsonb_build_object('situacao', case when p_aprovar then 'aprovada' else 'recusada' end, 'decididaEm', now(), 'por', eu.nome, 'motivo', btrim(coalesce(p_motivo, ''))) where id = c.id returning * into c;
  insert into public.concorrencia_historico (empresa_id, concorrencia_id, por, por_nome, acao, detalhe)
  values (c.empresa_id, c.id, auth.uid(), eu.nome, 'aprovacao', case when p_aprovar then 'aprovada' else 'recusada' end || ': ' || (c.aprovacao ->> 'nome') || case when btrim(coalesce(p_motivo, '')) <> '' then ' · ' || btrim(p_motivo) else '' end);
  insert into public.auditoria (quem, tabela, registro, acao, depois, empresa_id) values (auth.uid(), 'concorrencias', c.id, case when p_aprovar then 'quarteirizacao-aprovada' else 'quarteirizacao-recusada' end, c.aprovacao, pai.empresa_id);
  if p_aprovar then
    select * into v from public.concorrencia_convites where id = (c.aprovacao ->> 'conviteId')::uuid;
    -- a decisão é da contratante de cima; o fechamento fica em nome de quem pediu
    perform public.concluir_fechamento(c, v, public.ultima_proposta(v.id), c.aprovacao ->> 'observacao', (c.aprovacao ->> 'pedidaPor')::uuid, coalesce(c.aprovacao ->> 'pedidaPorNome', ''));
  end if;
end $f$;

-- Cancelar exige motivo e avisa os convidados (CO-15). Rascunho sai de vez.
create or replace function public.cancelar_concorrencia(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias := public.minha_concorrencia(p_id); eu public.membros := public.meu_membro();
begin
  if c.situacao in ('fechada', 'cancelada') then raise exception 'Esta concorrência já foi encerrada.'; end if;
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Diga o motivo do cancelamento.'; end if;
  if c.situacao = 'rascunho' then delete from public.concorrencias where id = c.id; return; end if;
  update public.concorrencias set situacao = 'cancelada', cancelamento = jsonb_build_object('motivo', btrim(p_motivo), 'por', eu.nome, 'em', now()) where id = c.id;
  update public.concorrencia_convites set situacao = 'cancelado' where concorrencia_id = c.id;
  perform public.registrar_na_concorrencia(c, 'cancelada', btrim(p_motivo));
end $f$;

-- CO-24: o projeto perdido cancela as concorrências abertas que saíram dele (chamada pelo app ao marcar Perdida).
create or replace function public.cancelar_concorrencias_do_projeto(p_projeto uuid) returns integer
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias; n int := 0;
begin
  for c in select * from public.concorrencias where projeto_id = p_projeto and empresa_id = public.minha_empresa() and situacao in ('rascunho', 'aberta') loop
    perform public.cancelar_concorrencia(c.id, 'O projeto foi perdido.'); n := n + 1;
  end loop;
  return n;
end $f$;

-- A contratante escreve: na conversa de um convite, respondendo a uma pergunta (para todos ou só para quem perguntou).
create or replace function public.escrever_como_contratante(p_id uuid, p_convite uuid, p_resposta_de uuid, p_para_todos boolean, p_texto text) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias := public.minha_concorrencia(p_id); perg public.concorrencia_mensagens; alvo uuid := p_convite; publica boolean; m uuid;
begin
  if btrim(coalesce(p_texto, '')) = '' then raise exception 'Escreva a mensagem.'; end if;
  if c.situacao = 'rascunho' then raise exception 'Envie os convites antes de conversar.'; end if;
  if c.situacao = 'cancelada' then raise exception 'Esta concorrência foi cancelada.'; end if;
  if p_resposta_de is not null then
    select * into perg from public.concorrencia_mensagens where id = p_resposta_de and concorrencia_id = c.id and de = 'convidada';
    if perg.id is null then raise exception 'Pergunta não encontrada.'; end if;
    alvo := perg.convite_id;
  end if;
  if alvo is null then raise exception 'Para um aviso a todos, use o adendo.'; end if;
  if not exists (select 1 from public.concorrencia_convites where id = alvo and concorrencia_id = c.id) then raise exception 'Convite não encontrado.'; end if;
  if c.situacao = 'fechada' and alvo <> (c.fechamento ->> 'conviteId')::uuid then raise exception 'A conversa continua só com a empresa contratada.'; end if;
  publica := perg.id is not null and coalesce(p_para_todos, false) and c.situacao = 'aberta';
  if publica then update public.concorrencia_mensagens set publica = true where id = perg.id; end if;
  insert into public.concorrencia_mensagens (empresa_id, concorrencia_id, convite_id, de, autor, texto, publica, resposta_de)
  values (c.empresa_id, c.id, alvo, 'contratante', public.autor_da_contratante(c.empresa_id), btrim(p_texto), publica, perg.id) returning id into m;
  return m;
end $f$;

-- ---------- Convidada: a visão (CO-04) ----------

-- O que a convidada vê de uma concorrência: sem os outros convidados, sem o fechamento com outra, orçamento só se a contratante quis.
create or replace function public.visao_do_convite(v public.concorrencia_convites) returns jsonb
language sql stable security definer set search_path to 'public' as $f$
  select jsonb_build_object(
    'id', c.id, 'contratanteId', c.empresa_id,
    'contratante', (select jsonb_build_object('id', e.id, 'nome', e.nome, 'sigla', e.sigla, 'telefone', e.telefone, 'email', e.email) from public.empresas e where e.id = c.empresa_id),
    'obraId', c.obra_id,
    'obra', case when c.obra_id is not null then (select jsonb_build_object('nome', o.nome, 'endereco', o.endereco, 'cidade', o.municipio, 'estado', o.estado, 'zip', o.zip) from public.obras o where o.id = c.obra_id)
                 when c.projeto_id is not null then (select jsonb_build_object('nome', p.nome, 'endereco', p.endereco, 'cidade', p.cidade, 'estado', p.estado, 'zip', p.zip) from public.projetos p where p.id = c.projeto_id) end,
    'servico', c.servico, 'etapas', to_jsonb(c.etapas), 'incluso', to_jsonb(c.incluso), 'excluso', to_jsonb(c.excluso), 'observacoes', c.observacoes,
    'desenhos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nome', d.nome, 'path', d.arquivo_path, 'tamanho', d.tamanho, 'em', d.em) order by d.em) from public.concorrencia_desenhos d where d.concorrencia_id = c.id), '[]'::jsonb),
    'prazo', c.prazo, 'inicio', c.inicio, 'termino', c.termino, 'enviadaEm', c.enviada_em,
    'exigencias', c.exigencias, 'quarteirizacao', c.quarteirizacao,
    'orcamento', case c.orcamento ->> 'mostrar' when 'total' then jsonb_build_object('mostrar', 'total', 'valor', c.orcamento -> 'valor')
                                                 when 'etapa' then jsonb_build_object('mostrar', 'etapa', 'valor', c.orcamento -> 'valor', 'porEtapa', coalesce(c.orcamento -> 'porEtapa', '{}'::jsonb))
                                                 else '{"mostrar":"nao"}'::jsonb end,
    'situacao', public.situacao_da_concorrencia(c),
    'fechamento', case when c.situacao = 'fechada' then jsonb_build_object('em', c.fechamento ->> 'em', 'minha', (c.fechamento ->> 'conviteId')::uuid = v.id) end,
    'cancelamento', case when c.situacao = 'cancelada' then jsonb_build_object('em', c.cancelamento ->> 'em', 'motivo', c.cancelamento ->> 'motivo') end,
    'convite', jsonb_build_object('id', v.id, 'nome', v.nome, 'email', v.email, 'empresaId', v.convidada_id, 'situacao', v.situacao, 'motivo', v.motivo,
                                  'vistoEm', v.visto_em, 'respondidoEm', v.respondido_em, 'projetoId', v.projeto_id, 'convidadoEm', v.convidado_em,
                                  'propostas', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'rev', p.rev, 'numero', p.numero, 'propostaEmitidaId', p.proposta_emitida_id, 'enviadaEm', p.enviada_em, 'por', p.por_nome, 'total', p.total, 'porEtapa', p.por_etapa, 'outros', p.outros, 'prazoExecucaoDias', p.prazo_execucao_dias, 'exclusoes', to_jsonb(p.exclusoes), 'pdf', p.pdf_path) order by p.rev) from public.concorrencia_propostas p where p.convite_id = v.id), '[]'::jsonb)),
    'mensagens', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'em', m.em, 'conviteId', m.convite_id, 'de', m.de, 'publica', m.publica, 'respostaDe', m.resposta_de, 'aviso', m.aviso, 'texto', m.texto,
                                                               'minha', m.de = 'convidada' and m.convite_id = v.id,
                                                               'autor', case when m.de = 'convidada' and m.convite_id is distinct from v.id then 'Pergunta de um convidado' else m.autor end) order by m.em)
                           from public.concorrencia_mensagens m where m.concorrencia_id = c.id and (m.convite_id = v.id or m.publica)), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('em', h.em, 'acao', h.acao, 'detalhe', h.detalhe) order by h.em) from public.concorrencia_historico h where h.concorrencia_id = c.id and h.acao in ('prorrogada', 'adendo')), '[]'::jsonb))
    from public.concorrencias c where c.id = v.concorrencia_id
$f$;

-- Convites que a empresa de quem chama recebeu (ela é a convidada, com conta). Rascunhos não aparecem.
create or replace function public.concorrencias_recebidas(p_id uuid default null) returns setof jsonb
language sql stable security definer set search_path to 'public' as $f$
  select public.visao_do_convite(v)
    from public.concorrencia_convites v join public.concorrencias c on c.id = v.concorrencia_id
   where v.convidada_id = public.minha_empresa() and c.situacao <> 'rascunho' and (p_id is null or c.id = p_id) and public.respondo_concorrencias()
   order by v.convidado_em desc
$f$;

-- Pelo link (CO-07): só a função de borda convite-publico chama (chave de serviço). Cancelada responde "encerrada".
create or replace function public.convite_por_token(p_token text) returns jsonb
language sql stable security definer set search_path to 'public', 'extensions' as $f$
  select public.visao_do_convite(v)
    from public.concorrencia_convites v join public.concorrencias c on c.id = v.concorrencia_id
   where v.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and c.situacao <> 'rascunho'
$f$;

-- ---------- Convidada: as ações (com conta ou pelo link) ----------

-- O convite alvo: pela conta (convidada_id = minha empresa, com concorrencias.responder) ou pelo token (só a função de borda).
create or replace function public.convite_alvo(p_convite uuid, p_token text) returns public.concorrencia_convites
language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v public.concorrencia_convites;
begin
  if p_token is not null then
    select * into v from public.concorrencia_convites where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  else
    if not public.respondo_concorrencias() then raise exception 'Sem permissão para responder convites.'; end if;
    select * into v from public.concorrencia_convites where id = p_convite and convidada_id = public.minha_empresa() for update;
  end if;
  if v.id is null or exists (select 1 from public.concorrencias where id = v.concorrencia_id and situacao = 'rascunho') then raise exception 'Convite não encontrado.'; end if;
  perform set_config('kb.conc_funcao', '1', true);
  return v;
end $f$;

create or replace function public.conc_aberta_para(c public.concorrencias) returns void
language plpgsql stable as $f$
begin
  if c.situacao <> 'aberta' then raise exception 'Esta concorrência não está mais aberta.'; end if;
  if c.prazo <= now() then raise exception 'O prazo da proposta já venceu.'; end if;
end $f$;

create or replace function public.marcar_visto_interno(v public.concorrencia_convites) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
begin
  if v.visto_em is null then update public.concorrencia_convites set visto_em = now(), situacao = case when situacao = 'enviado' then 'visto' else situacao end where id = v.id; end if;
  return v.concorrencia_id;
end $f$;

-- Vou cotar / Não vou participar (motivo opcional). Quem já mandou proposta não volta atrás por aqui.
create or replace function public.responder_interno(v public.concorrencia_convites, p_vai boolean, p_motivo text) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias;
begin
  select * into c from public.concorrencias where id = v.concorrencia_id;
  perform public.conc_aberta_para(c);
  if exists (select 1 from public.concorrencia_propostas where convite_id = v.id) then raise exception 'Você já mandou proposta para esta concorrência.'; end if;
  update public.concorrencia_convites set situacao = case when p_vai then 'vai-cotar' else 'nao-vai' end, motivo = case when p_vai then '' else btrim(coalesce(p_motivo, '')) end,
         respondido_em = now(), visto_em = coalesce(visto_em, now()) where id = v.id;
  perform public.auditar_na_convidada(v.convidada_id, c.id, case when p_vai then 'vai-cotar' else 'nao-vai' end, jsonb_build_object('servico', c.servico, 'motivo', btrim(coalesce(p_motivo, ''))));
end $f$;

-- Enviar a proposta (CO-05, CO-10): até o prazo; cada envio é uma revisão. p: {total, porEtapa, outros, prazoExecucaoDias, exclusoes, numero, propostaEmitidaId, pdfPath, por}
create or replace function public.proposta_interna(v public.concorrencia_convites, p jsonb, p_link boolean) returns integer
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias; por_etapa jsonb := '{}'::jsonb; k text; x text; n numeric; soma numeric := 0; outros numeric; total numeric; v_rev int; v_emitida uuid; v_pdf text;
begin
  select * into c from public.concorrencias where id = v.concorrencia_id;
  perform public.conc_aberta_para(c);
  if v.situacao = 'nao-vai' then raise exception 'Você respondeu que não vai participar.'; end if;
  for k, x in select key, value #>> '{}' from jsonb_each(coalesce(p -> 'porEtapa', '{}'::jsonb)) loop
    if x is null or x = '' then continue; end if;
    if not (k = any (c.etapas)) then raise exception 'Etapa fora da concorrência: %', k; end if;
    n := round(x::numeric, 2);
    if not (n > 0) then raise exception 'Valor inválido na etapa %.', k; end if;
    por_etapa := por_etapa || jsonb_build_object(k, n); soma := soma + n;
  end loop;
  outros := round(coalesce(nullif(p ->> 'outros', '')::numeric, 0), 2);
  if outros < 0 then raise exception 'Valor inválido em outros itens.'; end if;
  soma := soma + outros;
  total := round(coalesce(nullif(p ->> 'total', '')::numeric, soma), 2);
  if not (total > 0) then raise exception 'Informe o total da proposta.'; end if;
  if por_etapa <> '{}'::jsonb and abs(total - soma) > 0.01 then raise exception 'O total precisa ser a soma dos valores por etapa.'; end if;
  v_emitida := nullif(p ->> 'propostaEmitidaId', '')::uuid;
  if v_emitida is not null and not exists (select 1 from public.propostas_emitidas e where e.id = v_emitida and e.empresa_id = v.convidada_id) then raise exception 'Proposta emitida não encontrada.'; end if;
  v_rev := coalesce((select max(rev) from public.concorrencia_propostas where convite_id = v.id), 0) + 1;
  v_pdf := nullif(p ->> 'pdfPath', '');
  if v_pdf is not null and v_pdf not like c.empresa_id || '/' || c.id || '/propostas/' || v.id || '/%' then raise exception 'O PDF da proposta precisa estar na pasta do convite.'; end if;
  insert into public.concorrencia_propostas (empresa_id, convite_id, rev, numero, proposta_emitida_id, por_nome, total, por_etapa, outros, prazo_execucao_dias, exclusoes, pdf_path)
  values (c.empresa_id, v.id, v_rev, coalesce(p ->> 'numero', ''), v_emitida,
          case when p_link then coalesce(nullif(btrim(coalesce(p ->> 'por', '')), ''), v.nome) else coalesce((select nome from public.membros where user_id = auth.uid()), v.nome) end,
          total, por_etapa, outros, nullif(p ->> 'prazoExecucaoDias', '')::int,
          coalesce(array(select btrim(e) from jsonb_array_elements_text(coalesce(p -> 'exclusoes', '[]'::jsonb)) e where btrim(e) <> ''), '{}'), v_pdf);
  update public.concorrencia_convites set situacao = 'proposta', respondido_em = coalesce(respondido_em, now()), visto_em = coalesce(visto_em, now()) where id = v.id;
  perform public.auditar_na_convidada(v.convidada_id, c.id, 'proposta', jsonb_build_object('servico', c.servico, 'rev', v_rev, 'total', total));
  return v_rev;
end $f$;

-- A convidada escreve na própria conversa (pergunta antes do fechamento; depois, se venceu, o canal da obra).
create or replace function public.mensagem_interna(v public.concorrencia_convites, p_texto text, p_por text, p_link boolean) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias; m uuid; v_autor text;
begin
  if btrim(coalesce(p_texto, '')) = '' then raise exception 'Escreva a mensagem.'; end if;
  select * into c from public.concorrencias where id = v.concorrencia_id;
  if c.situacao = 'cancelada' then raise exception 'Esta concorrência foi cancelada.'; end if;
  if c.situacao = 'fechada' and (c.fechamento ->> 'conviteId')::uuid <> v.id then raise exception 'A conversa continua só com a empresa contratada.'; end if;
  if c.situacao = 'aberta' and c.prazo <= now() and not exists (select 1 from public.concorrencia_propostas where convite_id = v.id) then raise exception 'O prazo da proposta já venceu.'; end if;
  v_autor := case when p_link then case when btrim(coalesce(p_por, '')) <> '' then btrim(p_por) || ' · ' else '' end
             else coalesce((select nome || ' · ' from public.membros where user_id = auth.uid()), '') end || v.nome;
  insert into public.concorrencia_mensagens (empresa_id, concorrencia_id, convite_id, de, autor, texto) values (c.empresa_id, c.id, v.id, 'convidada', v_autor, btrim(p_texto)) returning id into m;
  return m;
end $f$;

-- Com conta (concorrencias.responder):
create or replace function public.marcar_visto(p_convite uuid) returns uuid
language plpgsql security definer set search_path to 'public' as $f$ begin return public.marcar_visto_interno(public.convite_alvo(p_convite, null)); end $f$;
create or replace function public.responder_convite(p_convite uuid, p_vai boolean, p_motivo text default '') returns void
language plpgsql security definer set search_path to 'public' as $f$ begin perform public.responder_interno(public.convite_alvo(p_convite, null), p_vai, p_motivo); end $f$;
create or replace function public.enviar_proposta_concorrencia(p_convite uuid, p jsonb) returns integer
language plpgsql security definer set search_path to 'public' as $f$ begin return public.proposta_interna(public.convite_alvo(p_convite, null), p, false); end $f$;
create or replace function public.escrever_como_convidada(p_convite uuid, p_texto text) returns uuid
language plpgsql security definer set search_path to 'public' as $f$ begin return public.mensagem_interna(public.convite_alvo(p_convite, null), p_texto, null, false); end $f$;
-- Pelo link (só a função de borda, com a chave de serviço):
create or replace function public.visto_por_token(p_token text) returns uuid
language plpgsql security definer set search_path to 'public' as $f$ begin return public.marcar_visto_interno(public.convite_alvo(null, p_token)); end $f$;
create or replace function public.responder_por_token(p_token text, p_vai boolean, p_motivo text default '') returns void
language plpgsql security definer set search_path to 'public' as $f$ begin perform public.responder_interno(public.convite_alvo(null, p_token), p_vai, p_motivo); end $f$;
create or replace function public.proposta_por_token(p_token text, p jsonb) returns integer
language plpgsql security definer set search_path to 'public' as $f$ begin return public.proposta_interna(public.convite_alvo(null, p_token), p, true); end $f$;
create or replace function public.escrever_por_token(p_token text, p_texto text, p_por text default '') returns uuid
language plpgsql security definer set search_path to 'public' as $f$ begin return public.mensagem_interna(public.convite_alvo(null, p_token), p_texto, p_por, true); end $f$;

-- "Vou cotar" com o Measure: o projeto criado fica ligado ao convite (e o projeto guarda a concorrência).
create or replace function public.vincular_projeto_ao_convite(p_convite uuid, p_projeto uuid) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare v public.concorrencia_convites := public.convite_alvo(p_convite, null); c public.concorrencias;
begin
  if not exists (select 1 from public.projetos where id = p_projeto and empresa_id = v.convidada_id) then raise exception 'Projeto não encontrado.'; end if;
  select * into c from public.concorrencias where id = v.concorrencia_id;
  update public.concorrencia_convites set projeto_id = p_projeto where id = v.id;
  update public.projetos set concorrencia = jsonb_build_object('id', c.id, 'conviteId', v.id, 'contratanteId', c.empresa_id) where id = p_projeto;
end $f$;

-- ---------- Selar o vínculo (CO-06, CO-14): a vencedora cria a obra já ligada à obra da contratante ----------

-- p: os campos da obra como no insert direto (nome, contratante_id, dono_id, endereco, municipio, estado, zip, lat, lon, raio, inicio, prazo, responsavel_id, dias_trabalho).
create or replace function public.criar_obra_da_concorrencia(p_convite uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare v public.concorrencia_convites; c public.concorrencias; v_obra uuid; eu public.membros := public.meu_membro();
begin
  if eu.id is null or not public.tenho_permissao('settings.obras') then raise exception 'Sem permissão para criar obras.'; end if;
  select * into v from public.concorrencia_convites where id = p_convite and convidada_id = eu.empresa_id;
  if v.id is null or v.situacao <> 'vencedora' then raise exception 'Esta empresa não venceu esta concorrência.'; end if;
  select * into c from public.concorrencias where id = v.concorrencia_id;
  if c.obra_id is null then raise exception 'A contratante ainda não ligou a concorrência a uma obra.'; end if;
  if exists (select 1 from public.obras where empresa_id = eu.empresa_id and concorrencia_id = c.id) then raise exception 'A obra desta concorrência já existe.'; end if;
  perform set_config('kb.conc_funcao', '1', true);
  insert into public.obras (empresa_id, nome, contratante_id, dono_id, endereco, municipio, estado, zip, lat, lon, raio, inicio, prazo, responsavel_id, dias_trabalho, projeto_id,
                            vinculo_empresa_id, vinculo_obra_id, concorrencia_id)
  values (eu.empresa_id, p ->> 'nome', (p ->> 'contratante_id')::uuid, nullif(p ->> 'dono_id', '')::uuid, coalesce(p ->> 'endereco', ''), p ->> 'municipio', p ->> 'estado', coalesce(p ->> 'zip', ''),
          (p ->> 'lat')::double precision, (p ->> 'lon')::double precision, coalesce(nullif(p ->> 'raio', '')::int, 150), (p ->> 'inicio')::date, (p ->> 'prazo')::date,
          nullif(p ->> 'responsavel_id', '')::uuid, coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(p -> 'dias_trabalho') x), '{1,2,3,4,5}'::smallint[]), v.projeto_id,
          c.empresa_id, c.obra_id, c.id)
  returning id into v_obra;
  if v.projeto_id is not null then update public.projetos set obra_id = v_obra where id = v.projeto_id and empresa_id = eu.empresa_id; end if;
  return v_obra;
end $f$;

-- ---------- CO-07, segunda metade: quem cria a conta com o e-mail do link traz os convites ----------

create or replace function public.ligar_conta_aos_convites() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare v_email text := lower((select email from auth.users where id = new.user_id)); v public.concorrencia_convites;
begin
  if v_email is null then return null; end if;
  perform set_config('kb.conc_funcao', '1', true);
  for v in select * from public.concorrencia_convites where convidada_id is null and lower(email) = v_email and empresa_id <> new.empresa_id loop
    update public.concorrencia_convites set convidada_id = new.empresa_id where id = v.id;
    update public.contatos set conta_empresa_id = new.empresa_id where id = v.contato_id and conta_empresa_id is null;
  end loop;
  return null;
end $f$;
create trigger membros_ligar_convites after insert on public.membros for each row execute function public.ligar_conta_aos_convites();

-- ---------- Storage (bucket privado "concorrencias") ----------
-- {contratante}/{concorrencia}/desenhos/{arquivo}.pdf e {contratante}/{concorrencia}/propostas/{convite}/rev-N.pdf

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('concorrencias', 'concorrencias', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

-- a contratante (concorrencias.gerir) na própria pasta; a convidada com conta lê os desenhos e grava a proposta na pasta do seu convite
create or replace function public.posso_mexer_na_concorrencia(p_nome text, p_gravar boolean) returns boolean
language plpgsql stable security definer set search_path to 'public' as $f$
declare partes text[] := storage.foldername(p_nome); v public.concorrencia_convites;
begin
  if cardinality(partes) < 3 then return false; end if;
  if partes[1] = public.minha_empresa()::text then return public.giro_concorrencias(); end if;
  select * into v from public.concorrencia_convites where concorrencia_id = partes[2]::uuid and convidada_id = public.minha_empresa();
  if v.id is null or not public.respondo_concorrencias() then return false; end if;
  if partes[3] = 'desenhos' then return not p_gravar; end if;
  return partes[3] = 'propostas' and partes[4] = v.id::text;
exception when others then return false;
end $f$;
create policy concorrencias_ler on storage.objects for select to authenticated using (bucket_id = 'concorrencias' and public.posso_mexer_na_concorrencia(name, false));
create policy concorrencias_gravar on storage.objects for insert to authenticated with check (bucket_id = 'concorrencias' and public.posso_mexer_na_concorrencia(name, true));
create policy concorrencias_apagar on storage.objects for delete to authenticated using (bucket_id = 'concorrencias' and public.posso_mexer_na_concorrencia(name, true));

-- ---------- Acesso ----------

alter table public.concorrencias enable row level security;
alter table public.concorrencia_desenhos enable row level security;
alter table public.concorrencia_convites enable row level security;
alter table public.concorrencia_propostas enable row level security;
alter table public.concorrencia_mensagens enable row level security;
alter table public.concorrencia_historico enable row level security;

-- só a contratante, com concorrencias.gerir; o que muda depois de enviada é dos gatilhos e das funções
create policy concorrencias_tudo on public.concorrencias for all to authenticated using (empresa_id = public.minha_empresa() and public.giro_concorrencias()) with check (empresa_id = public.minha_empresa() and public.giro_concorrencias());
create policy concorrencia_desenhos_tudo on public.concorrencia_desenhos for all to authenticated using (empresa_id = public.minha_empresa() and public.giro_concorrencias()) with check (empresa_id = public.minha_empresa() and public.giro_concorrencias());
create policy concorrencia_convites_tudo on public.concorrencia_convites for all to authenticated using (empresa_id = public.minha_empresa() and public.giro_concorrencias()) with check (empresa_id = public.minha_empresa() and public.giro_concorrencias());
create policy concorrencia_propostas_ler on public.concorrencia_propostas for select to authenticated using (empresa_id = public.minha_empresa() and public.giro_concorrencias());
create policy concorrencia_mensagens_ler on public.concorrencia_mensagens for select to authenticated using (empresa_id = public.minha_empresa() and public.giro_concorrencias());
create policy concorrencia_historico_ler on public.concorrencia_historico for select to authenticated using (empresa_id = public.minha_empresa() and public.giro_concorrencias());

revoke all on public.concorrencias, public.concorrencia_desenhos, public.concorrencia_convites, public.concorrencia_propostas, public.concorrencia_mensagens, public.concorrencia_historico from anon, authenticated;
grant select, insert, update, delete on public.concorrencias, public.concorrencia_desenhos, public.concorrencia_convites to authenticated;
grant select on public.concorrencia_propostas, public.concorrencia_mensagens, public.concorrencia_historico to authenticated;

revoke all on function public.ajustar_concorrencia(), public.guarda_concorrencia(), public.guarda_desenho(), public.ajustar_convite(), public.guarda_convite(), public.guarda_so_insert_conc(),
  public.guarda_concorrencia_do_projeto(), public.ligar_conta_aos_convites(), public.auditar_na_convidada(uuid, uuid, text, jsonb), public.registrar_na_concorrencia(public.concorrencias, text, text),
  public.minha_concorrencia(uuid), public.novo_token_do_convite(uuid), public.pendencias_de_envio(public.concorrencias), public.autor_da_contratante(uuid), public.ultima_proposta(uuid),
  public.concluir_fechamento(public.concorrencias, public.concorrencia_convites, public.concorrencia_propostas, text, uuid, text), public.visao_do_convite(public.concorrencia_convites),
  public.convite_alvo(uuid, text), public.conc_aberta_para(public.concorrencias), public.marcar_visto_interno(public.concorrencia_convites), public.responder_interno(public.concorrencia_convites, boolean, text),
  public.proposta_interna(public.concorrencia_convites, jsonb, boolean), public.mensagem_interna(public.concorrencia_convites, text, text, boolean)
  from public, anon, authenticated;
-- os gatilhos "invoker" das tabelas (e o de projetos) perguntam se estão dentro de uma função desta fatia
revoke all on function public.em_funcao_de_concorrencia() from public, anon;
grant execute on function public.em_funcao_de_concorrencia() to authenticated;
revoke all on function public.giro_concorrencias(), public.respondo_concorrencias(), public.situacao_da_concorrencia(public.concorrencias), public.enviar_concorrencia(uuid),
  public.prorrogar_concorrencia(uuid, timestamptz, text), public.convidar_mais(uuid, uuid[]), public.adendo(uuid, text, jsonb), public.fechar_concorrencia(uuid, uuid, text),
  public.pedidos_de_quarteirizacao(), public.decidir_quarteirizacao(uuid, boolean, text), public.cancelar_concorrencia(uuid, text), public.cancelar_concorrencias_do_projeto(uuid),
  public.escrever_como_contratante(uuid, uuid, uuid, boolean, text), public.concorrencias_recebidas(uuid), public.marcar_visto(uuid), public.responder_convite(uuid, boolean, text),
  public.enviar_proposta_concorrencia(uuid, jsonb), public.escrever_como_convidada(uuid, text), public.vincular_projeto_ao_convite(uuid, uuid), public.criar_obra_da_concorrencia(uuid, jsonb),
  public.posso_mexer_na_concorrencia(text, boolean) from public, anon;
grant execute on function public.giro_concorrencias(), public.respondo_concorrencias(), public.situacao_da_concorrencia(public.concorrencias), public.enviar_concorrencia(uuid),
  public.prorrogar_concorrencia(uuid, timestamptz, text), public.convidar_mais(uuid, uuid[]), public.adendo(uuid, text, jsonb), public.fechar_concorrencia(uuid, uuid, text),
  public.pedidos_de_quarteirizacao(), public.decidir_quarteirizacao(uuid, boolean, text), public.cancelar_concorrencia(uuid, text), public.cancelar_concorrencias_do_projeto(uuid),
  public.escrever_como_contratante(uuid, uuid, uuid, boolean, text), public.concorrencias_recebidas(uuid), public.marcar_visto(uuid), public.responder_convite(uuid, boolean, text),
  public.enviar_proposta_concorrencia(uuid, jsonb), public.escrever_como_convidada(uuid, text), public.vincular_projeto_ao_convite(uuid, uuid), public.criar_obra_da_concorrencia(uuid, jsonb),
  public.posso_mexer_na_concorrencia(text, boolean) to authenticated;
-- pelo link: só a chave de serviço (função de borda convite-publico)
revoke all on function public.convite_por_token(text), public.visto_por_token(text), public.responder_por_token(text, boolean, text), public.proposta_por_token(text, jsonb), public.escrever_por_token(text, text, text)
  from public, anon, authenticated;
grant execute on function public.convite_por_token(text), public.visto_por_token(text), public.responder_por_token(text, boolean, text), public.proposta_por_token(text, jsonb), public.escrever_por_token(text, text, text)
  to service_role;

commit;
