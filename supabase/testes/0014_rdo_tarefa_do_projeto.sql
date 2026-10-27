-- KORbuild · teste da migração 0021: o RDO aprovado leva o % feito às tarefas do cronograma do projeto.
-- Tudo dentro de uma transação que termina em ROLLBACK. Se chegar ao fim, imprime 'rdo e tarefas do projeto: todas as verificações passaram'.

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000014a1', 'kb-teste14-ana@example.com', '{"nome":"Ana Catorze"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000014c1', 'kb-teste14-jose@example.com', '{}', 'authenticated', 'authenticated');

create function pg_temp.como(p_id uuid, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;
grant execute on function pg_temp.como(uuid, text) to authenticated;
create table pg_temp.guarda (chave text primary key, valor text);
grant all on pg_temp.guarda to authenticated, anon;
create function pg_temp.g(p text) returns text language sql as $$ select valor from pg_temp.guarda where chave = p $$;
grant execute on function pg_temp.g(text) to authenticated, anon;

-- Ana (administradora) cria a empresa e o projeto ganho; José (encarregado) preenche o diário; Ana aprova
select pg_temp.como('00000000-0000-4000-8000-0000000014a1', 'kb-teste14-ana@example.com');
select public.criar_empresa('{"nome":"Prestadora Catorze","atuacao":"prestadora"}');
insert into pg_temp.guarda values ('tj', public.convidar_usuario('kb-teste14-jose@example.com', 'José Catorze', (select id from public.perfis_acesso where chave = 'encarregado')));
insert into public.contatos (nome, papeis, email) values ('Cliente Catorze', array['cliente'], 'c14@example.com');
insert into public.projetos (nome, contratante_id, cidade, estado, tipo, situacao, liberado_em, cronograma)
  values ('Reforma Catorze', (select id from public.contatos where nome = 'Cliente Catorze'), 'Concord', 'NH', 'reforma', 'ganha', now(),
          '{"tarefas":[{"id":"t1","nome":"Demolição","inicio":"2026-10-20","dias":3,"pct":20},{"id":"t2","nome":"Pintura","inicio":"2026-10-26","dias":5}],"marcos":[]}');
insert into pg_temp.guarda select 'pj', id::text from public.projetos where nome = 'Reforma Catorze';
insert into pg_temp.guarda select 'obra', obra_id::text from public.projetos where nome = 'Reforma Catorze';
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000014c1', 'kb-teste14-jose@example.com');
select public.aceitar_convite(pg_temp.g('tj'));

do $$
declare v_obra uuid := pg_temp.g('obra')::uuid;
begin
  if v_obra is null then raise exception 'FALHOU: o projeto ganho não virou obra'; end if;
  -- o diário aponta a tarefa t1 com 60% e a t2 com 15%; uma tarefa inexistente e uma etapa de obra inexistente são ignoradas
  perform public.salvar_rdo(jsonb_build_object('id', 'eeeeeeee-0000-4000-8000-000000000014', 'obra_id', v_obra, 'data', current_date,
    'conteudo', jsonb_build_object('clima', '{"manha":{"tempo":"sol"},"tarde":{"tempo":"sol"}}'::jsonb, 'equipe', '[{"funcao":"Carpenter","presentes":2}]'::jsonb,
      'atividades', jsonb_build_array(jsonb_build_object('descricao', 'Demolição da cozinha', 'tarefaId', 't1', 'tarefaPct', 60),
                                      jsonb_build_object('descricao', 'Começou a pintura', 'tarefaId', 't2', 'tarefaPct', '15'),
                                      jsonb_build_object('descricao', 'Tarefa que não existe', 'tarefaId', 't9', 'tarefaPct', 50),
                                      jsonb_build_object('descricao', 'Etapa de obra que não existe', 'cronoEtapaId', 'tf-abc', 'cronoPct', 50),
                                      jsonb_build_object('descricao', 'Sem tarefa')))));
  perform public.enviar_rdo('eeeeeeee-0000-4000-8000-000000000014', 1);
end $$;
reset role;

select pg_temp.como('00000000-0000-4000-8000-0000000014a1', 'kb-teste14-ana@example.com');
do $$
declare v_pj uuid := pg_temp.g('pj')::uuid; v jsonb; t jsonb;
begin
  v := public.aprovar_rdo('eeeeeeee-0000-4000-8000-000000000014');
  if (v ->> 'etapas')::int <> 2 then raise exception 'FALHOU: tarefas atualizadas: %', v ->> 'etapas'; end if;

  select x into t from public.projetos p, jsonb_array_elements(p.cronograma -> 'tarefas') x where p.id = v_pj and x ->> 'id' = 't1';
  if (t ->> 'pct')::int <> 60 then raise exception 'FALHOU: t1 pct = %', t ->> 'pct'; end if;
  if jsonb_array_length(t -> 'avancos') <> 1 or (t -> 'avancos' -> 0 ->> 'antes')::int <> 20 or (t -> 'avancos' -> 0 ->> 'por') <> 'Ana Catorze' or (t -> 'avancos' -> 0 ->> 'rdoNumero') <> '1' then raise exception 'FALHOU: histórico de t1: %', t -> 'avancos'; end if;
  select x into t from public.projetos p, jsonb_array_elements(p.cronograma -> 'tarefas') x where p.id = v_pj and x ->> 'id' = 't2';
  if (t ->> 'pct')::int <> 15 or (t -> 'avancos' -> 0 ->> 'antes')::int <> 0 then raise exception 'FALHOU: t2: %', t; end if;
  -- a ordem das tarefas e os marcos ficaram como estavam; a obra continua uma só
  if (select p.cronograma -> 'tarefas' -> 0 ->> 'id' from public.projetos p where p.id = v_pj) <> 't1' then raise exception 'FALHOU: ordem das tarefas'; end if;
  if (select jsonb_typeof(p.cronograma -> 'marcos') from public.projetos p where p.id = v_pj) <> 'array' then raise exception 'FALHOU: marcos sumiram'; end if;
  if (select count(*) from public.obras where projeto_id = v_pj) <> 1 then raise exception 'FALHOU: obra duplicada'; end if;
  -- aprovar de novo não repete
  v := public.aprovar_rdo('eeeeeeee-0000-4000-8000-000000000014');
  if v ? 'etapas' then raise exception 'FALHOU: aprovou duas vezes'; end if;
end $$;

reset role;
select 'rdo e tarefas do projeto: todas as verificações passaram' as resultado;
rollback;
