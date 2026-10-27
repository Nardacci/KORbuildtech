-- KORbuild — migração 0020 (PROPOSTA, NÃO APLICADA): o projeto ganho é a obra (docs/daily-primeira-versao.md).
-- Só aplicar depois que o dono digitar "pode aplicar 0020".
--   1. projetos.execucao: local no mapa (lat, lon, raio) e dias de trabalho, digitados no cadastro do projeto.
--   2. obras.lat/lon passam a ser opcionais (sem coordenadas: clima à mão, cerca do ponto fica para o Crew);
--      o responsável pelo diário deixa de ser obrigatório.
--   3. Gatilho em projetos: quando o projeto fica "ganha" e não tem obra, o banco cria a obra 1:1 a partir dele
--      (nome, partes, endereço, datas do cronograma, local e dias de trabalho) e liga projetos.obra_id.
--      Ganho numa concorrência, a obra já nasce ligada à obra da contratante (vinculo_*), como a função criar_obra_da_concorrencia fazia.
--      Depois, o cadastro do projeto manda na obra automática (nome, endereço, local, dias).
-- Não apaga nem muda dado existente; obras cadastradas à mão continuam como estão.

begin;

alter table public.projetos add column if not exists execucao jsonb not null default '{}'::jsonb;
alter table public.projetos drop constraint if exists projetos_execucao_objeto;
alter table public.projetos add constraint projetos_execucao_objeto check (jsonb_typeof(execucao) = 'object');

-- apagar uma obra ligada a um projeto só limpa projetos.obra_id (a regra antiga zerava também empresa_id e falhava)
alter table public.projetos drop constraint if exists projetos_empresa_id_obra_id_fkey;
alter table public.projetos add constraint projetos_empresa_id_obra_id_fkey foreign key (empresa_id, obra_id) references public.obras (empresa_id, id) on delete set null (obra_id);

alter table public.obras alter column lat drop not null;
alter table public.obras alter column lon drop not null;

-- responsável pelo diário opcional (quem tem a permissão preenche)
create or replace function public.ajustar_obra() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  new.nome := btrim(new.nome);
  if new.dono_id = new.contratante_id then new.dono_id := null; end if;
  new.dias_trabalho := array(select distinct d from unnest(new.dias_trabalho) d order by d);
  return new;
end $f$;

-- nome livre para a obra automática dentro da empresa (a obra tem índice único por nome)
create or replace function public.nome_livre_de_obra(p_empresa uuid, p_nome text, p_obra uuid default null) returns text
language plpgsql stable as $f$
declare base text := btrim(coalesce(p_nome, '')); nm text := btrim(coalesce(p_nome, '')); n int := 0;
begin
  while exists (select 1 from public.obras where empresa_id = p_empresa and lower(btrim(nome)) = lower(nm) and (p_obra is null or id <> p_obra)) loop
    n := n + 1; nm := base || ' (' || n || ')';
  end loop;
  return nm;
end $f$;

create or replace function public.obra_do_projeto() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare o_id uuid; c public.concorrencias; v public.concorrencia_convites; ini date; fim date; ex jsonb := coalesce(new.execucao, '{}'::jsonb);
        v_lat double precision; v_lon double precision; v_raio int; v_dias smallint[];
begin
  v_lat := nullif(ex ->> 'lat', '')::double precision;
  v_lon := nullif(ex ->> 'lon', '')::double precision;
  if v_lat is null or v_lon is null or abs(v_lat) > 90 or abs(v_lon) > 180 then v_lat := null; v_lon := null; end if;
  v_raio := least(greatest(coalesce(nullif(ex ->> 'raio', '')::int, 150), 50), 2000);
  v_dias := coalesce((select array_agg(x::smallint order by x::smallint) from jsonb_array_elements_text(case when jsonb_typeof(ex -> 'diasTrabalho') = 'array' then ex -> 'diasTrabalho' else '[]'::jsonb end) x where x ~ '^[0-6]$'), '{}'::smallint[]);
  if cardinality(v_dias) = 0 then v_dias := '{1,2,3,4,5}'::smallint[]; end if;

  -- o aparelho pode mandar obra_id vazio (ainda não soube da obra automática): a obra do projeto não se perde
  if tg_op = 'UPDATE' and new.obra_id is null and old.obra_id is not null
     and exists (select 1 from public.obras where id = old.obra_id and empresa_id = new.empresa_id and projeto_id = new.id) then
    new.obra_id := old.obra_id;
  end if;
  if new.situacao = 'ganha' and new.obra_id is null then
    -- datas: do cronograma do projeto (tarefas com início); sem ele, hoje → +89 dias
    select min((t ->> 'inicio')::date), max((t ->> 'inicio')::date + greatest(coalesce(nullif(t ->> 'dias', '')::int, 1), 1) - 1)
      into ini, fim
      from jsonb_array_elements(case when jsonb_typeof(new.cronograma -> 'tarefas') = 'array' then new.cronograma -> 'tarefas' else '[]'::jsonb end) t
     where coalesce(t ->> 'inicio', '') ~ '^\d{4}-\d{2}-\d{2}$';
    ini := coalesce(ini, current_date);
    fim := greatest(coalesce(fim, ini + 89), ini);
    -- ganho numa concorrência: a obra nasce ligada à obra de quem contratou (CO-14)
    if new.concorrencia ? 'conviteId' and (new.concorrencia ->> 'conviteId') ~ '^[0-9a-f-]{36}$' then
      select * into v from public.concorrencia_convites where id = (new.concorrencia ->> 'conviteId')::uuid;
      if v.id is not null then select * into c from public.concorrencias where id = v.concorrencia_id; end if;
    end if;
    perform set_config('kb.conc_funcao', '1', true);
    insert into public.obras (empresa_id, nome, contratante_id, dono_id, endereco, municipio, estado, zip, lat, lon, raio, inicio, prazo, responsavel_id, dias_trabalho, projeto_id,
                              vinculo_empresa_id, vinculo_obra_id, concorrencia_id)
    values (new.empresa_id, public.nome_livre_de_obra(new.empresa_id, new.nome), new.contratante_id, new.dono_id, coalesce(new.endereco, ''), new.cidade, new.estado, coalesce(new.zip, ''),
            v_lat, v_lon, v_raio, ini, fim, null, v_dias, new.id, c.empresa_id, c.obra_id, c.id)
    returning id into o_id;
    new.obra_id := o_id;
  elsif tg_op = 'UPDATE' and new.obra_id is not null then
    -- o cadastro do projeto manda na obra que nasceu dele
    update public.obras o
       set nome = public.nome_livre_de_obra(new.empresa_id, new.nome, o.id), contratante_id = new.contratante_id, dono_id = new.dono_id,
           endereco = coalesce(new.endereco, ''), municipio = new.cidade, estado = new.estado, zip = coalesce(new.zip, ''),
           lat = v_lat, lon = v_lon, raio = v_raio, dias_trabalho = v_dias
     where o.id = new.obra_id and o.empresa_id = new.empresa_id and o.projeto_id = new.id
       and (o.nome is distinct from new.nome or o.contratante_id is distinct from new.contratante_id or o.dono_id is distinct from new.dono_id
            or o.endereco is distinct from coalesce(new.endereco, '') or o.municipio is distinct from new.cidade or o.estado is distinct from new.estado or o.zip is distinct from coalesce(new.zip, '')
            or o.lat is distinct from v_lat or o.lon is distinct from v_lon or o.raio is distinct from v_raio or o.dias_trabalho is distinct from v_dias);
  end if;
  return new;
end $f$;
drop trigger if exists projetos_obra on public.projetos;
create trigger projetos_obra before insert or update on public.projetos for each row execute function public.obra_do_projeto();
revoke all on function public.obra_do_projeto(), public.nome_livre_de_obra(uuid, text, uuid) from public, anon, authenticated;

-- Ganhou a concorrência: a obra já nasce sozinha (gatilho acima). Esta função passa a só completar a obra que existe
-- (nome, local, datas, responsável, dias), e a criar só quando o gatilho não chegou a criar (projeto sem conta, por exemplo).
create or replace function public.criar_obra_da_concorrencia(p_convite uuid, p jsonb) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare v public.concorrencia_convites; c public.concorrencias; v_obra uuid; eu public.membros := public.meu_membro();
begin
  if eu.id is null or not public.tenho_permissao('settings.obras') then raise exception 'Sem permissão para criar obras.'; end if;
  select * into v from public.concorrencia_convites where id = p_convite and convidada_id = eu.empresa_id;
  if v.id is null or v.situacao <> 'vencedora' then raise exception 'Esta empresa não venceu esta concorrência.'; end if;
  select * into c from public.concorrencias where id = v.concorrencia_id;
  select id into v_obra from public.obras where empresa_id = eu.empresa_id and concorrencia_id = c.id;
  perform set_config('kb.conc_funcao', '1', true);
  if v_obra is not null then
    update public.obras set
      nome = coalesce(nullif(btrim(p ->> 'nome'), ''), nome), contratante_id = coalesce(nullif(p ->> 'contratante_id', '')::uuid, contratante_id), dono_id = coalesce(nullif(p ->> 'dono_id', '')::uuid, dono_id),
      endereco = coalesce(p ->> 'endereco', endereco), municipio = coalesce(nullif(p ->> 'municipio', ''), municipio), estado = coalesce(nullif(p ->> 'estado', ''), estado), zip = coalesce(p ->> 'zip', zip),
      lat = coalesce(nullif(p ->> 'lat', '')::double precision, lat), lon = coalesce(nullif(p ->> 'lon', '')::double precision, lon), raio = coalesce(nullif(p ->> 'raio', '')::int, raio),
      inicio = coalesce(nullif(p ->> 'inicio', '')::date, inicio), prazo = coalesce(nullif(p ->> 'prazo', '')::date, prazo),
      responsavel_id = coalesce(nullif(p ->> 'responsavel_id', '')::uuid, responsavel_id),
      dias_trabalho = coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(case when jsonb_typeof(p -> 'dias_trabalho') = 'array' then p -> 'dias_trabalho' else '[]'::jsonb end) x), dias_trabalho)
    where id = v_obra;
    return v_obra;
  end if;
  insert into public.obras (empresa_id, nome, contratante_id, dono_id, endereco, municipio, estado, zip, lat, lon, raio, inicio, prazo, responsavel_id, dias_trabalho, projeto_id,
                            vinculo_empresa_id, vinculo_obra_id, concorrencia_id)
  values (eu.empresa_id, public.nome_livre_de_obra(eu.empresa_id, p ->> 'nome'), (p ->> 'contratante_id')::uuid, nullif(p ->> 'dono_id', '')::uuid, coalesce(p ->> 'endereco', ''), p ->> 'municipio', p ->> 'estado', coalesce(p ->> 'zip', ''),
          nullif(p ->> 'lat', '')::double precision, nullif(p ->> 'lon', '')::double precision, coalesce(nullif(p ->> 'raio', '')::int, 150), (p ->> 'inicio')::date, (p ->> 'prazo')::date,
          nullif(p ->> 'responsavel_id', '')::uuid, coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(case when jsonb_typeof(p -> 'dias_trabalho') = 'array' then p -> 'dias_trabalho' else '[]'::jsonb end) x), '{1,2,3,4,5}'::smallint[]), v.projeto_id,
          c.empresa_id, c.obra_id, c.id)
  returning id into v_obra;
  if v.projeto_id is not null then update public.projetos set obra_id = v_obra where id = v.projeto_id and empresa_id = eu.empresa_id; end if;
  return v_obra;
end $f$;

commit;
