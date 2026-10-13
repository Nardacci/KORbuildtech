-- KORbuild · fatia 6 do banco (docs/banco.md §6 e §13): o Measure.
-- Projetos, folhas (plantas no Storage "plantas"), condições com as medições dentro, typicals, catálogo (itens e
-- assemblies), preços e margens com vigência (só insert) e propostas emitidas (só insert, numeradas pelo banco).
-- O motor de cálculo (unidades, geometria, fórmulas, preço de venda) fica no app; o banco garante:
--   · tudo é da própria empresa (prestadora ou ambas; a construtora não tem Measure, HS-09);
--   · medir (projetos, folhas, condições, typicals, emitir) exige measure.medir; catálogo, preços e margens, measure.catalogo;
--   · dinheiro (preços, margens, o retrato da proposta com custo) só para measure.catalogo ou crew.custos;
--   · preços, margens e propostas nunca mudam nem saem (BD-04); item usado em assembly não sai;
--   · typicals não se sobrepõem e a folha inteira não convive com região (TY-04);
--   · a proposta emitida recebe P-AAAA-NNN (sequência por empresa e ano) e fica congelada; as propostas ficam mesmo sem o projeto.
-- Só CRIA; não apaga nada. Rodar este arquivo e depois supabase/testes/0006_measure.sql.

begin;

-- ---------- Projetos ----------

create table public.projetos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 160),
  contratante_id uuid not null,
  dono_id uuid,
  endereco text not null default '', cidade text not null check (btrim(cidade) <> ''), estado text not null check (estado ~ '^[A-Z]{2}$'),
  zip text not null default '' check (zip = '' or zip ~ '^\d{5}(-\d{4})?$'),
  tipo text not null, situacao text not null default 'orcamento' check (situacao in ('orcamento', 'enviada', 'ganha', 'perdida', 'cancelada')),
  descricao text not null default '',
  obra_id uuid,
  estimador_id uuid,
  prazo_proposta date,
  proposta_rascunho jsonb not null default '{}'::jsonb,
  cotacao jsonb not null default '{}'::jsonb,            -- envios aos fornecedores
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id),
  check (jsonb_typeof(proposta_rascunho) = 'object' and jsonb_typeof(cotacao) = 'object'),
  foreign key (empresa_id, contratante_id) references public.contatos (empresa_id, id),
  foreign key (empresa_id, dono_id) references public.contatos (empresa_id, id),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id) on delete set null,
  foreign key (empresa_id, estimador_id) references public.membros (empresa_id, id)
);
create index projetos_empresa on public.projetos (empresa_id, nome);
create or replace function public.ajustar_projeto() returns trigger
language plpgsql as $f$
begin
  new.nome := btrim(new.nome); new.estado := upper(new.estado);
  if new.dono_id = new.contratante_id then new.dono_id := null; end if;
  if tg_op = 'UPDATE' then new.atualizado_em := now(); end if;
  return new;
end $f$;
create trigger projetos_ajustar before insert or update on public.projetos for each row execute function public.ajustar_projeto();

-- ---------- Folhas (plantas) ----------

create table public.folhas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  projeto_id uuid not null,
  nome text not null check (btrim(nome) <> ''),
  arquivo_path text not null,                            -- Storage: {empresa}/{projeto}/{arquivo}.pdf
  arquivo_nome text not null default '',
  pagina integer not null default 1 check (pagina >= 1),
  escala jsonb,                                          -- {polPorPt, origem, conferencia, em}
  criada_em timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, projeto_id) references public.projetos (empresa_id, id) on delete cascade
);
create index folhas_projeto on public.folhas (projeto_id, criada_em);
-- a planta fica na pasta da empresa e do projeto
create or replace function public.guarda_folha() returns trigger
language plpgsql as $f$
begin
  if new.arquivo_path not like new.empresa_id || '/' || new.projeto_id || '/%' then raise exception 'A planta precisa estar na pasta do projeto.'; end if;
  return new;
end $f$;
create trigger folhas_guarda before insert or update on public.folhas for each row execute function public.guarda_folha();

-- ---------- Condições (com as medições dentro) ----------

create table public.condicoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  projeto_id uuid not null,
  nome text not null check (btrim(nome) <> ''),
  tipo text not null check (tipo in ('linear', 'area', 'contagem')),
  cor text not null default '' check (cor = '' or cor ~ '^#[0-9A-F]{6}$'),
  props jsonb not null default '{}'::jsonb,
  assemblies uuid[] not null default '{}',
  folhas uuid[] not null default '{}',
  oculta boolean not null default false,
  medicoes jsonb not null default '[]'::jsonb,           -- [{id, folhaId, pontos, desconto, vao, vaoDe, em}] em points do PDF
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id),
  check (jsonb_typeof(props) = 'object' and jsonb_typeof(medicoes) = 'array'),
  foreign key (empresa_id, projeto_id) references public.projetos (empresa_id, id) on delete cascade
);
create index condicoes_projeto on public.condicoes (projeto_id, criado_em);
-- A versão sobe a cada gravação; quem manda a versão antiga (outro computador mexeu) é recusado.
create or replace function public.guarda_condicao() returns trigger
language plpgsql as $f$
begin
  if tg_op = 'UPDATE' then
    if new.projeto_id <> old.projeto_id or new.tipo <> old.tipo then raise exception 'Não é possível trocar o projeto ou o tipo de uma condição.'; end if;
    if new.versao <> old.versao then raise exception 'KB_CONFLITO: a condição mudou em outro computador (versão %).', old.versao using errcode = 'P0409'; end if;
    new.versao := old.versao + 1;
    new.atualizado_em := now();
  end if;
  new.nome := btrim(new.nome); new.cor := upper(new.cor);
  return new;
end $f$;
create trigger condicoes_guarda before insert or update on public.condicoes for each row execute function public.guarda_condicao();

-- ---------- Typicals ----------

create table public.typicais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  projeto_id uuid not null,
  folha_id uuid not null,
  nome text not null check (btrim(nome) <> ''),
  regiao jsonb,                                          -- [x1, y1, x2, y2] em points; null = a folha inteira
  ocorrencias jsonb not null,                            -- [{rotulo, quantidade}]
  por uuid, por_nome text not null default '',
  em timestamptz not null default now(),
  check (jsonb_typeof(ocorrencias) = 'array' and jsonb_array_length(ocorrencias) > 0),
  check (regiao is null or (jsonb_typeof(regiao) = 'array' and jsonb_array_length(regiao) = 4)),
  foreign key (empresa_id, projeto_id) references public.projetos (empresa_id, id) on delete cascade,
  foreign key (empresa_id, folha_id) references public.folhas (empresa_id, id) on delete cascade
);
create index typicais_folha on public.typicais (folha_id);
create or replace function public.guarda_typical() returns trigger
language plpgsql as $f$
declare o record;
begin
  new.nome := btrim(new.nome);
  new.por := coalesce(auth.uid(), new.por);
  if exists (select 1 from jsonb_array_elements(new.ocorrencias) x
              where btrim(coalesce(x ->> 'rotulo', '')) = '' or jsonb_typeof(x -> 'quantidade') <> 'number' or (x ->> 'quantidade')::numeric < 1 or (x ->> 'quantidade')::numeric <> floor((x ->> 'quantidade')::numeric)) then
    raise exception 'Cada ocorrência precisa de um nome (ex.: 2º pavimento) e de uma quantidade inteira a partir de 1.';
  end if;
  for o in select * from public.typicais t where t.folha_id = new.folha_id and t.id <> new.id loop
    if new.regiao is null then raise exception 'Esta folha já tem typical por região. Para a folha inteira, tire os outros antes.'; end if;
    if o.regiao is null then raise exception 'Esta folha inteira já é um typical. Edite as ocorrências dele.'; end if;
    if not ((new.regiao ->> 2)::numeric < (o.regiao ->> 0)::numeric or (new.regiao ->> 0)::numeric > (o.regiao ->> 2)::numeric
            or (new.regiao ->> 3)::numeric < (o.regiao ->> 1)::numeric or (new.regiao ->> 1)::numeric > (o.regiao ->> 3)::numeric) then
      raise exception 'A região encosta em outro typical. Typicals não podem se sobrepor.';
    end if;
  end loop;
  return new;
end $f$;
create trigger typicais_guarda before insert or update on public.typicais for each row execute function public.guarda_typical();

-- ---------- Catálogo: itens, preços, assemblies, margens ----------

create table public.itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  codigo text not null default '',
  nome text not null check (btrim(nome) <> ''),
  categoria text not null check (categoria in ('material', 'mao-de-obra', 'equipamento', 'subempreiteiro')),
  unidade text not null check (btrim(unidade) <> ''),
  etapa text not null default '',
  nota text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id)
);
create unique index itens_codigo on public.itens (empresa_id, lower(codigo)) where codigo <> '';
create or replace function public.ajustar_item() returns trigger
language plpgsql as $f$
begin
  new.codigo := btrim(new.codigo); new.nome := btrim(new.nome); new.unidade := btrim(new.unidade); new.etapa := btrim(new.etapa);
  if tg_op = 'UPDATE' then new.atualizado_em := now(); end if;
  return new;
end $f$;
create trigger itens_ajustar before insert or update on public.itens for each row execute function public.ajustar_item();

create table public.item_precos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  item_id uuid not null,
  desde date not null,
  valor numeric(12,2) not null check (valor > 0),
  fonte text not null default 'digitado',
  fornecedor_id uuid,
  por uuid, por_nome text not null default '',
  em timestamptz not null default now(),
  foreign key (empresa_id, item_id) references public.itens (empresa_id, id) on delete cascade,
  foreign key (empresa_id, fornecedor_id) references public.contatos (empresa_id, id) on delete set null
);
create index item_precos_item on public.item_precos (item_id, desde desc, em desc);

create table public.assemblies (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  tipo text not null check (tipo in ('linear', 'area', 'contagem')),
  descricao text not null default '',
  linhas jsonb not null,                                 -- [{id, itemId, formula, perda, passo}]
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (jsonb_typeof(linhas) = 'array' and jsonb_array_length(linhas) > 0)
);
create index assemblies_empresa on public.assemblies (empresa_id, nome);
-- Cada linha aponta um item da empresa; a fórmula só com o alfabeto das fórmulas (o app valida com o mathjs restrito).
create or replace function public.guarda_assembly() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare l jsonb;
begin
  new.nome := btrim(new.nome);
  if tg_op = 'UPDATE' then
    if new.tipo <> old.tipo then raise exception 'Não é possível trocar o tipo de um assembly.'; end if;
    new.atualizado_em := now();
  end if;
  for l in select x from jsonb_array_elements(new.linhas) x loop
    if not exists (select 1 from public.itens where id = (l ->> 'itemId')::uuid and empresa_id = new.empresa_id) then raise exception 'Linha do assembly com item que não é da empresa.'; end if;
    if btrim(coalesce(l ->> 'formula', '')) = '' or (l ->> 'formula') !~ '^[A-Za-z0-9_ .,+\-*/()^]+$' then raise exception 'Fórmula inválida na linha do assembly.'; end if;
    if coalesce((l ->> 'perda')::numeric, 0) not between 0 and 100 then raise exception 'A perda deve ficar entre 0 e 100%%.'; end if;
  end loop;
  return new;
end $f$;
create trigger assemblies_guarda before insert or update on public.assemblies for each row execute function public.guarda_assembly();

-- Item usado em assembly não sai (o app mostra em quais).
create or replace function public.guarda_item() returns trigger
language plpgsql as $f$
begin
  if not exists (select 1 from public.empresas where id = old.empresa_id) then return old; end if;
  if exists (select 1 from public.assemblies a, jsonb_array_elements(a.linhas) l where a.empresa_id = old.empresa_id and (l ->> 'itemId')::uuid = old.id) then
    raise exception 'Item usado em assembly: tire do assembly antes.';
  end if;
  return old;
end $f$;
create trigger itens_guarda before delete on public.itens for each row execute function public.guarda_item();

create table public.margens_versoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  desde date not null,
  overhead_pct numeric(5,2) not null check (overhead_pct >= 0 and overhead_pct < 100),
  lucro_pct numeric(5,2) not null check (lucro_pct >= 0 and lucro_pct < 100),
  modo text not null check (modo in ('markup', 'margem')),
  imposto_material_pct numeric(5,2) not null default 0 check (imposto_material_pct >= 0 and imposto_material_pct < 100),
  motivo text not null check (btrim(motivo) <> ''),
  por uuid, por_nome text not null default '',
  em timestamptz not null default now()
);
create index margens_versoes_empresa on public.margens_versoes (empresa_id, desde desc, em desc);

-- ---------- Propostas emitidas ----------

create table public.propostas_emitidas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  projeto_id uuid,                                       -- sem chave estrangeira: a proposta fica mesmo sem o projeto
  projeto_nome text not null default '',
  numero text not null,                                  -- P-AAAA-NNN, sequência por empresa e ano
  emitida_em timestamptz not null default now(),
  por uuid, por_nome text not null default '',
  total numeric(12,2) not null check (total >= 0),
  retrato jsonb not null,                                -- o documento inteiro (com custo e margem, só para dentro)
  pdf_path text,
  unique (empresa_id, numero)
);
create index propostas_emitidas_projeto on public.propostas_emitidas (empresa_id, projeto_id, emitida_em desc);

-- ---------- Guardas de "só insert" ----------

create or replace function public.guarda_so_insert_measure() returns trigger
language plpgsql as $f$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.empresas where id = old.empresa_id) then return old; end if;
  -- o item que sai (sem assembly) leva os preços dele (a auditoria guarda o histórico)
  if tg_op = 'DELETE' and tg_table_name = 'item_precos' and not exists (select 1 from public.itens where id = old.item_id) then return old; end if;
  raise exception 'Este registro não pode ser alterado nem apagado.';
end $f$;
create trigger item_precos_guarda before update or delete on public.item_precos for each row execute function public.guarda_so_insert_measure();
create trigger margens_versoes_guarda before update or delete on public.margens_versoes for each row execute function public.guarda_so_insert_measure();
create trigger propostas_emitidas_guarda before update or delete on public.propostas_emitidas for each row execute function public.guarda_so_insert_measure();

-- quem gravou o preço e a margem (o app não escolhe o autor)
create or replace function public.carimbar_autor_nome() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  new.por := auth.uid();
  new.por_nome := coalesce((select nome from public.membros where user_id = auth.uid()), '');
  new.em := now();
  return new;
end $f$;
create trigger item_precos_autor before insert on public.item_precos for each row execute function public.carimbar_autor_nome();
create trigger margens_versoes_autor before insert on public.margens_versoes for each row execute function public.carimbar_autor_nome();

-- ---------- Auditoria (BD-05) ----------

create trigger projetos_auditar after insert or update or delete on public.projetos for each row execute function public.auditar();
create trigger itens_auditar after insert or update or delete on public.itens for each row execute function public.auditar();
create trigger item_precos_auditar after insert on public.item_precos for each row execute function public.auditar();
create trigger assemblies_auditar after insert or update or delete on public.assemblies for each row execute function public.auditar();
create trigger margens_versoes_auditar after insert on public.margens_versoes for each row execute function public.auditar();
create trigger propostas_emitidas_auditar after insert on public.propostas_emitidas for each row execute function public.auditar();

-- ---------- RLS ----------

-- O Measure é de quem executa (prestadora ou ambas); a construtora não tem (HS-09).
create or replace function public.tenho_measure() returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select public.tenho_permissao('measure.medir') and (select atuacao from public.empresas where id = public.minha_empresa()) in ('prestadora', 'ambas')
$f$;
create or replace function public.vejo_dinheiro_do_measure() returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select public.tenho_measure() and (public.tenho_permissao('measure.catalogo') or public.tenho_permissao('crew.custos'))
$f$;
create or replace function public.mexo_no_catalogo() returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select public.tenho_measure() and public.tenho_permissao('measure.catalogo')
$f$;

alter table public.projetos enable row level security;
alter table public.folhas enable row level security;
alter table public.condicoes enable row level security;
alter table public.typicais enable row level security;
alter table public.itens enable row level security;
alter table public.item_precos enable row level security;
alter table public.assemblies enable row level security;
alter table public.margens_versoes enable row level security;
alter table public.propostas_emitidas enable row level security;

-- medir: projetos, folhas, condições e typicals (ler e gravar)
create policy projetos_tudo on public.projetos for all to authenticated using (empresa_id = public.minha_empresa() and public.tenho_measure()) with check (empresa_id = public.minha_empresa() and public.tenho_measure());
create policy folhas_tudo on public.folhas for all to authenticated using (empresa_id = public.minha_empresa() and public.tenho_measure()) with check (empresa_id = public.minha_empresa() and public.tenho_measure());
create policy condicoes_tudo on public.condicoes for all to authenticated using (empresa_id = public.minha_empresa() and public.tenho_measure()) with check (empresa_id = public.minha_empresa() and public.tenho_measure());
create policy typicais_tudo on public.typicais for all to authenticated using (empresa_id = public.minha_empresa() and public.tenho_measure()) with check (empresa_id = public.minha_empresa() and public.tenho_measure());
-- catálogo: todos do Measure leem itens e assemblies; só o catálogo grava
create policy itens_ler on public.itens for select to authenticated using (empresa_id = public.minha_empresa() and public.tenho_measure());
create policy itens_gravar on public.itens for insert to authenticated with check (empresa_id = public.minha_empresa() and public.mexo_no_catalogo());
create policy itens_editar on public.itens for update to authenticated using (empresa_id = public.minha_empresa() and public.mexo_no_catalogo()) with check (empresa_id = public.minha_empresa());
create policy itens_excluir on public.itens for delete to authenticated using (empresa_id = public.minha_empresa() and public.mexo_no_catalogo());
create policy assemblies_ler on public.assemblies for select to authenticated using (empresa_id = public.minha_empresa() and public.tenho_measure());
create policy assemblies_gravar on public.assemblies for insert to authenticated with check (empresa_id = public.minha_empresa() and public.mexo_no_catalogo());
create policy assemblies_editar on public.assemblies for update to authenticated using (empresa_id = public.minha_empresa() and public.mexo_no_catalogo()) with check (empresa_id = public.minha_empresa());
create policy assemblies_excluir on public.assemblies for delete to authenticated using (empresa_id = public.minha_empresa() and public.mexo_no_catalogo());
-- dinheiro: preços e margens
create policy item_precos_ler on public.item_precos for select to authenticated using (empresa_id = public.minha_empresa() and public.vejo_dinheiro_do_measure());
create policy item_precos_gravar on public.item_precos for insert to authenticated with check (empresa_id = public.minha_empresa() and public.mexo_no_catalogo());
create policy margens_versoes_ler on public.margens_versoes for select to authenticated using (empresa_id = public.minha_empresa() and public.vejo_dinheiro_do_measure());
create policy margens_versoes_gravar on public.margens_versoes for insert to authenticated with check (empresa_id = public.minha_empresa() and public.mexo_no_catalogo());
-- propostas emitidas: quem mede lê (o retrato leva custo e margem: a tela só mostra isso a quem vê dinheiro)
create policy propostas_emitidas_ler on public.propostas_emitidas for select to authenticated using (empresa_id = public.minha_empresa() and public.tenho_measure());

revoke all on public.projetos, public.folhas, public.condicoes, public.typicais, public.itens, public.item_precos, public.assemblies,
  public.margens_versoes, public.propostas_emitidas from anon, authenticated;
grant select, insert, update, delete on public.projetos, public.folhas, public.condicoes, public.typicais, public.itens, public.assemblies to authenticated;
grant select, insert on public.item_precos, public.margens_versoes to authenticated;
grant select on public.propostas_emitidas to authenticated;
-- a situação "enviada" nasce da emissão (função); o app muda as outras
revoke update (criado_em) on public.projetos from authenticated;

-- ---------- Emitir a proposta ----------

-- O app monta o retrato (linhas com preço, extras, custo, margem…) e o banco numera, carimba e congela.
-- p_retrato: {contratante, linhas: [{titulo, valor}], extras: [{descricao, valor}], total, ...}
create or replace function public.emitir_proposta(p_projeto uuid, p_retrato jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); p public.projetos; v_ano text; v_n int; v_numero text; v_total numeric; v_soma numeric; r public.propostas_emitidas;
begin
  if eu.id is null or not public.tenho_measure() then raise exception 'Sem permissão para emitir propostas.'; end if;
  select * into p from public.projetos where id = p_projeto and empresa_id = eu.empresa_id for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  if p.situacao in ('perdida', 'cancelada') then raise exception 'Este projeto está encerrado.'; end if;
  if jsonb_typeof(p_retrato -> 'contratante') is distinct from 'object' then raise exception 'Escolha o contratante do projeto antes de emitir.'; end if;
  if coalesce(jsonb_array_length(p_retrato -> 'linhas'), 0) + coalesce(jsonb_array_length(p_retrato -> 'extras'), 0) = 0 then raise exception 'A proposta não tem itens.'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_retrato -> 'linhas', '[]')) l where coalesce((l ->> 'valor')::numeric, 0) <= 0)
     or exists (select 1 from jsonb_array_elements(coalesce(p_retrato -> 'extras', '[]')) x where coalesce((x ->> 'valor')::numeric, 0) <= 0) then
    raise exception 'Falta o preço de uma das linhas. Ou tire a linha da proposta.';
  end if;
  select coalesce(sum((l ->> 'valor')::numeric), 0) into v_soma from jsonb_array_elements(coalesce(p_retrato -> 'linhas', '[]')) l;
  select v_soma + coalesce(sum((x ->> 'valor')::numeric), 0) into v_soma from jsonb_array_elements(coalesce(p_retrato -> 'extras', '[]')) x;
  v_total := round(coalesce((p_retrato ->> 'total')::numeric, v_soma), 2);
  if abs(v_total - round(v_soma, 2)) > 0.01 then raise exception 'O total da proposta não bate com as linhas.'; end if;
  v_ano := to_char(public.hoje_da_empresa(eu.empresa_id), 'YYYY');
  perform 1 from public.empresas where id = eu.empresa_id for update;   -- numeração sem corrida
  select coalesce(max(substr(numero, 8)::int), 0) + 1 into v_n from public.propostas_emitidas where empresa_id = eu.empresa_id and numero like 'P-' || v_ano || '-%';
  v_numero := 'P-' || v_ano || '-' || lpad(v_n::text, 3, '0');
  insert into public.propostas_emitidas (empresa_id, projeto_id, projeto_nome, numero, por, por_nome, total, retrato)
  values (eu.empresa_id, p.id, p.nome, v_numero, auth.uid(), eu.nome, v_total, p_retrato || jsonb_build_object('numero', v_numero, 'por', eu.nome))
  returning * into r;
  if p.situacao = 'orcamento' then update public.projetos set situacao = 'enviada' where id = p.id; end if;
  return jsonb_build_object('id', r.id, 'numero', r.numero, 'emitida_em', r.emitida_em, 'total', r.total);
end $f$;

-- ---------- Plantas no Storage (bucket privado "plantas": {empresa}/{projeto}/{arquivo}.pdf) ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plantas', 'plantas', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create or replace function public.posso_mexer_na_planta(p_nome text) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select (storage.foldername(p_nome))[1] = public.minha_empresa()::text and public.tenho_measure()
$f$;
create policy plantas_ler on storage.objects for select to authenticated using (bucket_id = 'plantas' and public.posso_mexer_na_planta(name));
create policy plantas_gravar on storage.objects for insert to authenticated with check (bucket_id = 'plantas' and public.posso_mexer_na_planta(name));
create policy plantas_apagar on storage.objects for delete to authenticated using (bucket_id = 'plantas' and public.posso_mexer_na_planta(name));

-- ---------- Permissões das funções ----------

revoke all on function public.ajustar_projeto(), public.guarda_folha(), public.guarda_condicao(), public.guarda_typical(), public.ajustar_item(), public.guarda_assembly(),
  public.guarda_item(), public.guarda_so_insert_measure(), public.carimbar_autor_nome() from public, anon, authenticated;
revoke all on function public.tenho_measure(), public.vejo_dinheiro_do_measure(), public.mexo_no_catalogo(), public.emitir_proposta(uuid, jsonb), public.posso_mexer_na_planta(text) from public, anon;
grant execute on function public.tenho_measure(), public.vejo_dinheiro_do_measure(), public.mexo_no_catalogo(), public.emitir_proposta(uuid, jsonb), public.posso_mexer_na_planta(text) to authenticated;

commit;
