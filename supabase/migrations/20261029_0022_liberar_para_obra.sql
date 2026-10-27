-- KORbuild · migração 0022: "Liberar para obra" (docs/daily-primeira-versao.md). A porta do Daily deixa de ser a situação
-- comercial "ganha" e passa a ser o projeto liberado para obra (análise concluída): projetos.liberado_em / liberado_por.
-- O gatilho projetos_obra (0020) cria a obra 1:1 quando o projeto é liberado; ganhar a concorrência depois de liberar
-- aplica o vínculo com a obra da contratante na obra que já existe. Não apaga nem altera dado existente, exceto marcar
-- como liberados os projetos que já tinham obra automática (para continuarem no Daily).

begin;

alter table public.projetos add column if not exists liberado_em timestamptz, add column if not exists liberado_por text;
update public.projetos set liberado_em = coalesce(liberado_em, criado_em, now()) where obra_id is not null and situacao = 'ganha' and liberado_em is null;

create or replace function public.obra_do_projeto() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare ini date; fim date; o_id uuid; v public.concorrencia_convites; c public.concorrencias; ex jsonb := coalesce(new.execucao, '{}'::jsonb);
        v_lat numeric; v_lon numeric; v_raio int; v_dias smallint[];
begin
  if new.liberado_em is not null and new.situacao = 'perdida' then new.liberado_em := null; new.liberado_por := null; end if;
  v_lat := case when (ex ->> 'lat') ~ '^-?\d+(\.\d+)?$' and (ex ->> 'lon') ~ '^-?\d+(\.\d+)?$' then (ex ->> 'lat')::numeric end;
  v_lon := case when v_lat is not null then (ex ->> 'lon')::numeric end;
  if v_lat is not null and (abs(v_lat) > 90 or abs(v_lon) > 180) then v_lat := null; v_lon := null; end if;
  v_raio := least(2000, greatest(50, coalesce(case when (ex ->> 'raio') ~ '^\d+(\.\d+)?$' then round((ex ->> 'raio')::numeric)::int end, 150)));
  v_dias := coalesce((select array_agg(x::smallint order by x::smallint) from jsonb_array_elements_text(case when jsonb_typeof(ex -> 'diasTrabalho') = 'array' then ex -> 'diasTrabalho' else '[]'::jsonb end) x where x ~ '^[0-6]$'), '{}'::smallint[]);
  if cardinality(v_dias) = 0 then v_dias := '{1,2,3,4,5}'::smallint[]; end if;

  -- o aparelho pode mandar obra_id vazio (ainda não soube da obra automática): a obra do projeto não se perde
  if tg_op = 'UPDATE' and new.obra_id is null and old.obra_id is not null
     and exists (select 1 from public.obras where id = old.obra_id and empresa_id = new.empresa_id and projeto_id = new.id) then
    new.obra_id := old.obra_id;
  end if;
  -- ganho numa concorrência: a obra nasce (ou passa a ficar) ligada à obra de quem contratou (CO-14)
  if new.concorrencia ? 'conviteId' and (new.concorrencia ->> 'conviteId') ~ '^[0-9a-f-]{36}$' then
    select * into v from public.concorrencia_convites where id = (new.concorrencia ->> 'conviteId')::uuid;
    if v.id is not null then select * into c from public.concorrencias where id = v.concorrencia_id; end if;
  end if;
  if new.liberado_em is not null and new.obra_id is null then
    -- datas: do cronograma do projeto (tarefas com início); sem ele, hoje → +89 dias
    select min((t ->> 'inicio')::date), max((t ->> 'inicio')::date + greatest(coalesce(nullif(t ->> 'dias', '')::int, 1), 1) - 1)
      into ini, fim
      from jsonb_array_elements(case when jsonb_typeof(new.cronograma -> 'tarefas') = 'array' then new.cronograma -> 'tarefas' else '[]'::jsonb end) t
     where coalesce(t ->> 'inicio', '') ~ '^\d{4}-\d{2}-\d{2}$';
    ini := coalesce(ini, current_date);
    fim := greatest(coalesce(fim, ini + 89), ini);
    perform set_config('kb.conc_funcao', '1', true);
    insert into public.obras (empresa_id, nome, contratante_id, dono_id, endereco, municipio, estado, zip, lat, lon, raio, inicio, prazo, responsavel_id, dias_trabalho, projeto_id,
                              vinculo_empresa_id, vinculo_obra_id, concorrencia_id)
    values (new.empresa_id, public.nome_livre_de_obra(new.empresa_id, new.nome), new.contratante_id, new.dono_id, coalesce(new.endereco, ''), new.cidade, new.estado, coalesce(new.zip, ''),
            v_lat, v_lon, v_raio, ini, fim, null, v_dias, new.id, c.empresa_id, c.obra_id, c.id)
    returning id into o_id;
    new.obra_id := o_id;
  elsif tg_op = 'UPDATE' and new.obra_id is not null then
    -- o cadastro do projeto manda na obra que nasceu dele
    perform set_config('kb.conc_funcao', '1', true);
    update public.obras o
       set nome = public.nome_livre_de_obra(new.empresa_id, new.nome, o.id), contratante_id = new.contratante_id, dono_id = new.dono_id,
           endereco = coalesce(new.endereco, ''), municipio = new.cidade, estado = new.estado, zip = coalesce(new.zip, ''),
           lat = v_lat, lon = v_lon, raio = v_raio, dias_trabalho = v_dias,
           vinculo_empresa_id = coalesce(o.vinculo_empresa_id, c.empresa_id), vinculo_obra_id = coalesce(o.vinculo_obra_id, c.obra_id), concorrencia_id = coalesce(o.concorrencia_id, c.id)
     where o.id = new.obra_id and o.empresa_id = new.empresa_id and o.projeto_id = new.id
       and (o.nome is distinct from new.nome or o.contratante_id is distinct from new.contratante_id or o.dono_id is distinct from new.dono_id
            or o.endereco is distinct from coalesce(new.endereco, '') or o.municipio is distinct from new.cidade or o.estado is distinct from new.estado or o.zip is distinct from coalesce(new.zip, '')
            or o.lat is distinct from v_lat or o.lon is distinct from v_lon or o.raio is distinct from v_raio or o.dias_trabalho is distinct from v_dias
            or (o.vinculo_obra_id is null and c.obra_id is not null));
  end if;
  return new;
end $f$;

commit;
