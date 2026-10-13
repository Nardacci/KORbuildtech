-- KORbuild · teste da fatia 5 (supabase/migrations/20261016_0007_cronograma.sql): o cronograma.
-- Tudo dentro de uma transação que termina em ROLLBACK: nada de teste fica no banco.
-- Cada verificação que falhar interrompe com 'FALHOU: …'. Se chegar ao fim, imprime 'fatia 5: todas as verificações passaram'.
-- Pessoas: Ana (Administradora da prestadora A), José (Encarregado da A, preenche o RDO), Tom (Administrador da
--          construtora B, que contrata a A numa obra) e Eva (Administradora da C, de fora).

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000005a1', 'kb-teste5-ana@example.com', '{"nome":"Ana Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000005b1', 'kb-teste5-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000005c1', 'kb-teste5-jose@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000005e1', 'kb-teste5-eva@example.com', '{"nome":"Eva Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000005d1', 'kb-teste5-bob@example.com', '{}', 'authenticated', 'authenticated');

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

-- ---------- Empresas, pessoas e obras ----------
select pg_temp.como('00000000-0000-4000-8000-0000000005a1', 'kb-teste5-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Prestadora Teste A","atuacao":"prestadora"}')::text);
insert into pg_temp.guarda values ('tj', public.convidar_usuario('kb-teste5-jose@example.com', 'José Teste', (select id from public.perfis_acesso where chave = 'encarregado')));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000005c1', 'kb-teste5-jose@example.com');
select public.aceitar_convite(pg_temp.g('tj'));
insert into pg_temp.guarda values ('jose', (select id::text from public.membros where user_id = auth.uid()));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000005a1', 'kb-teste5-ana@example.com');
insert into public.contatos (nome, papeis) values ('Cliente Direto', array['cliente']), ('Construtora B', array['construtora']);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo, responsavel_id)
  values ('Obra própria', (select id from public.contatos where nome = 'Cliente Direto'), 'Manchester', 'NH', 42.99, -71.46, '2026-01-05', '2026-04-04', pg_temp.g('jose')::uuid),
         ('Obra da construtora', (select id from public.contatos where nome = 'Construtora B'), 'Nashua', 'NH', 42.76, -71.46, '2026-01-01', '2027-12-31', pg_temp.g('jose')::uuid);
insert into public.modelos_cronograma (nome, etapas) values ('Casa', '[{"nome":"Fundação","pct":20},{"nome":"Estrutura","pct":50},{"nome":"Acabamento","pct":30}]');
insert into pg_temp.guarda values ('o1', (select id::text from public.obras where nome = 'Obra própria')),
                                  ('o2', (select id::text from public.obras where nome = 'Obra da construtora')),
                                  ('modelo', (select id::text from public.modelos_cronograma where nome = 'Casa')),
                                  ('hoje', public.hoje_da_empresa(pg_temp.g('A')::uuid)::text);
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000005b1', 'kb-teste5-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Construtora Teste B","atuacao":"construtora"}')::text);
insert into public.contatos (nome, papeis) values ('Dono', array['cliente']);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo)
  values ('Obra B', (select id from public.contatos where nome = 'Dono'), 'Nashua', 'NH', 42.76, -71.46, '2026-01-01', '2027-12-31');
insert into pg_temp.guarda values ('ob', (select id::text from public.obras where nome = 'Obra B'));
insert into pg_temp.guarda values ('tb', public.convidar_usuario('kb-teste5-bob@example.com', 'Bob Teste', (select id from public.perfis_acesso where chave = 'trabalhador')));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000005d1', 'kb-teste5-bob@example.com');
select public.aceitar_convite(pg_temp.g('tb'));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000005e1', 'kb-teste5-eva@example.com');
insert into pg_temp.guarda values ('C', public.criar_empresa('{"nome":"Empresa Teste C","atuacao":"prestadora"}')::text);
reset role;
update public.obras set vinculo_empresa_id = pg_temp.g('B')::uuid, vinculo_obra_id = pg_temp.g('ob')::uuid where id = pg_temp.g('o2')::uuid;

-- ---------- Ana monta (daily.cronograma) ----------
select pg_temp.como('00000000-0000-4000-8000-0000000005a1', 'kb-teste5-ana@example.com');
do $$
declare e1 uuid; e2 uuid; n int; v jsonb;
begin
  -- modelo: 90 dias (05/01 → 04/04), 20/50/30 → Fundação 18 dias, Estrutura 45, Acabamento 27; a primeira linha de base nasce junto
  n := public.aplicar_modelo(pg_temp.g('o1')::uuid, pg_temp.g('modelo')::uuid);
  if n <> 3 then raise exception 'FALHOU: etapas do modelo: %', n; end if;
  select jsonb_agg(jsonb_build_array(nome, inicio, fim) order by ordem) into v from public.cronograma_etapas where obra_id = pg_temp.g('o1')::uuid;
  if v::text <> '[["Fundação", "2026-01-05", "2026-01-22"], ["Estrutura", "2026-01-23", "2026-03-08"], ["Acabamento", "2026-03-09", "2026-04-04"]]' then
    raise exception 'FALHOU: distribuição do modelo: %', v; end if;
  if (select count(*) from public.linhas_base where obra_id = pg_temp.g('o1')::uuid) <> 1 then raise exception 'FALHOU: a primeira linha de base não nasceu com o modelo'; end if;
  begin perform public.aplicar_modelo(pg_temp.g('o1')::uuid, pg_temp.g('modelo')::uuid); raise exception 'FALHOU: aplicou o modelo numa obra que já tem etapas';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- etapa nova na obra da construtora (sem modelo): primeira linha de base automática
  e1 := public.salvar_etapa(jsonb_build_object('obra_id', pg_temp.g('o2'), 'nome', '  Framing do 1º pavimento ', 'inicio', '2026-02-01', 'fim', '2026-02-28', 'responsavel_id', pg_temp.g('jose')));
  e2 := public.salvar_etapa(jsonb_build_object('obra_id', pg_temp.g('o2'), 'nome', 'Siding', 'inicio', '2026-03-01', 'fim', '2026-03-31'));
  insert into pg_temp.guarda values ('e1', e1::text), ('e2', e2::text);
  if (select nome from public.cronograma_etapas where id = e1) <> 'Framing do 1º pavimento' then raise exception 'FALHOU: nome aparado'; end if;
  if (select count(*) from public.linhas_base where obra_id = pg_temp.g('o2')::uuid) <> 1 then raise exception 'FALHOU: primeira linha de base da obra 2'; end if;
  if (select ordem from public.cronograma_etapas where id = e2) <> 1 then raise exception 'FALHOU: ordem da segunda etapa'; end if;
  -- validações
  begin perform public.salvar_etapa(jsonb_build_object('obra_id', pg_temp.g('o2'), 'nome', 'X', 'inicio', '2026-03-10', 'fim', '2026-03-01')); raise exception 'FALHOU: fim antes do início';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.salvar_etapa(jsonb_build_object('obra_id', pg_temp.g('ob'), 'nome', 'X', 'inicio', '2026-03-01', 'fim', '2026-03-10')); raise exception 'FALHOU: etapa na obra de outra empresa';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- editar, reordenar
  perform public.salvar_etapa(jsonb_build_object('id', e2, 'nome', 'Siding e trim', 'inicio', '2026-03-01', 'fim', '2026-04-10'));
  if (select fim from public.cronograma_etapas where id = e2) <> '2026-04-10' then raise exception 'FALHOU: editar etapa'; end if;
  perform public.ordenar_etapas(pg_temp.g('o2')::uuid, array[e2, e1]);
  if (select ordem from public.cronograma_etapas where id = e2) <> 0 then raise exception 'FALHOU: reordenar'; end if;
  begin perform public.ordenar_etapas(pg_temp.g('o2')::uuid, array[e2]); raise exception 'FALHOU: reordenou com a lista incompleta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- o pct não muda direto; muda por avanço manual, com histórico e auditoria
  begin update public.cronograma_etapas set pct = 50 where id = e1; raise exception 'FALHOU: o app mudou o pct direto';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin update public.cronograma_etapas set nome = 'x' where id = e1; raise exception 'FALHOU: o app editou a etapa direto';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  perform public.registrar_avanco(e1, 40, '2026-02-10');
  if (select pct from public.cronograma_etapas where id = e1) <> 40 then raise exception 'FALHOU: o avanço não foi para a etapa'; end if;
  if (select count(*) from public.etapa_avancos where etapa_id = e1 and fonte = 'manual' and antes = 0 and pct = 40) <> 1 then raise exception 'FALHOU: histórico do avanço'; end if;
  if not exists (select 1 from public.auditoria where tabela = 'etapa_avancos') then raise exception 'FALHOU: avanço manual sem auditoria'; end if;
  begin perform public.registrar_avanco(e1, 120); raise exception 'FALHOU: avanço acima de 100';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin update public.etapa_avancos set pct = 99; raise exception 'FALHOU: alterou um avanço';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- nova linha de base pede motivo; o desvio é medido contra a última
  begin perform public.nova_linha_base(pg_temp.g('o2')::uuid, ' '); raise exception 'FALHOU: linha de base sem motivo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  perform public.nova_linha_base(pg_temp.g('o2')::uuid, 'Replanejado com o cliente');
  if (select count(*) from public.linhas_base where obra_id = pg_temp.g('o2')::uuid) <> 2 then raise exception 'FALHOU: segunda linha de base'; end if;
  if (select etapas -> e2::text ->> 'fim' from public.linhas_base where obra_id = pg_temp.g('o2')::uuid order by em desc limit 1) <> '2026-04-10' then raise exception 'FALHOU: retrato da linha de base'; end if;
  -- publicar: só obra com vínculo
  begin perform public.publicar_cronograma(pg_temp.g('o1')::uuid); raise exception 'FALHOU: publicou obra sem vínculo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  if public.publicar_cronograma(pg_temp.g('o2')::uuid) <> 1 then raise exception 'FALHOU: primeira publicação'; end if;
  perform public.salvar_etapa(jsonb_build_object('id', e2, 'nome', 'Siding e trim', 'inicio', '2026-03-01', 'fim', '2026-04-20'));
  if public.publicar_cronograma(pg_temp.g('o2')::uuid) <> 2 then raise exception 'FALHOU: segunda publicação'; end if;
  if (select retrato -> 'cronograma' -> 'etapas' -> 0 ->> 'fim' from public.publicacoes_cronograma where obra_id = pg_temp.g('o2')::uuid and versao = 1) <> '2026-04-10' then raise exception 'FALHOU: a versão 1 mudou'; end if;
  if (select retrato -> 'responsaveis' ->> pg_temp.g('jose') from public.publicacoes_cronograma where versao = 2) <> 'José Teste' then raise exception 'FALHOU: responsáveis no retrato'; end if;
  begin delete from public.publicacoes_cronograma; raise exception 'FALHOU: apagou publicação';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- excluir etapa sem andamento de RDO: pode
  perform public.excluir_etapa(public.salvar_etapa(jsonb_build_object('obra_id', pg_temp.g('o2'), 'nome', 'Temporária', 'inicio', '2026-05-01', 'fim', '2026-05-02')));
end $$;
reset role;

-- ---------- José: lê, aponta a etapa no RDO; não monta ----------
select pg_temp.como('00000000-0000-4000-8000-0000000005c1', 'kb-teste5-jose@example.com');
do $$
begin
  if (select count(*) from public.cronograma_etapas where obra_id = pg_temp.g('o2')::uuid) <> 2 then raise exception 'FALHOU: o encarregado não lê as etapas'; end if;
  begin perform public.salvar_etapa(jsonb_build_object('obra_id', pg_temp.g('o2'), 'nome', 'X', 'inicio', '2026-03-01', 'fim', '2026-03-10')); raise exception 'FALHOU: o encarregado montou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.registrar_avanco(pg_temp.g('e1')::uuid, 50); raise exception 'FALHOU: o encarregado ajustou o %%';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- o RDO da obra da construtora aponta a etapa e1 com 60% (e uma etapa inexistente, ignorada)
  perform public.salvar_rdo(jsonb_build_object('id', 'eeeeeeee-0000-4000-8000-000000000001', 'obra_id', pg_temp.g('o2'), 'data', pg_temp.g('hoje')::date,
    'conteudo', jsonb_build_object('clima', '{"manha":{"tempo":"sol"},"tarde":{"tempo":"sol"}}'::jsonb, 'equipe', '[{"funcao":"Carpenter","presentes":3}]'::jsonb,
      'atividades', jsonb_build_array(jsonb_build_object('descricao', 'Framing', 'cronoEtapaId', pg_temp.g('e1'), 'cronoPct', 60),
                                      jsonb_build_object('descricao', 'Outra', 'cronoEtapaId', gen_random_uuid(), 'cronoPct', 10),
                                      jsonb_build_object('descricao', 'Etapa de outra obra', 'cronoEtapaId', (select id from public.cronograma_etapas where nome = 'Fundação'), 'cronoPct', 90),
                                      jsonb_build_object('descricao', 'Sem etapa')))));
  perform public.enviar_rdo('eeeeeeee-0000-4000-8000-000000000001', 1);
end $$;
reset role;

-- ---------- Tom (construtora) aprova: o andamento entra no cronograma da prestadora; ele lê só pela função ----------
select pg_temp.como('00000000-0000-4000-8000-0000000005b1', 'kb-teste5-tom@example.com');
do $$
declare v jsonb; n int;
begin
  if exists (select 1 from public.cronograma_etapas) or exists (select 1 from public.publicacoes_cronograma) then raise exception 'FALHOU: a construtora leu a tabela da prestadora'; end if;
  select count(*) into n from public.cronogramas_recebidos(pg_temp.g('ob')::uuid);
  if n <> 2 then raise exception 'FALHOU: cronogramas recebidos: %', n; end if;
  if (select x ->> 'versao' from public.cronogramas_recebidos(pg_temp.g('ob')::uuid) x limit 1) <> '2' then raise exception 'FALHOU: a última versão primeiro'; end if;
  if exists (select 1 from public.cronogramas_recebidos(gen_random_uuid())) then raise exception 'FALHOU: recebidos de obra que não é dele'; end if;
  v := public.aprovar_rdo('eeeeeeee-0000-4000-8000-000000000001');
  if (v ->> 'etapas')::int <> 1 then raise exception 'FALHOU: avanços pelo RDO (a etapa de outra obra e a inexistente ficam de fora): %', v; end if;
end $$;
reset role;
-- Bob (trabalhador da construtora, sem "acompanhar"): não lê as publicações
select pg_temp.como('00000000-0000-4000-8000-0000000005d1', 'kb-teste5-bob@example.com');
do $$ begin
  if exists (select 1 from public.cronogramas_recebidos(pg_temp.g('ob')::uuid)) then raise exception 'FALHOU: sem daily.acompanhar leu as publicações'; end if;
end $$;
reset role;
do $$ begin
  if (select pct from public.cronograma_etapas where id = pg_temp.g('e1')::uuid) <> 60 then raise exception 'FALHOU: o %% do RDO aprovado não chegou à etapa'; end if;
  if (select pct from public.cronograma_etapas where nome = 'Fundação') <> 0 then raise exception 'FALHOU: o RDO levou andamento a uma etapa de outra obra'; end if;
  if (select count(*) from public.etapa_avancos where etapa_id = pg_temp.g('e1')::uuid and fonte = 'rdo' and antes = 40 and pct = 60 and rdo_numero = 1
        and por = '00000000-0000-4000-8000-0000000005b1') <> 1 then raise exception 'FALHOU: histórico do avanço pelo RDO'; end if;
end $$;

-- ---------- Etapa com andamento aprovado: não sai; só quem aprovou altera (decisão de outubro de 2026) ----------
select pg_temp.como('00000000-0000-4000-8000-0000000005a1', 'kb-teste5-ana@example.com');
do $$
begin
  begin perform public.excluir_etapa(pg_temp.g('e1')::uuid); raise exception 'FALHOU: excluiu etapa com andamento de RDO';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; if sqlerrm not like '%não pode ser excluída%' then raise exception 'FALHOU: mensagem da exclusão: %', sqlerrm; end if; end;
  begin perform public.salvar_etapa(jsonb_build_object('id', pg_temp.g('e1'), 'nome', 'Framing', 'inicio', '2026-02-01', 'fim', '2026-03-15')); raise exception 'FALHOU: a Ana editou etapa travada pela construtora';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; if sqlerrm not like '%só quem aprovou%' then raise exception 'FALHOU: mensagem da trava: %', sqlerrm; end if; end;
  begin perform public.registrar_avanco(pg_temp.g('e1')::uuid, 70); raise exception 'FALHOU: a Ana ajustou o %% de etapa travada';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- a outra etapa (sem andamento de RDO) continua livre
  perform public.salvar_etapa(jsonb_build_object('id', pg_temp.g('e2'), 'nome', 'Siding e trim', 'inicio', '2026-03-01', 'fim', '2026-04-30'));
  perform public.excluir_etapa(pg_temp.g('e2')::uuid);
  if exists (select 1 from public.cronograma_etapas where id = pg_temp.g('e2')::uuid) then raise exception 'FALHOU: não excluiu etapa livre'; end if;
end $$;
reset role;

-- Eva (de fora) e anônimo: nada.
select pg_temp.como('00000000-0000-4000-8000-0000000005e1', 'kb-teste5-eva@example.com');
do $$ begin
  if exists (select 1 from public.cronograma_etapas) or exists (select 1 from public.linhas_base) or exists (select 1 from public.etapa_avancos) then raise exception 'FALHOU: outra empresa leu o cronograma'; end if;
  if exists (select 1 from public.cronogramas_recebidos(pg_temp.g('ob')::uuid)) then raise exception 'FALHOU: outra empresa leu as publicações'; end if;
  begin perform public.registrar_avanco(pg_temp.g('e1')::uuid, 10); raise exception 'FALHOU: outra empresa registrou avanço';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.cronograma_etapas; raise exception 'FALHOU: anônimo leu etapas';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.cronogramas_recebidos(null); raise exception 'FALHOU: anônimo chamou cronogramas_recebidos';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- Excluir a empresa leva tudo junto (cascata), sem esbarrar nas travas.
delete from public.empresas where id = pg_temp.g('A')::uuid;
do $$ begin
  if exists (select 1 from public.cronograma_etapas) or exists (select 1 from public.etapa_avancos) or exists (select 1 from public.linhas_base) or exists (select 1 from public.publicacoes_cronograma) then
    raise exception 'FALHOU: sobrou cronograma da empresa excluída';
  end if;
end $$;

select 'fatia 5: todas as verificações passaram' as resultado;
rollback;
