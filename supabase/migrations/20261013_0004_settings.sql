-- KORbuild · fatia 2 do banco (docs/banco.md §3, §4, §9): os cadastros do Settings.
-- Funcionários (com valor hora por vigência e certificações), encargos e regras de jornada (versões com vigência),
-- contatos, obras, alocações (quem trabalha em qual obra) e modelos de etapas do cronograma; e o "meu perfil".
-- Regras do protótipo (js/settings.js, js/crew.js, js/contatos.js, js/obras.js) passam para o banco:
--   · toda tabela tem empresa_id e só é lida por quem é da empresa (BD-01); escrever exige a permissão do Settings;
--   · valor hora, encargos e regras só recebem INSERT (BD-04): corrigir é inserir uma versão nova;
--   · encargos e regras não valem para o passado (semana atual em diante, no fuso da empresa);
--   · referências entre cadastros só dentro da mesma empresa (chaves estrangeiras compostas com empresa_id);
--   · valor hora e encargos (dinheiro) só para quem cuida dos funcionários/regras ou vê custos (crew.custos);
--   · tudo vai para a auditoria pelo gatilho auditar().
-- Fica para a fatia 4 (Crew): equipes (funcionarios.equipe_id) e a trava "valor hora não começa dentro de semana
-- aprovada" (SET-014), que depende de aprovacoes_semana.
-- Só CRIA; não apaga nada. Rodar este arquivo e depois supabase/testes/0002_settings.sql.

begin;

-- ---------- Apoio ----------

-- "Hoje" no fuso da empresa (configuracao.fuso; padrão: Nova York). Encargos e regras valem da semana atual em diante.
create or replace function public.hoje_da_empresa(p_empresa uuid) returns date
language sql stable security definer set search_path to 'public' as $f$
  select (now() at time zone coalesce((select configuracao ->> 'fuso' from public.empresas where id = p_empresa), 'America/New_York'))::date
$f$;
create or replace function public.segunda_de(d date) returns date
language sql immutable as $f$ select d - (extract(isodow from d)::int - 1) $f$;

-- Quem fez e quando, carimbado pelo banco (o app não escolhe o autor).
create or replace function public.carimbar_autor() returns trigger
language plpgsql as $f$
begin
  new.por := coalesce(auth.uid(), new.por);
  new.em := now();
  return new;
end $f$;

-- Chaves compostas para as referências ficarem dentro da mesma empresa.
alter table public.membros add constraint membros_empresa_id_id unique (empresa_id, id);

-- ---------- Funcionários ----------

create table public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  codigo text not null default '',
  funcao text not null check (btrim(funcao) <> ''),
  admissao date not null,
  classificacao text not null default 'w2' check (classificacao in ('w2', '1099')),
  flsa text not null default 'nao-isento' check (flsa in ('nao-isento', 'isento')),
  situacao text not null default 'ativo' check (situacao in ('ativo', 'afastado', 'desligado')),
  desligamento date,
  telefone text not null default '',
  emergencia text not null default '',
  aviso_gps_em date,                                    -- quando aceitou o aviso de localização do ponto
  certificacoes jsonb not null default '[]'::jsonb,     -- [{nome, validade}] (BD-06: lista que não se soma)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id),
  check (jsonb_typeof(certificacoes) = 'array'),
  check (situacao <> 'desligado' or desligamento is not null)
);
create index funcionarios_empresa on public.funcionarios (empresa_id, nome);
create unique index funcionarios_codigo on public.funcionarios (empresa_id, lower(codigo)) where codigo <> '';

-- 1099 é sempre isento de hora extra (como pick() em js/settings.js); certificações sem nome saem.
create or replace function public.ajustar_funcionario() returns trigger
language plpgsql as $f$
begin
  new.nome := btrim(new.nome); new.codigo := btrim(new.codigo); new.funcao := btrim(new.funcao);
  if new.classificacao = '1099' then new.flsa := 'isento'; end if;
  if new.situacao <> 'desligado' then new.desligamento := null; end if;
  new.certificacoes := coalesce((select jsonb_agg(jsonb_build_object('nome', btrim(c ->> 'nome'), 'validade', nullif(c ->> 'validade', '')))
                                   from jsonb_array_elements(new.certificacoes) c where btrim(coalesce(c ->> 'nome', '')) <> ''), '[]'::jsonb);
  return new;
end $f$;
create trigger funcionarios_ajustar before insert or update on public.funcionarios for each row execute function public.ajustar_funcionario();
create trigger funcionarios_tocar before update on public.funcionarios for each row execute function public.tocar_atualizado_em();

-- O membro (login) ligado a um funcionário da mesma empresa.
alter table public.membros add constraint membros_funcionario foreign key (empresa_id, funcionario_id) references public.funcionarios (empresa_id, id);

-- Valor hora com vigência: só INSERT (SET-013). O primeiro é o da admissão (criar_funcionario).
create table public.funcionario_valores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  funcionario_id uuid not null,
  desde date not null,
  valor numeric(12,2) not null check (valor > 0),
  motivo text not null check (btrim(motivo) <> ''),
  por uuid, em timestamptz not null default now(),
  foreign key (empresa_id, funcionario_id) references public.funcionarios (empresa_id, id) on delete cascade,
  unique (funcionario_id, desde)
);
create trigger funcionario_valores_autor before insert on public.funcionario_valores for each row execute function public.carimbar_autor();

-- ---------- Encargos e regras de jornada (versões com vigência, só INSERT) ----------

create table public.encargos_versoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  desde date not null,
  itens jsonb not null,                                 -- [{nome, pct}]
  motivo text not null check (btrim(motivo) <> ''),
  por uuid, em timestamptz not null default now(),
  check (jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) > 0)
);
create index encargos_versoes_empresa on public.encargos_versoes (empresa_id, desde);

create table public.regras_jornada_versoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  desde date not null,                                  -- sempre uma segunda-feira (a semana usa a regra da segunda)
  nome text not null default '',
  semanal jsonb not null,                               -- {limite, fator}
  diaria jsonb not null,                                -- {ativo, limite, fator, dobra, fatorDobra}
  intervalo jsonb not null,                             -- {minimo, apos}
  nota text not null default '',
  motivo text not null check (btrim(motivo) <> ''),
  por uuid, em timestamptz not null default now()
);
create index regras_jornada_versoes_empresa on public.regras_jornada_versoes (empresa_id, desde);

-- Não vale para o passado: da segunda-feira da semana atual em diante (semanas fechadas não mudam).
create or replace function public.guarda_vigencia() returns trigger
language plpgsql as $f$
declare v_segunda date := public.segunda_de(public.hoje_da_empresa(new.empresa_id));
begin
  if tg_table_name = 'regras_jornada_versoes' then new.desde := public.segunda_de(new.desde); end if;
  if new.desde < v_segunda then
    raise exception 'Não vale para o passado: escolha uma data a partir de % (semana atual). Semanas fechadas não mudam.', to_char(v_segunda, 'MM/DD/YYYY');
  end if;
  if tg_table_name = 'encargos_versoes' then
    if exists (select 1 from jsonb_array_elements(new.itens) i
                where btrim(coalesce(i ->> 'nome', '')) = '' or jsonb_typeof(i -> 'pct') <> 'number' or (i ->> 'pct')::numeric not between 0 and 100) then
      raise exception 'Cada encargo precisa de um nome e de um %% entre 0 e 100.';
    end if;
  end if;
  if tg_table_name = 'regras_jornada_versoes' then
    if not coalesce((new.semanal ->> 'limite')::numeric > 0 and (new.semanal ->> 'fator')::numeric >= 1
            and (new.intervalo ->> 'minimo')::numeric >= 0 and (new.intervalo ->> 'apos')::numeric >= 0, false) then
      raise exception 'Confira os números: limites maiores que zero e fatores a partir de 1.';
    end if;
    if coalesce((new.diaria ->> 'ativo')::boolean, false)
       and not coalesce((new.diaria ->> 'dobra')::numeric > (new.diaria ->> 'limite')::numeric and (new.diaria ->> 'limite')::numeric > 0
                        and (new.diaria ->> 'fator')::numeric >= 1 and (new.diaria ->> 'fatorDobra')::numeric >= 1, false) then
      raise exception 'O limite da hora dobrada precisa ser maior que o da hora extra diária.';
    end if;
  end if;
  return new;
end $f$;
create trigger encargos_versoes_vigencia before insert on public.encargos_versoes for each row execute function public.guarda_vigencia();
create trigger encargos_versoes_autor before insert on public.encargos_versoes for each row execute function public.carimbar_autor();
create trigger regras_jornada_versoes_vigencia before insert on public.regras_jornada_versoes for each row execute function public.guarda_vigencia();
create trigger regras_jornada_versoes_autor before insert on public.regras_jornada_versoes for each row execute function public.carimbar_autor();

-- ---------- Contatos (os de fora: construtoras, clientes, fornecedores, prestadoras) ----------

create table public.contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 160),
  pessoa text not null default '',
  papeis text[] not null check (cardinality(papeis) > 0 and papeis <@ array['construtora', 'cliente', 'fornecedor', 'prestadora']),
  email text not null default '', telefone text not null default '',
  endereco text not null default '', cidade text not null default '',
  estado text not null default '' check (estado = '' or estado ~ '^[A-Z]{2}$'),
  zip text not null default '' check (zip = '' or zip ~ '^\d{5}(-\d{4})?$'),
  etapas text[] not null default '{}',                  -- o que o fornecedor cota
  notas text not null default '',
  conta_empresa_id uuid references public.empresas (id) on delete set null,  -- o contato que tem conta no KORbuild
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id)
);
create unique index contatos_nome on public.contatos (empresa_id, lower(btrim(nome)));
create or replace function public.ajustar_contato() returns trigger
language plpgsql as $f$
begin
  new.nome := btrim(new.nome);
  if not ('fornecedor' = any (new.papeis)) then new.etapas := '{}'; end if;
  return new;
end $f$;
create trigger contatos_ajustar before insert or update on public.contatos for each row execute function public.ajustar_contato();
create trigger contatos_tocar before update on public.contatos for each row execute function public.tocar_atualizado_em();

-- ---------- Obras ----------

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 160),
  contratante_id uuid not null,                         -- a construtora que contratou, ou o cliente que contrata direto
  dono_id uuid,                                         -- o dono, quando é outro
  endereco text not null default '', municipio text not null check (btrim(municipio) <> ''), estado text not null check (estado ~ '^[A-Z]{2}$'),
  zip text not null default '' check (zip = '' or zip ~ '^\d{5}(-\d{4})?$'),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  raio integer not null default 150 check (raio between 50 and 2000),   -- a cerca do ponto, em metros
  inicio date not null, prazo date not null check (prazo >= inicio),
  responsavel_id uuid,                                  -- o membro que preenche o diário
  dias_trabalho smallint[] not null default '{1,2,3,4,5}' check (cardinality(dias_trabalho) > 0 and dias_trabalho <@ array[0,1,2,3,4,5,6]::smallint[]),
  situacao text not null default 'andamento' check (situacao in ('andamento', 'paralisada', 'concluida')),
  projeto_id uuid,                                      -- o projeto do Measure que virou obra (fatia 6)
  -- ligação com a obra de quem contratou (HS-05, CO-14): só as funções do banco gravam (fatia 7)
  vinculo_empresa_id uuid references public.empresas (id) on delete set null,
  vinculo_obra_id uuid,
  concorrencia_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, contratante_id) references public.contatos (empresa_id, id),
  foreign key (empresa_id, dono_id) references public.contatos (empresa_id, id),
  foreign key (empresa_id, responsavel_id) references public.membros (empresa_id, id)
);
create unique index obras_nome on public.obras (empresa_id, lower(btrim(nome)));
create or replace function public.ajustar_obra() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  new.nome := btrim(new.nome);
  if new.dono_id = new.contratante_id then new.dono_id := null; end if;
  new.dias_trabalho := array(select distinct d from unnest(new.dias_trabalho) d order by d);
  -- quem executa (prestadora ou ambas) precisa de alguém para o diário; a construtora só gerencia (HS-09, HS-12)
  if new.responsavel_id is null and (select atuacao from public.empresas where id = new.empresa_id) <> 'construtora' then
    raise exception 'Escolha quem preenche o diário desta obra.';
  end if;
  return new;
end $f$;
create trigger obras_ajustar before insert or update on public.obras for each row execute function public.ajustar_obra();
create trigger obras_tocar before update on public.obras for each row execute function public.tocar_atualizado_em();

-- Quem trabalha em quais obras: uma pessoa (membro) ou um funcionário sem login, em N obras.
create table public.alocacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  obra_id uuid not null,
  membro_id uuid,
  funcionario_id uuid,
  papel text not null default '',
  desde date not null default current_date,
  ate date,
  criado_em timestamptz not null default now(),
  check (membro_id is not null or funcionario_id is not null),
  check (ate is null or ate >= desde),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id) on delete cascade,
  foreign key (empresa_id, membro_id) references public.membros (empresa_id, id) on delete cascade,
  foreign key (empresa_id, funcionario_id) references public.funcionarios (empresa_id, id) on delete cascade
);
create index alocacoes_obra on public.alocacoes (empresa_id, obra_id);

-- ---------- Modelos de etapas do cronograma (OB-06) ----------

create table public.modelos_cronograma (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  etapas jsonb not null,                                -- [{nome, pct}] somando 100
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index modelos_cronograma_nome on public.modelos_cronograma (empresa_id, lower(btrim(nome)));
create or replace function public.guarda_modelo() returns trigger
language plpgsql as $f$
declare soma numeric;
begin
  new.nome := btrim(new.nome);
  if jsonb_typeof(new.etapas) is distinct from 'array' then raise exception 'Inclua pelo menos uma etapa.'; end if;
  if jsonb_array_length(new.etapas) = 0 then raise exception 'Inclua pelo menos uma etapa.'; end if;
  if exists (select 1 from jsonb_array_elements(new.etapas) e
              where btrim(coalesce(e ->> 'nome', '')) = '' or jsonb_typeof(e -> 'pct') <> 'number' or (e ->> 'pct')::numeric <= 0) then
    raise exception 'Cada etapa precisa de uma parte do prazo maior que zero.';
  end if;
  select sum((e ->> 'pct')::numeric) into soma from jsonb_array_elements(new.etapas) e;
  if abs(soma - 100) > 0.5 then raise exception 'As partes do prazo somam %: precisam somar 100%%.', round(soma, 1); end if;
  return new;
end $f$;
create trigger modelos_cronograma_guarda before insert or update on public.modelos_cronograma for each row execute function public.guarda_modelo();
create trigger modelos_cronograma_tocar before update on public.modelos_cronograma for each row execute function public.tocar_atualizado_em();

-- ---------- Auditoria (BD-05) ----------

create trigger funcionarios_auditar after insert or update on public.funcionarios for each row execute function public.auditar();
create trigger funcionario_valores_auditar after insert on public.funcionario_valores for each row execute function public.auditar();
create trigger encargos_versoes_auditar after insert on public.encargos_versoes for each row execute function public.auditar();
create trigger regras_jornada_versoes_auditar after insert on public.regras_jornada_versoes for each row execute function public.auditar();
create trigger contatos_auditar after insert or update or delete on public.contatos for each row execute function public.auditar();
create trigger obras_auditar after insert or update on public.obras for each row execute function public.auditar();
create trigger alocacoes_auditar after insert or update or delete on public.alocacoes for each row execute function public.auditar();
create trigger modelos_cronograma_auditar after insert or update or delete on public.modelos_cronograma for each row execute function public.auditar();

-- ---------- RLS ----------

alter table public.funcionarios enable row level security;
alter table public.funcionario_valores enable row level security;
alter table public.encargos_versoes enable row level security;
alter table public.regras_jornada_versoes enable row level security;
alter table public.contatos enable row level security;
alter table public.obras enable row level security;
alter table public.alocacoes enable row level security;
alter table public.modelos_cronograma enable row level security;

-- Cadastros que todos da empresa leem (nomes, funções, obras, contatos, regras); escrever exige a permissão.
create policy funcionarios_ler on public.funcionarios for select to authenticated using (empresa_id = public.minha_empresa());
create policy funcionarios_criar on public.funcionarios for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.funcionarios'));
create policy funcionarios_editar on public.funcionarios for update to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.funcionarios')) with check (empresa_id = public.minha_empresa());

-- Dinheiro: só quem cuida dos funcionários ou vê custos.
create policy funcionario_valores_ler on public.funcionario_valores for select to authenticated
  using (empresa_id = public.minha_empresa() and (public.tenho_permissao('settings.funcionarios') or public.tenho_permissao('crew.custos')));
create policy funcionario_valores_criar on public.funcionario_valores for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.funcionarios'));

create policy encargos_versoes_ler on public.encargos_versoes for select to authenticated
  using (empresa_id = public.minha_empresa() and (public.tenho_permissao('settings.regras') or public.tenho_permissao('crew.custos')));
create policy encargos_versoes_criar on public.encargos_versoes for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.regras'));

create policy regras_jornada_versoes_ler on public.regras_jornada_versoes for select to authenticated using (empresa_id = public.minha_empresa());
create policy regras_jornada_versoes_criar on public.regras_jornada_versoes for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.regras'));

create policy contatos_ler on public.contatos for select to authenticated using (empresa_id = public.minha_empresa());
create policy contatos_criar on public.contatos for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.contatos'));
create policy contatos_editar on public.contatos for update to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.contatos')) with check (empresa_id = public.minha_empresa());
create policy contatos_excluir on public.contatos for delete to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.contatos'));

create policy obras_ler on public.obras for select to authenticated using (empresa_id = public.minha_empresa());
create policy obras_criar on public.obras for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.obras'));
create policy obras_editar on public.obras for update to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.obras')) with check (empresa_id = public.minha_empresa());

create policy alocacoes_ler on public.alocacoes for select to authenticated using (empresa_id = public.minha_empresa());
create policy alocacoes_criar on public.alocacoes for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.obras'));
create policy alocacoes_editar on public.alocacoes for update to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.obras')) with check (empresa_id = public.minha_empresa());
create policy alocacoes_excluir on public.alocacoes for delete to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.obras'));

create policy modelos_cronograma_ler on public.modelos_cronograma for select to authenticated using (empresa_id = public.minha_empresa());
create policy modelos_cronograma_criar on public.modelos_cronograma for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.obras'));
create policy modelos_cronograma_editar on public.modelos_cronograma for update to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.obras')) with check (empresa_id = public.minha_empresa());
create policy modelos_cronograma_excluir on public.modelos_cronograma for delete to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.obras'));

-- ---------- Permissões das tabelas ----------
-- No Supabase, toda tabela nova do public já nasce com tudo liberado para anon e authenticated (o RLS é quem protege).
-- Aqui o acesso fica explícito: anon não toca em nada; versões (valor hora, encargos, regras) só SELECT e INSERT,
-- sem UPDATE/DELETE para ninguém do app (BD-04); obras sem DELETE (encerra-se pela situação) e sem gravar a ligação
-- com a obra de quem contratou (vinculo_*, concorrencia_id), que é das funções do banco (fatia 7).

revoke all on public.funcionarios, public.funcionario_valores, public.encargos_versoes, public.regras_jornada_versoes,
  public.contatos, public.obras, public.alocacoes, public.modelos_cronograma from anon, authenticated;
grant select, insert, update on public.funcionarios to authenticated;
grant select, insert on public.funcionario_valores, public.encargos_versoes, public.regras_jornada_versoes to authenticated;
grant select, insert, update, delete on public.contatos, public.alocacoes, public.modelos_cronograma to authenticated;
grant select on public.obras to authenticated;
grant insert (nome, contratante_id, dono_id, endereco, municipio, estado, zip, lat, lon, raio, inicio, prazo, responsavel_id, dias_trabalho, situacao, projeto_id)
  on public.obras to authenticated;
grant update (nome, contratante_id, dono_id, endereco, municipio, estado, zip, lat, lon, raio, inicio, prazo, responsavel_id, dias_trabalho, situacao)
  on public.obras to authenticated;

-- ---------- Operações ----------

-- Cadastrar o funcionário com o valor hora da admissão, numa transação (as regras de acesso valem: security invoker).
create or replace function public.criar_funcionario(p jsonb, p_valor numeric) returns uuid
language plpgsql security invoker set search_path to 'public' as $f$
declare v_id uuid;
begin
  if not (p_valor > 0) then raise exception 'Informe o valor hora inicial.'; end if;
  insert into public.funcionarios (nome, codigo, funcao, admissao, classificacao, flsa, situacao, desligamento, telefone, emergencia, aviso_gps_em, certificacoes)
  values (coalesce(p ->> 'nome', ''), coalesce(p ->> 'codigo', ''), coalesce(p ->> 'funcao', ''), (p ->> 'admissao')::date,
          coalesce(p ->> 'classificacao', 'w2'), coalesce(p ->> 'flsa', 'nao-isento'), coalesce(p ->> 'situacao', 'ativo'),
          nullif(p ->> 'desligamento', '')::date, coalesce(p ->> 'telefone', ''), coalesce(p ->> 'emergencia', ''),
          nullif(p ->> 'aviso_gps_em', '')::date, coalesce(p -> 'certificacoes', '[]'::jsonb))
  returning id into v_id;
  insert into public.funcionario_valores (funcionario_id, desde, valor, motivo)
  values (v_id, (p ->> 'admissao')::date, round(p_valor, 2), 'Admissão');
  return v_id;
end $f$;

-- Meu perfil: cada um muda o próprio nome e telefone (o resto do cadastro é de quem cuida dos acessos).
create or replace function public.atualizar_meu_perfil(p_nome text, p_telefone text) returns void
language plpgsql security definer set search_path to 'public' as $f$
begin
  if auth.uid() is null then raise exception 'Entre para alterar o seu perfil.'; end if;
  if char_length(btrim(coalesce(p_nome, ''))) < 2 then raise exception 'Diga o seu nome.'; end if;
  update public.membros set nome = btrim(p_nome), telefone = btrim(coalesce(p_telefone, '')) where user_id = auth.uid();
  if not found then raise exception 'Esta conta ainda não pertence a uma empresa.'; end if;
end $f$;

revoke all on function public.criar_funcionario(jsonb, numeric), public.atualizar_meu_perfil(text, text) from public, anon;
grant execute on function public.criar_funcionario(jsonb, numeric), public.atualizar_meu_perfil(text, text) to authenticated;
revoke all on function public.hoje_da_empresa(uuid), public.segunda_de(date) from public, anon;
grant execute on function public.hoje_da_empresa(uuid), public.segunda_de(date) to authenticated;
-- funções de gatilho não são chamadas pelo app
revoke all on function public.carimbar_autor(), public.ajustar_funcionario(), public.guarda_vigencia(), public.ajustar_contato(),
  public.ajustar_obra(), public.guarda_modelo() from public, anon, authenticated;

commit;
