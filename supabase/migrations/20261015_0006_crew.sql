-- KORbuild · fatia 4 do banco (docs/banco.md §5 e §11): o Crew.
-- Equipes, batidas de ponto, conferências, registros de localização, aprovações da semana e orçamentos de mão de obra.
-- O cálculo das horas (jornada, hora extra, custo) continua no app (js/crew.js); o banco guarda os fatos e garante:
--   · batida nunca é editada nem apagada (RN-01): correção = batida nova, modo "ajuste", com motivo;
--   · bater o próprio ponto (crew.ponto.proprio) ou o de qualquer funcionário ativo da empresa (crew.ponto.equipe);
--   · a cerca é conferida no banco e sinaliza, não bloqueia (RN-09);
--   · semana aprovada é fechada (RN-11, RN-13): não recebe batida, ajuste nem valor hora novo; aprovar exige saída
--     em todo dia passado (RN-08); devolver exige motivo;
--   · localização só com o ponto aberto, fora do intervalo, de quem aceitou o aviso (RN-17, PONTO-GPS-01);
--   · sem internet (BD-08): ids gerados no aparelho, repetir não duplica; o que não pode entrar volta como "recusada",
--     com o motivo, sem derrubar o resto do envio;
--   · a contratante vê a presença das prestadoras ligadas só por presenca_na_obra(), sem dinheiro e sem localização (HS-10).
-- Só CRIA (e acrescenta a coluna equipe_id em funcionarios); não apaga nada. Rodar este arquivo e depois
-- supabase/testes/0004_crew.sql.

begin;

-- ---------- Apoio ----------

create or replace function public.fuso_da_empresa(p_empresa uuid) returns text
language sql stable security definer set search_path to 'public' as $f$
  select coalesce((select configuracao ->> 'fuso' from public.empresas where id = p_empresa), 'America/New_York')
$f$;

-- O dia (no fuso da empresa) de um instante.
create or replace function public.dia_na_empresa(p_empresa uuid, p_em timestamptz) returns date
language sql stable security definer set search_path to 'public' as $f$
  select (p_em at time zone public.fuso_da_empresa(p_empresa))::date
$f$;

-- Distância em metros entre dois pontos (haversine), para a cerca.
create or replace function public.distancia_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision) returns double precision
language sql immutable as $f$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)))
$f$;

-- ---------- Equipes ----------

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  encarregado_id uuid,                                  -- o membro que bate o ponto da equipe
  obra_base_id uuid,
  ativa boolean not null default true,                  -- não se exclui: desativa
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id),
  foreign key (empresa_id, encarregado_id) references public.membros (empresa_id, id),
  foreign key (empresa_id, obra_base_id) references public.obras (empresa_id, id)
);
create unique index equipes_nome on public.equipes (empresa_id, lower(btrim(nome)));
create trigger equipes_tocar before update on public.equipes for each row execute function public.tocar_atualizado_em();

alter table public.funcionarios add column equipe_id uuid;
alter table public.funcionarios add constraint funcionarios_equipe foreign key (empresa_id, equipe_id) references public.equipes (empresa_id, id);

-- ---------- Batidas (só INSERT) ----------

create table public.batidas (
  id uuid primary key,                                  -- gerado no aparelho
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  funcionario_id uuid not null,
  tipo text not null check (tipo in ('entrada', 'intervalo-inicio', 'intervalo-fim', 'troca', 'chegada', 'etapa', 'saida')),
  obra_id uuid,
  etapa text,
  em timestamptz not null,                              -- a hora da batida, no aparelho
  lat double precision, lon double precision, precisao integer,
  dentro_cerca boolean,                                 -- conferido no banco (RN-09); null no ajuste
  fonte_gps text not null default 'gps',
  modo text not null check (modo in ('pessoal', 'equipe', 'ajuste')),
  registrado_por uuid,                                  -- o membro (sem chave estrangeira: a batida não muda nem se o login sair)
  registrado_por_nome text not null default '',
  foto_path text,
  nota text check (char_length(nota) <= 280),
  ajuste_motivo text,
  criado_no_aparelho_em timestamptz,
  recebida_em timestamptz not null default now(),
  unique (empresa_id, id),
  check (modo <> 'ajuste' or btrim(coalesce(ajuste_motivo, '')) <> ''),
  foreign key (empresa_id, funcionario_id) references public.funcionarios (empresa_id, id) on delete cascade,
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id)
);
create index batidas_funcionario on public.batidas (empresa_id, funcionario_id, em);
create index batidas_obra on public.batidas (obra_id, em);

-- "Conferido" do painel Agora: à parte, para a batida continuar intocada.
create table public.batidas_conferidas (
  batida_id uuid primary key,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  por uuid, por_nome text not null default '',
  em timestamptz not null default now(),
  foreign key (empresa_id, batida_id) references public.batidas (empresa_id, id) on delete cascade
);

-- Registros de localização durante a jornada (PONTO-GPS-01). Só INSERT.
create table public.localizacoes (
  id uuid primary key,                                  -- gerado no aparelho
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  funcionario_id uuid not null,
  em timestamptz not null,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  precisao integer,
  gatilho text not null check (gatilho in ('batida', 'app-aberto', 'periodico')),
  obra_id uuid,                                         -- a obra da jornada naquele momento (dada pelo banco)
  criado_no_aparelho_em timestamptz,
  recebida_em timestamptz not null default now(),
  foreign key (empresa_id, funcionario_id) references public.funcionarios (empresa_id, id) on delete cascade,
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id)
);
create index localizacoes_funcionario on public.localizacoes (empresa_id, funcionario_id, em);

-- Aprovar ou devolver a semana (segunda a domingo). Só INSERT; vale a última decisão.
create table public.aprovacoes_semana (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  funcionario_id uuid not null,
  semana date not null check (extract(isodow from semana) = 1),
  status text not null check (status in ('aprovado', 'devolvido')),
  motivo text not null default '',
  por uuid, por_nome text not null default '',
  em timestamptz not null default now(),
  check (status <> 'devolvido' or btrim(motivo) <> ''),
  foreign key (empresa_id, funcionario_id) references public.funcionarios (empresa_id, id) on delete cascade
);
create index aprovacoes_semana_funcionario on public.aprovacoes_semana (empresa_id, funcionario_id, semana, em desc);

-- Orçamento de mão de obra da obra (versões; vale a última).
create table public.orcamentos_obra (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  obra_id uuid not null,
  valor numeric(12,2) not null check (valor >= 0),
  avanco numeric(5,2) check (avanco between 0 and 100),   -- avanço físico informado (%)
  por_etapa jsonb not null default '{}'::jsonb,            -- {etapa: valor}
  por uuid, em timestamptz not null default now(),
  check (jsonb_typeof(por_etapa) = 'object'),
  foreign key (empresa_id, obra_id) references public.obras (empresa_id, id) on delete cascade
);
create index orcamentos_obra_obra on public.orcamentos_obra (empresa_id, obra_id, em desc);
create trigger orcamentos_obra_autor before insert on public.orcamentos_obra for each row execute function public.carimbar_autor();

-- ---------- Regras que o banco garante ----------

-- Batidas, conferências, localizações e decisões não mudam nem saem (só junto com a empresa, em cascata).
create or replace function public.guarda_so_insert() returns trigger
language plpgsql as $f$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.empresas where id = old.empresa_id) then return old; end if;
  raise exception 'Este registro não pode ser alterado nem apagado: corrigir é registrar de novo.';
end $f$;
create trigger batidas_guarda before update or delete on public.batidas for each row execute function public.guarda_so_insert();
create trigger batidas_conferidas_guarda before update or delete on public.batidas_conferidas for each row execute function public.guarda_so_insert();
create trigger localizacoes_guarda before update or delete on public.localizacoes for each row execute function public.guarda_so_insert();
create trigger aprovacoes_semana_guarda before update or delete on public.aprovacoes_semana for each row execute function public.guarda_so_insert();
create trigger orcamentos_obra_guarda before update or delete on public.orcamentos_obra for each row execute function public.guarda_so_insert();

-- A semana (segunda-feira) do funcionário está aprovada? Vale a última decisão.
create or replace function public.semana_aprovada(p_funcionario uuid, p_semana date) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select coalesce((select status = 'aprovado' from public.aprovacoes_semana
                    where funcionario_id = p_funcionario and semana = p_semana order by em desc, id desc limit 1), false)
$f$;

-- Valor hora não começa dentro (nem antes) de uma semana já aprovada (RN-13, SET-014): ela já foi para a folha.
create or replace function public.guarda_valor_semana_aprovada() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare v_semana date;
begin
  select a.semana into v_semana from public.aprovacoes_semana a
   where a.funcionario_id = new.funcionario_id and a.semana + 6 >= new.desde and public.semana_aprovada(a.funcionario_id, a.semana)
   order by a.semana desc limit 1;
  if v_semana is not null then
    raise exception 'A semana de % já foi aprovada e enviada para a folha. Escolha uma data a partir de %.',
      to_char(v_semana, 'MM/DD/YYYY'), to_char(v_semana + 7, 'MM/DD/YYYY');
  end if;
  return new;
end $f$;
create trigger funcionario_valores_semana_aprovada before insert on public.funcionario_valores for each row execute function public.guarda_valor_semana_aprovada();

-- ---------- Auditoria (BD-05) ----------

create trigger equipes_auditar after insert or update on public.equipes for each row execute function public.auditar();
create trigger batidas_auditar_ajuste after insert on public.batidas for each row when (new.modo = 'ajuste') execute function public.auditar();
create trigger aprovacoes_semana_auditar after insert on public.aprovacoes_semana for each row execute function public.auditar();
create trigger orcamentos_obra_auditar after insert on public.orcamentos_obra for each row execute function public.auditar();

-- ---------- Leitura (RLS) ----------

-- O funcionário ligado ao meu login (o trabalhador vê o próprio ponto).
create or replace function public.meu_funcionario() returns uuid
language sql stable security definer set search_path to 'public' as $f$
  select funcionario_id from public.membros where user_id = auth.uid() and ativo
$f$;

-- Vê o ponto da empresa toda (escritório e encarregado), ou só o próprio (trabalhador).
create or replace function public.vejo_o_ponto_de(p_funcionario uuid) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select public.tenho_permissao('crew.acompanhar') or public.tenho_permissao('crew.ponto.equipe')
      or (p_funcionario is not null and p_funcionario = public.meu_funcionario())
$f$;

alter table public.equipes enable row level security;
alter table public.batidas enable row level security;
alter table public.batidas_conferidas enable row level security;
alter table public.localizacoes enable row level security;
alter table public.aprovacoes_semana enable row level security;
alter table public.orcamentos_obra enable row level security;

create policy equipes_ler on public.equipes for select to authenticated using (empresa_id = public.minha_empresa());
create policy equipes_criar on public.equipes for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.funcionarios'));
create policy equipes_editar on public.equipes for update to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('settings.funcionarios')) with check (empresa_id = public.minha_empresa());

create policy batidas_ler on public.batidas for select to authenticated
  using (empresa_id = public.minha_empresa() and public.vejo_o_ponto_de(funcionario_id));
create policy batidas_conferidas_ler on public.batidas_conferidas for select to authenticated
  using (empresa_id = public.minha_empresa() and public.vejo_o_ponto_de((select b.funcionario_id from public.batidas b where b.id = batida_id)));
-- A localização é do escritório que acompanha o ponto e do próprio trabalhador; o encarregado não vê a dos outros.
create policy localizacoes_ler on public.localizacoes for select to authenticated
  using (empresa_id = public.minha_empresa() and (public.tenho_permissao('crew.acompanhar') or funcionario_id = public.meu_funcionario()));
create policy aprovacoes_semana_ler on public.aprovacoes_semana for select to authenticated
  using (empresa_id = public.minha_empresa() and public.vejo_o_ponto_de(funcionario_id));
create policy orcamentos_obra_ler on public.orcamentos_obra for select to authenticated
  using (empresa_id = public.minha_empresa() and public.tenho_permissao('crew.custos'));
create policy orcamentos_obra_criar on public.orcamentos_obra for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.tenho_permissao('crew.custos'));

-- O app só lê o ponto; gravar é pelas funções abaixo. Equipes: cadastro do Settings (sem excluir). Orçamento: só INSERT.
revoke all on public.equipes, public.batidas, public.batidas_conferidas, public.localizacoes, public.aprovacoes_semana,
  public.orcamentos_obra from anon, authenticated;
grant select on public.batidas, public.batidas_conferidas, public.localizacoes, public.aprovacoes_semana to authenticated;
grant select, insert, update on public.equipes to authenticated;
grant select, insert on public.orcamentos_obra to authenticated;

-- ---------- Bater o ponto ----------

-- Uma batida, com as regras de quem pode e do que pode. Devolve null se gravou (ou já existia) ou o motivo da recusa.
create or replace function public.gravar_batida(eu public.membros, b jsonb, p_ajuste boolean) returns text
language plpgsql security definer set search_path to 'public' as $f$
declare
  v_id uuid := (b ->> 'id')::uuid;
  v_func public.funcionarios;
  v_obra public.obras;
  v_tipo text := b ->> 'tipo';
  v_em timestamptz := (b ->> 'em')::timestamptz;
  v_modo text;
  v_lat double precision := (b ->> 'lat')::double precision;
  v_lon double precision := (b ->> 'lon')::double precision;
  v_fonte text := coalesce(nullif(b ->> 'fonte_gps', ''), case when p_ajuste then 'ajuste' else 'gps' end);
  v_dentro boolean;
begin
  if v_id is null then return 'sem-id'; end if;
  if exists (select 1 from public.batidas where id = v_id) then return null; end if;   -- repetida (sinal ruim)
  select * into v_func from public.funcionarios where id = (b ->> 'funcionario_id')::uuid and empresa_id = eu.empresa_id;
  if v_func.id is null then return 'funcionario'; end if;
  if v_tipo is null or v_tipo not in ('entrada', 'intervalo-inicio', 'intervalo-fim', 'troca', 'chegada', 'etapa', 'saida') then return 'tipo'; end if;
  if v_em is null or v_em > now() + interval '10 minutes' then return 'hora'; end if;
  if p_ajuste then
    v_modo := 'ajuste';
    if btrim(coalesce(b ->> 'motivo', '')) = '' then return 'motivo'; end if;
  else
    if v_func.situacao <> 'ativo' then return 'funcionario-inativo'; end if;
    if v_func.id = eu.funcionario_id and (b ->> 'modo') is distinct from 'equipe' and public.tenho_permissao('crew.ponto.proprio') then v_modo := 'pessoal';
    elsif public.tenho_permissao('crew.ponto.equipe') then v_modo := 'equipe';
    else return 'permissao'; end if;
  end if;
  if public.semana_aprovada(v_func.id, public.segunda_de(public.dia_na_empresa(eu.empresa_id, v_em))) then return 'semana-aprovada'; end if;
  if (b ->> 'obra_id') is not null then
    select * into v_obra from public.obras where id = (b ->> 'obra_id')::uuid and empresa_id = eu.empresa_id;
    if v_obra.id is null then return 'obra'; end if;
  elsif v_tipo in ('entrada', 'chegada', 'etapa') then return 'obra';
  end if;
  -- a cerca (RN-09): conferida aqui; sem GPS conta como fora (vai para conferência); no ajuste não se aplica
  if p_ajuste then v_dentro := null;
  elsif v_obra.id is null then v_dentro := null;
  elsif v_fonte = 'gps' and v_lat is not null and v_lon is not null then v_dentro := public.distancia_m(v_lat, v_lon, v_obra.lat, v_obra.lon) <= v_obra.raio;
  else v_dentro := false;
  end if;
  if (b ->> 'foto_path') is not null and (b ->> 'foto_path') not like eu.empresa_id || '/' || v_func.id || '/' || v_id || '%' then return 'foto'; end if;
  insert into public.batidas (id, empresa_id, funcionario_id, tipo, obra_id, etapa, em, lat, lon, precisao, dentro_cerca, fonte_gps, modo,
                              registrado_por, registrado_por_nome, foto_path, nota, ajuste_motivo, criado_no_aparelho_em)
  values (v_id, eu.empresa_id, v_func.id, v_tipo, v_obra.id, nullif(btrim(coalesce(b ->> 'etapa', '')), ''), v_em,
          case when p_ajuste then null else v_lat end, case when p_ajuste then null else v_lon end,
          case when p_ajuste then null else (b ->> 'precisao')::int end, v_dentro, v_fonte, v_modo, eu.id, eu.nome,
          b ->> 'foto_path', nullif(left(btrim(coalesce(b ->> 'nota', '')), 280), ''),
          case when p_ajuste then btrim(b ->> 'motivo') end, (b ->> 'criado_no_aparelho_em')::timestamptz)
  on conflict (id) do nothing;
  return null;
end $f$;

-- As batidas que vieram do aparelho (uma pessoa ou a equipe toda, com ou sem sinal).
-- p: [{id, funcionario_id, tipo, obra_id, etapa, em, lat, lon, precisao, fonte_gps, modo, foto_path, nota, criado_no_aparelho_em}]
-- Devolve {gravadas: [ids], recusadas: [{id, motivo}]}: o aparelho tira as duas da fila e avisa as recusadas.
create or replace function public.registrar_batidas(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); b jsonb; v_motivo text; ok jsonb := '[]'; nao jsonb := '[]';
begin
  if eu.id is null then raise exception 'Entre com um usuário ativo da empresa.'; end if;
  if not (public.tenho_permissao('crew.ponto.proprio') or public.tenho_permissao('crew.ponto.equipe')) then raise exception 'Sem permissão para bater o ponto.'; end if;
  if jsonb_typeof(p) is distinct from 'array' then raise exception 'Envie uma lista de batidas.'; end if;
  for b in select x from jsonb_array_elements(p) x order by (x ->> 'em') loop
    v_motivo := public.gravar_batida(eu, b, false);
    if v_motivo is null then ok := ok || to_jsonb(b ->> 'id'); else nao := nao || jsonb_build_object('id', b ->> 'id', 'motivo', v_motivo); end if;
  end loop;
  return jsonb_build_object('gravadas', ok, 'recusadas', nao);
end $f$;

-- Ajuste do escritório (CREW-04): batida nova, marcada como ajuste, com o motivo. p: {id, funcionario_id, tipo, obra_id, etapa, em, motivo}
create or replace function public.ajustar_batida(p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); v_motivo text;
begin
  if eu.id is null or not public.tenho_permissao('crew.aprovar') then raise exception 'Sem permissão para ajustar o ponto.'; end if;
  v_motivo := public.gravar_batida(eu, p, true);
  if v_motivo = 'semana-aprovada' then raise exception 'Esta semana já foi aprovada: o ponto dela não muda mais.'; end if;
  if v_motivo = 'motivo' then raise exception 'O motivo é obrigatório: fica no histórico.'; end if;
  if v_motivo is not null then raise exception 'Ajuste recusado (%).', v_motivo; end if;
  return (p ->> 'id')::uuid;
end $f$;

-- "Conferido": a batida fora da cerca foi vista pelo escritório (ela continua marcada como fora).
create or replace function public.conferir_batida(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro();
begin
  if eu.id is null or not public.tenho_permissao('crew.acompanhar') then raise exception 'Sem permissão para conferir o ponto.'; end if;
  if not exists (select 1 from public.batidas where id = p_id and empresa_id = eu.empresa_id) then raise exception 'Batida não encontrada.'; end if;
  insert into public.batidas_conferidas (batida_id, empresa_id, por, por_nome) values (p_id, eu.empresa_id, eu.id, eu.nome)
  on conflict (batida_id) do nothing;
end $f$;

-- ---------- Semana: aprovar ou devolver (RN-11) ----------

-- Dias passados da semana em que a última batida não é a saída (RN-08).
create or replace function public.dias_sem_saida(p_funcionario uuid, p_semana date) returns date[]
language sql stable security definer set search_path to 'public' as $f$
  with dias as (
    select public.dia_na_empresa(b.empresa_id, b.em) as dia, b.tipo, b.em, b.id, b.empresa_id
      from public.batidas b
     where b.funcionario_id = p_funcionario
       and b.em >= (p_semana::timestamp - interval '1 day') at time zone 'UTC' and b.em < ((p_semana + 8)::timestamp) at time zone 'UTC'
  ), ultimas as (
    select distinct on (dia) dia, tipo, empresa_id from dias where dia between p_semana and p_semana + 6 order by dia, em desc, id desc
  )
  select coalesce(array_agg(dia order by dia), '{}') from ultimas where tipo <> 'saida' and dia < public.hoje_da_empresa(empresa_id)
$f$;

create or replace function public.decidir_semana(p_funcionarios uuid[], p_semana date, p_status text, p_motivo text default '') returns integer
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); v_semana date := public.segunda_de(p_semana); v_bloq text; n integer := 0; f uuid;
begin
  if eu.id is null or not public.tenho_permissao('crew.aprovar') then raise exception 'Sem permissão para aprovar timesheets.'; end if;
  if p_status not in ('aprovado', 'devolvido') then raise exception 'Decisão inválida.'; end if;
  if p_status = 'devolvido' and btrim(coalesce(p_motivo, '')) = '' then raise exception 'Escreva o motivo da devolução.'; end if;
  if exists (select 1 from unnest(p_funcionarios) x where not exists (select 1 from public.funcionarios where id = x and empresa_id = eu.empresa_id)) then
    raise exception 'Funcionário não encontrado.';
  end if;
  if exists (select 1 from unnest(p_funcionarios) x where public.semana_aprovada(x, v_semana)) then
    raise exception 'Semana aprovada é fechada: ela já foi para a folha.';
  end if;
  if p_status = 'aprovado' then
    select string_agg(fu.nome, ', ' order by fu.nome) into v_bloq from unnest(p_funcionarios) x join public.funcionarios fu on fu.id = x
     where cardinality(public.dias_sem_saida(x, v_semana)) > 0;
    if v_bloq is not null then raise exception 'Antes de aprovar, ajuste as batidas sem saída de: %.', v_bloq; end if;
  end if;
  foreach f in array p_funcionarios loop
    insert into public.aprovacoes_semana (empresa_id, funcionario_id, semana, status, motivo, por, por_nome)
    values (eu.empresa_id, f, v_semana, p_status, btrim(coalesce(p_motivo, '')), eu.id, eu.nome);
    n := n + 1;
  end loop;
  return n;
end $f$;

-- ---------- Registros de localização (PONTO-GPS-01, RN-17) ----------

-- O aviso de localização: a própria pessoa aceita no app (fica a data no cadastro do funcionário).
create or replace function public.aceitar_aviso_gps() returns date
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); v date;
begin
  if eu.funcionario_id is null then raise exception 'Este usuário não está ligado a um funcionário.'; end if;
  update public.funcionarios set aviso_gps_em = coalesce(aviso_gps_em, public.hoje_da_empresa(eu.empresa_id))
   where id = eu.funcionario_id returning aviso_gps_em into v;
  return v;
end $f$;

-- Só da própria pessoa, do próprio celular, com o ponto aberto e fora do intervalo.
-- p: [{id, em, lat, lon, precisao, gatilho, criado_no_aparelho_em}] → {gravadas, recusadas}
create or replace function public.registrar_localizacoes(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare
  eu public.membros := public.meu_membro(); f public.funcionarios; l jsonb; v_em timestamptz; ult public.batidas; v_motivo text;
  ok jsonb := '[]'; nao jsonb := '[]';
begin
  if eu.id is null or eu.funcionario_id is null then raise exception 'Este usuário não está ligado a um funcionário.'; end if;
  if not (public.tenho_permissao('crew.ponto.proprio') or public.tenho_permissao('crew.ponto.equipe')) then raise exception 'Sem permissão para registrar a localização.'; end if;
  if jsonb_typeof(p) is distinct from 'array' then raise exception 'Envie uma lista de registros.'; end if;
  select * into f from public.funcionarios where id = eu.funcionario_id;
  for l in select x from jsonb_array_elements(p) x order by (x ->> 'em') loop
    v_motivo := null; v_em := (l ->> 'em')::timestamptz;
    if (l ->> 'id') is null then v_motivo := 'sem-id';
    elsif exists (select 1 from public.localizacoes where id = (l ->> 'id')::uuid) then v_motivo := null;   -- repetido
    elsif f.aviso_gps_em is null then v_motivo := 'sem-aviso';
    elsif v_em is null or v_em > now() + interval '10 minutes' then v_motivo := 'hora';
    elsif (l ->> 'lat') is null or (l ->> 'lon') is null then v_motivo := 'posicao';
    elsif coalesce(l ->> 'gatilho', '') not in ('batida', 'app-aberto', 'periodico') then v_motivo := 'gatilho';
    else
      -- a última batida até aquele instante, no mesmo dia: o ponto precisa estar aberto e fora do intervalo
      select * into ult from public.batidas b
       where b.funcionario_id = f.id and b.em <= v_em and public.dia_na_empresa(b.empresa_id, b.em) = public.dia_na_empresa(f.empresa_id, v_em)
       order by b.em desc, b.id desc limit 1;
      if ult.id is null or ult.tipo = 'saida' then v_motivo := 'ponto-fechado';
      elsif ult.tipo = 'intervalo-inicio' then v_motivo := 'intervalo';
      else
        insert into public.localizacoes (id, empresa_id, funcionario_id, em, lat, lon, precisao, gatilho, obra_id, criado_no_aparelho_em)
        values ((l ->> 'id')::uuid, f.empresa_id, f.id, v_em, (l ->> 'lat')::double precision, (l ->> 'lon')::double precision,
                (l ->> 'precisao')::int, l ->> 'gatilho', case when ult.tipo = 'troca' then null else ult.obra_id end,
                (l ->> 'criado_no_aparelho_em')::timestamptz)
        on conflict (id) do nothing;
      end if;
    end if;
    if v_motivo is null then ok := ok || to_jsonb(l ->> 'id'); else nao := nao || jsonb_build_object('id', l ->> 'id', 'motivo', v_motivo); end if;
  end loop;
  return jsonb_build_object('gravadas', ok, 'recusadas', nao);
end $f$;

-- ---------- Para a contratante (HS-10; BD-03) ----------

-- Presença das prestadoras na obra dela (e na cadeia, até 3 níveis, CO-21): nomes, funções e as batidas naquela obra.
-- Sem valor hora, encargos, custo, orçamento, localização, foto nem nota. Batida em outra obra da prestadora vem só como
-- "outra obra" (obra_id null), para a jornada fechar no app sem revelar onde.
create or replace function public.presenca_na_obra(p_obra uuid, p_de date, p_ate date) returns setof jsonb
language sql stable security definer set search_path to 'public' as $f$
  with recursive cadeia as (
    select o.id as obra_id, o.empresa_id, o.nome as obra_nome, 1 as nivel, null::text as via
      from public.obras o
     where o.vinculo_empresa_id = public.minha_empresa() and o.vinculo_obra_id = p_obra
       and (public.tenho_permissao('crew.acompanhar') or public.tenho_permissao('daily.acompanhar'))
       and p_ate >= p_de and p_ate - p_de <= 62
    union all
    select o.id, o.empresa_id, o.nome, c.nivel + 1, coalesce(c.via, (select nome from public.empresas where id = c.empresa_id))
      from cadeia c join public.obras o on o.vinculo_empresa_id = c.empresa_id and o.vinculo_obra_id = c.obra_id
     where c.nivel < 3
  ), pessoas as (
    select distinct c.obra_id, b.funcionario_id
      from cadeia c join public.batidas b on b.obra_id = c.obra_id
     where public.dia_na_empresa(c.empresa_id, b.em) between p_de and p_ate
  )
  select jsonb_build_object(
    'empresa', jsonb_build_object('id', e.id, 'nome', e.nome),
    'obra', jsonb_build_object('id', c.obra_id, 'nome', c.obra_nome),
    'nivel', c.nivel, 'via', c.via,
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object('id', fu.id, 'nome', fu.nome, 'funcao', fu.funcao,
        'batidas', (select jsonb_agg(jsonb_build_object('id', b.id, 'tipo', b.tipo, 'em', b.em,
                                     'obra_id', case when b.obra_id = c.obra_id then b.obra_id end,
                                     'etapa', case when b.obra_id = c.obra_id then b.etapa end,
                                     'dentro_cerca', case when b.obra_id = c.obra_id then b.dentro_cerca end,
                                     'ajuste', b.modo = 'ajuste') order by b.em, b.id)
                      from public.batidas b
                     where b.funcionario_id = fu.id and public.dia_na_empresa(c.empresa_id, b.em) between p_de and p_ate
                       and public.dia_na_empresa(c.empresa_id, b.em) in (select public.dia_na_empresa(c.empresa_id, b2.em) from public.batidas b2
                                                                          where b2.funcionario_id = fu.id and b2.obra_id = c.obra_id)))
        order by fu.nome)
        from pessoas p join public.funcionarios fu on fu.id = p.funcionario_id where p.obra_id = c.obra_id), '[]'::jsonb))
    from cadeia c join public.empresas e on e.id = c.empresa_id
   order by c.nivel, e.nome
$f$;

-- ---------- Fotos da batida (bucket privado "ponto": {empresa}/{funcionario}/{batida}.jpg) ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ponto', 'ponto', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create or replace function public.posso_gravar_foto_ponto(p_nome text) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select (storage.foldername(p_nome))[1] = public.minha_empresa()::text
     and (public.tenho_permissao('crew.ponto.equipe')
          or (public.tenho_permissao('crew.ponto.proprio') and (storage.foldername(p_nome))[2] = public.meu_funcionario()::text))
$f$;
create or replace function public.posso_ver_foto_ponto(p_nome text) returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select (storage.foldername(p_nome))[1] = public.minha_empresa()::text
     and (public.tenho_permissao('crew.acompanhar') or public.tenho_permissao('crew.ponto.equipe')
          or (storage.foldername(p_nome))[2] = public.meu_funcionario()::text)
$f$;

-- Só entra e é lida; não sai nem é trocada (a batida é imutável).
create policy ponto_ler on storage.objects for select to authenticated using (bucket_id = 'ponto' and public.posso_ver_foto_ponto(name));
create policy ponto_gravar on storage.objects for insert to authenticated with check (bucket_id = 'ponto' and public.posso_gravar_foto_ponto(name));

-- ---------- Permissões das funções ----------

-- as de apoio são usadas só por dentro das funções (que rodam como o dono): o app não as chama
revoke all on function public.guarda_so_insert(), public.guarda_valor_semana_aprovada(), public.gravar_batida(public.membros, jsonb, boolean),
  public.fuso_da_empresa(uuid), public.dia_na_empresa(uuid, timestamptz), public.semana_aprovada(uuid, date), public.dias_sem_saida(uuid, date)
  from public, anon, authenticated;
revoke all on function public.distancia_m(double precision, double precision, double precision, double precision), public.meu_funcionario(), public.vejo_o_ponto_de(uuid), public.registrar_batidas(jsonb), public.ajustar_batida(jsonb),
  public.conferir_batida(uuid), public.decidir_semana(uuid[], date, text, text), public.aceitar_aviso_gps(),
  public.registrar_localizacoes(jsonb), public.presenca_na_obra(uuid, date, date), public.posso_gravar_foto_ponto(text), public.posso_ver_foto_ponto(text)
  from public, anon;
grant execute on function public.distancia_m(double precision, double precision, double precision, double precision),
  public.meu_funcionario(), public.vejo_o_ponto_de(uuid), public.registrar_batidas(jsonb), public.ajustar_batida(jsonb),
  public.conferir_batida(uuid), public.decidir_semana(uuid[], date, text, text), public.aceitar_aviso_gps(),
  public.registrar_localizacoes(jsonb), public.presenca_na_obra(uuid, date, date), public.posso_gravar_foto_ponto(text), public.posso_ver_foto_ponto(text)
  to authenticated;

commit;
