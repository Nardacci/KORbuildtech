-- KORbuild · teste da fatia 7 (supabase/migrations/20261019_0010_concorrencias.sql): as concorrências e o canal.
-- Tudo dentro de uma transação que termina em ROLLBACK. Cada verificação que falhar interrompe com 'FALHOU: …'.
-- Pessoas: Tom (Administrador da construtora B, a contratante), Zé (Encarregado da B: não vê concorrências),
--          Ana (Administradora da prestadora A: convidada com conta, depois contratante na quarteirização),
--          Eva (Administradora da prestadora C: convidada com conta), Bayside (convidada pelo link; depois Bia cria a conta D com o e-mail do link).

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000008a1', 'kb-teste8-ana@example.com', '{"nome":"Ana Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008b1', 'kb-teste8-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008b2', 'kb-teste8-ze@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008c1', 'kb-teste8-eva@example.com', '{"nome":"Eva Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008d1', 'kb-teste8-bay@example.com', '{"nome":"Bia Teste"}', 'authenticated', 'authenticated');

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
create function pg_temp.u(p text) returns uuid language sql as $$ select valor::uuid from pg_temp.guarda where chave = p $$;
grant execute on function pg_temp.u(text) to authenticated, anon;
-- as funções da fatia marcam a transação (kb.conc_funcao); aqui a marca é apagada antes de testar o que deve falhar
create function pg_temp.limpa() returns void language sql as $$ select set_config('kb.conc_funcao', '', true) $$;
grant execute on function pg_temp.limpa() to authenticated, anon;
-- a função de borda chama com a chave de serviço: sem usuário (reset role não apaga as claims)
create function pg_temp.ninguem() returns void language sql as $$ select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true) $$;

-- ---------- Empresas e pessoas ----------
select pg_temp.como('00000000-0000-4000-8000-0000000008a1', 'kb-teste8-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Prestadora Teste A","atuacao":"prestadora"}')::text);
insert into public.contatos (nome, papeis, email) values ('Construtora B', array['construtora'], 'b@example.com');
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008c1', 'kb-teste8-eva@example.com');
insert into pg_temp.guarda values ('C', public.criar_empresa('{"nome":"Prestadora Teste C","atuacao":"prestadora"}')::text);
insert into public.contatos (nome, papeis, email) values ('Prestadora A', array['construtora'], 'a@example.com');
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008b1', 'kb-teste8-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Construtora Teste B","atuacao":"construtora"}')::text);
insert into pg_temp.guarda values ('tz', public.convidar_usuario('kb-teste8-ze@example.com', 'Zé Teste', (select id from public.perfis_acesso where chave = 'encarregado')));
insert into public.contatos (nome, papeis, email, conta_empresa_id) values
  ('Prestadora A', array['prestadora'], 'a@example.com', pg_temp.u('A')),
  ('Prestadora C', array['prestadora'], 'c@example.com', pg_temp.u('C')),
  ('Bayside Drywall', array['prestadora'], 'KB-Teste8-Bay@example.com', null),
  ('Dono', array['cliente'], '', null);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo)
  values ('Edifício Teste', (select id from public.contatos where nome = 'Dono'), 'Nashua', 'NH', 42.76, -71.46, '2026-01-01', '2027-12-31');
insert into pg_temp.guarda values ('obB', (select id::text from public.obras where nome = 'Edifício Teste'));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008b2', 'kb-teste8-ze@example.com');
select public.aceitar_convite(pg_temp.g('tz'));
reset role;

-- ---------- Tom monta o rascunho (gravação direta) ----------
select pg_temp.como('00000000-0000-4000-8000-0000000008b1', 'kb-teste8-tom@example.com');
do $$
declare v_id uuid; v_ana uuid;
begin
  insert into public.concorrencias (obra_id, servico, etapas, incluso, prazo, quarteirizacao, situacao, orcamento)
  values (pg_temp.u('obB'), ' Framing e drywall ', array['06 10 00', '09 21 16', '06 10 00'], array['Paredes', 'Forro'], now() + interval '5 days', 'com-aprovacao', 'aberta', '{"mostrar":"nao","valor":180000}')
  returning id into v_id;
  insert into pg_temp.guarda values ('co', v_id::text);
  if (select situacao from public.concorrencias where id = v_id) <> 'rascunho' then raise exception 'FALHOU: insert direto nasce rascunho'; end if;
  if (select cardinality(etapas) || '/' || servico from public.concorrencias where id = v_id) <> '2/Framing e drywall' then raise exception 'FALHOU: etapas e serviço aparados'; end if;
  insert into public.concorrencia_convites (concorrencia_id, contato_id, convidada_id, situacao)
    select v_id, id, pg_temp.u('C'), 'vencedora' from public.contatos where nome in ('Prestadora A', 'Prestadora C', 'Bayside Drywall');
  select id into v_ana from public.concorrencia_convites where concorrencia_id = v_id and nome = 'Prestadora A';
  insert into pg_temp.guarda values ('cvA', v_ana::text),
    ('cvC', (select id::text from public.concorrencia_convites where concorrencia_id = v_id and nome = 'Prestadora C')),
    ('cvBay', (select id::text from public.concorrencia_convites where concorrencia_id = v_id and nome = 'Bayside Drywall'));
  if (select convidada_id from public.concorrencia_convites where id = v_ana) <> pg_temp.u('A') then raise exception 'FALHOU: convidada vem do contato, não do insert'; end if;
  if (select situacao || coalesce(convidada_id::text, '-') || email from public.concorrencia_convites where id = pg_temp.u('cvBay')) <> 'enviado-kb-teste8-bay@example.com' then raise exception 'FALHOU: convite pelo link'; end if;
  begin insert into public.concorrencia_convites (concorrencia_id, contato_id) values (v_id, (select id from public.contatos where nome = 'Prestadora A')); raise exception 'FALHOU: convidou duas vezes';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.concorrencia_desenhos (concorrencia_id, nome, arquivo_path) values (v_id, 'A-101', 'outra/pasta/a.pdf'); raise exception 'FALHOU: desenho fora da pasta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.concorrencia_desenhos (concorrencia_id, nome, arquivo_path) values (v_id, 'A-101', pg_temp.g('B') || '/' || v_id || '/desenhos/a101.pdf');
end $$;
do $$
declare r jsonb;
begin
  perform pg_temp.limpa();
  begin update public.concorrencias set situacao = 'aberta' where id = pg_temp.u('co'); raise exception 'FALHOU: abriu por update direto';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  update public.concorrencias set incluso = '{}' where id = pg_temp.u('co');
  begin perform public.enviar_concorrencia(pg_temp.u('co')); raise exception 'FALHOU: enviou sem o escopo incluso';
  exception when others then if sqlerrm not like 'Descreva o que está incluso%' then raise exception 'FALHOU: % ', sqlerrm; end if; end;
  update public.concorrencias set incluso = array['Paredes', 'Forro'] where id = pg_temp.u('co');
  r := public.enviar_concorrencia(pg_temp.u('co'));
  if jsonb_array_length(r -> 'links') <> 1 or r -> 'links' -> 0 ->> 'nome' <> 'Bayside Drywall' or length(r -> 'links' -> 0 ->> 'token') <> 48 then raise exception 'FALHOU: links do envio: %', r; end if;
  insert into pg_temp.guarda values ('token', r -> 'links' -> 0 ->> 'token');
  if (select situacao from public.concorrencias where id = pg_temp.u('co')) <> 'aberta' then raise exception 'FALHOU: não abriu'; end if;
  if (select token_hash is null from public.concorrencia_convites where id = pg_temp.u('cvA')) is false then raise exception 'FALHOU: token para quem tem conta'; end if;
  if (select count(*) from public.concorrencia_historico where concorrencia_id = pg_temp.u('co') and acao = 'enviada') <> 1 then raise exception 'FALHOU: histórico do envio'; end if;
  -- depois de enviada: nada direto
  perform pg_temp.limpa();
  begin update public.concorrencias set servico = 'Outro' where id = pg_temp.u('co'); raise exception 'FALHOU: editou enviada';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from public.concorrencias where id = pg_temp.u('co'); raise exception 'FALHOU: apagou enviada';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.concorrencia_convites (concorrencia_id, contato_id) values (pg_temp.u('co'), (select id from public.contatos where nome = 'Dono')); raise exception 'FALHOU: convite direto em aberta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.concorrencia_desenhos (concorrencia_id, nome, arquivo_path) values (pg_temp.u('co'), 'A-102', pg_temp.g('B') || '/' || pg_temp.g('co') || '/desenhos/a102.pdf'); raise exception 'FALHOU: desenho direto em aberta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.concorrencia_propostas (empresa_id, convite_id, rev, total) values (pg_temp.u('B'), pg_temp.u('cvA'), 1, 10); raise exception 'FALHOU: proposta direta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from public.concorrencia_convites where id = pg_temp.u('cvC'); raise exception 'FALHOU: apagou convite de aberta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- Zé (encarregado) não vê nada; Ana (outra empresa) não lê as tabelas da B
select pg_temp.como('00000000-0000-4000-8000-0000000008b2', 'kb-teste8-ze@example.com');
do $$ begin
  if (select count(*) from public.concorrencias) + (select count(*) from public.concorrencia_convites) <> 0 then raise exception 'FALHOU: Zé vê concorrências'; end if;
  begin perform public.enviar_concorrencia(pg_temp.u('co')); raise exception 'FALHOU: Zé enviou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008a1', 'kb-teste8-ana@example.com');
do $$ begin
  if (select count(*) from public.concorrencias) + (select count(*) from public.concorrencia_convites) + (select count(*) from public.concorrencia_propostas) <> 0 then raise exception 'FALHOU: Ana lê as tabelas da B'; end if;
  begin perform public.prorrogar_concorrencia(pg_temp.u('co'), now() + interval '9 days'); raise exception 'FALHOU: Ana prorrogou a da B';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.convite_por_token(pg_temp.g('token')); raise exception 'FALHOU: usuário chamou a função do link';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ---------- Ana: o convite, Vou cotar, o projeto, a proposta ----------
do $$
declare x jsonb; v_pj uuid; n int;
begin
  select count(*) into n from public.concorrencias_recebidas(); if n <> 1 then raise exception 'FALHOU: Ana recebe % convites', n; end if;
  select r into x from public.concorrencias_recebidas() r;
  if x ? 'convites' or x -> 'orcamento' ? 'valor' or x -> 'orcamento' ->> 'mostrar' <> 'nao' then raise exception 'FALHOU: a convidada vê demais: %', x; end if;
  if x -> 'convite' ->> 'situacao' <> 'enviado' or x ->> 'situacao' <> 'aberta' or jsonb_array_length(x -> 'desenhos') <> 1 or x -> 'contratante' ->> 'nome' <> 'Construtora Teste B' or x -> 'obra' ->> 'nome' <> 'Edifício Teste' then raise exception 'FALHOU: visão do convite: %', x; end if;
  perform public.marcar_visto(pg_temp.u('cvA'));
  perform public.responder_convite(pg_temp.u('cvA'), true);
  insert into public.projetos (nome, contratante_id, cidade, estado, tipo) values ('Framing · Edifício Teste', (select id from public.contatos where nome = 'Construtora B'), 'Nashua', 'NH', 'outro') returning id into v_pj;
  insert into pg_temp.guarda values ('pjA', v_pj::text);
  perform public.vincular_projeto_ao_convite(pg_temp.u('cvA'), v_pj);
  if (select concorrencia ->> 'conviteId' from public.projetos where id = v_pj) <> pg_temp.g('cvA') then raise exception 'FALHOU: projeto sem a concorrência'; end if;
  perform pg_temp.limpa();
  update public.projetos set concorrencia = '{}' where id = v_pj;
  if (select concorrencia ->> 'id' from public.projetos where id = v_pj) <> pg_temp.g('co') then raise exception 'FALHOU: o app mudou projetos.concorrencia'; end if;
  select r into x from public.concorrencias_recebidas() r;
  if x -> 'convite' ->> 'situacao' <> 'vai-cotar' or x -> 'convite' ->> 'projetoId' <> v_pj::text then raise exception 'FALHOU: vai cotar: %', x -> 'convite'; end if;
  -- proposta: regras
  begin perform public.enviar_proposta_concorrencia(pg_temp.u('cvA'), '{"porEtapa":{"99 99 99":10}}'); raise exception 'FALHOU: etapa fora';
  exception when others then if sqlerrm not like 'Etapa fora%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.enviar_proposta_concorrencia(pg_temp.u('cvA'), '{"porEtapa":{"06 10 00":100000,"09 21 16":80000},"total":1}'); raise exception 'FALHOU: total diferente da soma';
  exception when others then if sqlerrm not like 'O total precisa%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  if public.enviar_proposta_concorrencia(pg_temp.u('cvA'), '{"porEtapa":{"06 10 00":100000,"09 21 16":80000},"outros":6400,"prazoExecucaoDias":45,"exclusoes":["Pintura",""]}') <> 1 then raise exception 'FALHOU: rev 1'; end if;
  if public.enviar_proposta_concorrencia(pg_temp.u('cvA'), '{"porEtapa":{"06 10 00":98000,"09 21 16":80000},"outros":6400}') <> 2 then raise exception 'FALHOU: rev 2'; end if;
  select r into x from public.concorrencias_recebidas() r;
  if jsonb_array_length(x -> 'convite' -> 'propostas') <> 2 or (x -> 'convite' -> 'propostas' -> 1 ->> 'total')::numeric <> 184400 or x -> 'convite' -> 'propostas' -> 0 ->> 'por' <> 'Ana Teste' or jsonb_array_length(x -> 'convite' -> 'propostas' -> 0 -> 'exclusoes') <> 1 then raise exception 'FALHOU: propostas da Ana: %', x -> 'convite' -> 'propostas'; end if;
  if (select count(*) from public.auditoria where empresa_id = pg_temp.u('A') and tabela = 'concorrencias' and acao = 'proposta') <> 2 then raise exception 'FALHOU: auditoria da convidada'; end if;
  -- pergunta no canal
  perform public.escrever_como_convidada(pg_temp.u('cvA'), 'O forro inclui isolamento?');
end $$;
reset role;

-- Eva: não vai participar
select pg_temp.como('00000000-0000-4000-8000-0000000008c1', 'kb-teste8-eva@example.com');
do $$ begin
  if (select count(*) from public.concorrencias_recebidas()) <> 1 then raise exception 'FALHOU: Eva não recebeu'; end if;
  perform public.responder_convite(pg_temp.u('cvC'), false, 'Agenda cheia');
  begin perform public.enviar_proposta_concorrencia(pg_temp.u('cvC'), '{"total":1000}'); raise exception 'FALHOU: proposta de quem não vai';
  exception when others then if sqlerrm not like 'Você respondeu%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.responder_convite(pg_temp.u('cvA'), true); raise exception 'FALHOU: Eva respondeu o convite da Ana';
  exception when others then if sqlerrm not like 'Convite não encontrado%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
end $$;
reset role;

-- ---------- Bayside, pelo link (como a função de borda, com a chave de serviço) ----------
select pg_temp.ninguem();
do $$
declare x jsonb;
begin
  if public.convite_por_token('token-errado') is not null then raise exception 'FALHOU: token errado'; end if;
  x := public.convite_por_token(pg_temp.g('token'));
  if x -> 'convite' ->> 'nome' <> 'Bayside Drywall' or x ? 'convites' then raise exception 'FALHOU: visão pelo link: %', x; end if;
  perform public.visto_por_token(pg_temp.g('token'));
  perform public.responder_por_token(pg_temp.g('token'), true);
  begin perform public.proposta_por_token(pg_temp.g('token'), '{"total":61500,"pdfPath":"x/y.pdf"}'); raise exception 'FALHOU: pdf fora da pasta';
  exception when others then if sqlerrm not like 'O PDF%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  if public.proposta_por_token(pg_temp.g('token'), jsonb_build_object('total', 61500, 'por', 'Bob', 'pdfPath', pg_temp.g('B') || '/' || pg_temp.g('co') || '/propostas/' || pg_temp.g('cvBay') || '/rev-1.pdf')) <> 1 then raise exception 'FALHOU: proposta pelo link'; end if;
  perform public.escrever_por_token(pg_temp.g('token'), 'Tem visita à obra?', 'Bob');
  x := public.convite_por_token(pg_temp.g('token'));
  if x -> 'convite' ->> 'situacao' <> 'proposta' or x -> 'convite' -> 'propostas' -> 0 ->> 'por' <> 'Bob' then raise exception 'FALHOU: link depois da proposta: %', x -> 'convite'; end if;
  -- só a própria conversa: a pergunta da Ana ainda não é pública
  if (select count(*) from jsonb_array_elements(x -> 'mensagens')) <> 1 then raise exception 'FALHOU: Bayside vê a pergunta da Ana'; end if;
end $$;

-- ---------- Tom: o canal, o adendo, a prorrogação, a comparação ----------
select pg_temp.como('00000000-0000-4000-8000-0000000008b1', 'kb-teste8-tom@example.com');
do $$
declare v_perg uuid; x jsonb;
begin
  if (select count(*) from public.concorrencia_propostas where empresa_id = pg_temp.u('B')) <> 3 then raise exception 'FALHOU: Tom vê 3 propostas'; end if;
  if (select string_agg(situacao, ',' order by nome) from public.concorrencia_convites where concorrencia_id = pg_temp.u('co')) <> 'proposta,proposta,nao-vai' then raise exception 'FALHOU: situações dos convites'; end if;
  select id into v_perg from public.concorrencia_mensagens where concorrencia_id = pg_temp.u('co') and texto like 'O forro%';
  perform public.escrever_como_contratante(pg_temp.u('co'), null, v_perg, true, 'Sim, isolamento R-30.');
  if (select publica from public.concorrencia_mensagens where id = v_perg) is not true then raise exception 'FALHOU: pergunta respondida para todos não ficou pública'; end if;
  perform public.escrever_como_contratante(pg_temp.u('co'), pg_temp.u('cvA'), null, false, 'Só para você: mande a rev. 3 com o forro.');
  perform public.adendo(pg_temp.u('co'), 'Adendo nº 1: nova folha A-102', jsonb_build_object('nome', 'A-102', 'arquivo_path', pg_temp.g('B') || '/' || pg_temp.g('co') || '/desenhos/a102.pdf'));
  if (select count(*) from public.concorrencia_desenhos where concorrencia_id = pg_temp.u('co')) <> 2 then raise exception 'FALHOU: desenho do adendo'; end if;
  begin perform public.prorrogar_concorrencia(pg_temp.u('co'), now() + interval '1 day'); raise exception 'FALHOU: prorrogou para antes';
  exception when others then if sqlerrm not like 'O novo prazo%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  perform public.prorrogar_concorrencia(pg_temp.u('co'), now() + interval '9 days', 'Adendo');
  if (select string_agg(acao, ',' order by em) from public.concorrencia_historico where concorrencia_id = pg_temp.u('co')) <> 'enviada,adendo,prorrogada' then raise exception 'FALHOU: histórico'; end if;
  -- fechar com quem não mandou proposta
  begin perform public.fechar_concorrencia(pg_temp.u('co'), pg_temp.u('cvC')); raise exception 'FALHOU: fechou com quem não cotou';
  exception when others then if sqlerrm not like 'Escolha uma prestadora%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
end $$;
reset role;

-- Eva vê a pergunta pública sem o nome, a resposta e o adendo; não vê a mensagem só para a Ana
select pg_temp.como('00000000-0000-4000-8000-0000000008c1', 'kb-teste8-eva@example.com');
do $$
declare x jsonb;
begin
  select r into x from public.concorrencias_recebidas() r;
  if (select count(*) from jsonb_array_elements(x -> 'mensagens')) <> 3 then raise exception 'FALHOU: Eva vê % mensagens', (select count(*) from jsonb_array_elements(x -> 'mensagens')); end if;
  if not exists (select 1 from jsonb_array_elements(x -> 'mensagens') m where m ->> 'autor' = 'Pergunta de um convidado' and m ->> 'texto' like 'O forro%') then raise exception 'FALHOU: pergunta pública sem o nome'; end if;
  if exists (select 1 from jsonb_array_elements(x -> 'mensagens') m where m ->> 'texto' like 'Só para você%') then raise exception 'FALHOU: Eva vê a mensagem só para a Ana'; end if;
  if (select string_agg(h ->> 'acao', ',') from jsonb_array_elements(x -> 'historico') h) <> 'adendo,prorrogada' then raise exception 'FALHOU: histórico da convidada'; end if;
end $$;
reset role;

-- ---------- Tom fecha com a Ana ----------
select pg_temp.como('00000000-0000-4000-8000-0000000008b1', 'kb-teste8-tom@example.com');
do $$
declare r jsonb;
begin
  r := public.fechar_concorrencia(pg_temp.u('co'), pg_temp.u('cvA'), 'Melhor prazo');
  if r ? 'pendente' then raise exception 'FALHOU: sem concorrência de cima não há aprovação'; end if;
  if (select situacao || '/' || (fechamento ->> 'rev') || '/' || (fechamento ->> 'valor') from public.concorrencias where id = pg_temp.u('co')) <> 'fechada/2/184400.00' then raise exception 'FALHOU: fechamento'; end if;
  if (select string_agg(situacao, ',' order by nome) from public.concorrencia_convites where concorrencia_id = pg_temp.u('co')) <> 'nao-escolhida,vencedora,nao-vai' then raise exception 'FALHOU: situações depois do fechamento'; end if;
  perform pg_temp.limpa();
  begin perform public.prorrogar_concorrencia(pg_temp.u('co'), now() + interval '20 days'); raise exception 'FALHOU: prorrogou fechada';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.adendo(pg_temp.u('co'), 'x'); raise exception 'FALHOU: adendo em fechada';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- o canal continua só com a vencedora
  perform public.escrever_como_contratante(pg_temp.u('co'), pg_temp.u('cvA'), null, false, 'Bem-vindos à obra.');
  begin perform public.escrever_como_contratante(pg_temp.u('co'), pg_temp.u('cvBay'), null, false, 'x'); raise exception 'FALHOU: escreveu para a não escolhida';
  exception when others then if sqlerrm not like 'A conversa continua%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
end $$;
reset role;
-- a Bayside vê que fechou, sem saber com quem nem por quanto
select pg_temp.ninguem();
do $$
declare x jsonb := public.convite_por_token(pg_temp.g('token'));
begin
  if x ->> 'situacao' <> 'fechada' or (x -> 'fechamento' ->> 'minha')::boolean or x -> 'fechamento' ? 'valor' or x -> 'convite' ->> 'situacao' <> 'nao-escolhida' then raise exception 'FALHOU: visão da não escolhida: %', x; end if;
  begin perform public.escrever_por_token(pg_temp.g('token'), 'x'); raise exception 'FALHOU: não escolhida escreveu';
  exception when others then if sqlerrm not like 'A conversa continua%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
end $$;

-- ---------- Ana venceu: o projeto é Ganha e a obra nasce ligada (CO-14) ----------
select pg_temp.como('00000000-0000-4000-8000-0000000008a1', 'kb-teste8-ana@example.com');
do $$
declare x jsonb; v_obra uuid;
begin
  if (select situacao || '/' || (concorrencia -> 'vinculo' ->> 'obraId') from public.projetos where id = pg_temp.u('pjA')) <> 'ganha/' || pg_temp.g('obB') then raise exception 'FALHOU: projeto ganho com o vínculo'; end if;
  select r into x from public.concorrencias_recebidas() r;
  if not (x -> 'fechamento' ->> 'minha')::boolean or x -> 'convite' ->> 'situacao' <> 'vencedora' then raise exception 'FALHOU: visão da vencedora'; end if;
  perform public.escrever_como_convidada(pg_temp.u('cvA'), 'Começamos segunda.');
  v_obra := public.criar_obra_da_concorrencia(pg_temp.u('cvA'), jsonb_build_object('nome', 'Atlântico · framing', 'contratante_id', (select id from public.contatos where nome = 'Construtora B'), 'municipio', 'Nashua', 'estado', 'NH', 'lat', 42.76, 'lon', -71.46, 'inicio', '2026-11-01', 'prazo', '2027-06-30', 'responsavel_id', (select id from public.membros where user_id = auth.uid())));
  insert into pg_temp.guarda values ('obA', v_obra::text);
  if (select vinculo_empresa_id::text || '/' || vinculo_obra_id::text || '/' || concorrencia_id::text || '/' || projeto_id::text from public.obras where id = v_obra) <> pg_temp.g('B') || '/' || pg_temp.g('obB') || '/' || pg_temp.g('co') || '/' || pg_temp.g('pjA') then raise exception 'FALHOU: obra sem o vínculo'; end if;
  if (select obra_id from public.projetos where id = pg_temp.u('pjA')) <> v_obra then raise exception 'FALHOU: projeto sem a obra'; end if;
  begin perform public.criar_obra_da_concorrencia(pg_temp.u('cvA'), '{"nome":"De novo"}'); raise exception 'FALHOU: criou a obra duas vezes';
  exception when others then if sqlerrm not like 'A obra desta concorrência já existe%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  -- o vínculo não se grava direto
  begin update public.obras set vinculo_obra_id = null where id = v_obra; raise exception 'FALHOU: mexeu no vínculo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008c1', 'kb-teste8-eva@example.com');
do $$ begin
  begin perform public.criar_obra_da_concorrencia(pg_temp.u('cvA'), '{"nome":"x"}'); raise exception 'FALHOU: Eva criou a obra da Ana';
  exception when others then if sqlerrm not like 'Esta empresa não venceu%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
end $$;
reset role;

-- ---------- Quarteirização (CO-23): a Ana passa o drywall à C; a B pediu aprovação ----------
select pg_temp.como('00000000-0000-4000-8000-0000000008a1', 'kb-teste8-ana@example.com');
do $$
declare v_id uuid; r jsonb;
begin
  insert into public.contatos (nome, papeis, email, conta_empresa_id) values ('Prestadora C', array['prestadora'], 'c@example.com', pg_temp.u('C'));
  insert into public.concorrencias (obra_id, servico, etapas, incluso, prazo) values (pg_temp.u('obA'), 'Drywall', array['09 21 16'], array['Drywall das paredes'], now() + interval '3 days') returning id into v_id;
  insert into pg_temp.guarda values ('coA', v_id::text);
  if (select pai_id from public.concorrencias where id = v_id) <> pg_temp.u('co') then raise exception 'FALHOU: concorrência de cima'; end if;
  insert into public.concorrencia_convites (concorrencia_id, contato_id) values (v_id, (select id from public.contatos where nome = 'Prestadora C' and empresa_id = pg_temp.u('A')));
  insert into pg_temp.guarda values ('cvC2', (select id::text from public.concorrencia_convites where concorrencia_id = v_id));
  r := public.enviar_concorrencia(v_id);
  if jsonb_array_length(r -> 'links') <> 0 then raise exception 'FALHOU: link para quem tem conta'; end if;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008c1', 'kb-teste8-eva@example.com');
select public.enviar_proposta_concorrencia(pg_temp.u('cvC2'), '{"porEtapa":{"09 21 16":42000}}');
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008a1', 'kb-teste8-ana@example.com');
do $$
declare r jsonb;
begin
  r := public.fechar_concorrencia(pg_temp.u('coA'), pg_temp.u('cvC2'));
  if not (r ->> 'pendente')::boolean then raise exception 'FALHOU: devia esperar a aprovação da B'; end if;
  if (select situacao || '/' || (aprovacao ->> 'situacao') from public.concorrencias where id = pg_temp.u('coA')) <> 'aberta/pendente' then raise exception 'FALHOU: pendente'; end if;
  if (select count(*) from public.pedidos_de_quarteirizacao()) <> 0 then raise exception 'FALHOU: a Ana não decide o próprio pedido'; end if;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008c1', 'kb-teste8-eva@example.com');
do $$ begin if (select count(*) from public.pedidos_de_quarteirizacao()) <> 0 then raise exception 'FALHOU: a C vê pedidos'; end if; end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008b1', 'kb-teste8-tom@example.com');
do $$
declare x jsonb;
begin
  select p into x from public.pedidos_de_quarteirizacao() p;
  if x is null or x ->> 'escolhida' <> 'Prestadora C' or x ->> 'contratante' <> 'Prestadora Teste A' or x ? 'valor' or x ? 'total' then raise exception 'FALHOU: pedido para a B: %', x; end if;
  begin perform public.decidir_quarteirizacao(pg_temp.u('co'), true); raise exception 'FALHOU: decidiu a própria';
  exception when others then if sqlerrm not like 'Pedido não encontrado%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  perform public.decidir_quarteirizacao(pg_temp.u('coA'), true, 'Ok');
  if (select count(*) from public.concorrencias where empresa_id = pg_temp.u('B')) <> 1 then raise exception 'FALHOU: a B continua vendo só a dela'; end if;
  if (select count(*) from public.auditoria where empresa_id = pg_temp.u('B') and acao = 'quarteirizacao-aprovada') <> 1 then raise exception 'FALHOU: auditoria da decisão'; end if;
end $$;
reset role;
do $$ begin
  if (select situacao || '/' || (fechamento ->> 'porNome') from public.concorrencias where id = pg_temp.u('coA')) <> 'fechada/Ana Teste' then raise exception 'FALHOU: fechamento depois da aprovação'; end if;
  if (select situacao from public.concorrencia_convites where id = pg_temp.u('cvC2')) <> 'vencedora' then raise exception 'FALHOU: C vencedora'; end if;
end $$;

-- ---------- CO-07, segunda metade: a Bayside cria a conta com o e-mail do link ----------
select pg_temp.como('00000000-0000-4000-8000-0000000008d1', 'kb-teste8-bay@example.com');
insert into pg_temp.guarda values ('D', public.criar_empresa('{"nome":"Bayside Teste D","atuacao":"prestadora"}')::text);
do $$
declare x jsonb;
begin
  select r into x from public.concorrencias_recebidas() r;
  if x is null or x -> 'convite' ->> 'situacao' <> 'nao-escolhida' or jsonb_array_length(x -> 'convite' -> 'propostas') <> 1 then raise exception 'FALHOU: a conta nova não trouxe o convite: %', x; end if;
end $$;
reset role;
do $$ begin
  if (select convidada_id from public.concorrencia_convites where id = pg_temp.u('cvBay')) <> pg_temp.u('D') then raise exception 'FALHOU: convite ligado à conta'; end if;
  if (select conta_empresa_id from public.contatos where nome = 'Bayside Drywall' and empresa_id = pg_temp.u('B')) <> pg_temp.u('D') then raise exception 'FALHOU: contato da B ligado à conta'; end if;
end $$;

-- ---------- Cancelar ----------
select pg_temp.como('00000000-0000-4000-8000-0000000008b1', 'kb-teste8-tom@example.com');
do $$
declare v_id uuid;
begin
  insert into public.concorrencias (obra_id, servico, etapas, incluso, prazo) values (pg_temp.u('obB'), 'Siding', array['07 46 00'], array['Siding'], now() + interval '2 days') returning id into v_id;
  insert into public.concorrencia_convites (concorrencia_id, contato_id) values (v_id, (select id from public.contatos where nome = 'Prestadora A' and empresa_id = pg_temp.u('B')));
  perform public.enviar_concorrencia(v_id);
  begin perform public.cancelar_concorrencia(v_id, '  '); raise exception 'FALHOU: cancelou sem motivo';
  exception when others then if sqlerrm not like 'Diga o motivo%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  perform public.cancelar_concorrencia(v_id, 'Mudou o projeto');
  if (select situacao from public.concorrencias where id = v_id) <> 'cancelada' or (select situacao from public.concorrencia_convites where concorrencia_id = v_id) <> 'cancelado' then raise exception 'FALHOU: cancelada'; end if;
  insert into pg_temp.guarda values ('coX', v_id::text);
  -- rascunho cancelado sai de vez
  insert into public.concorrencias (obra_id, servico) values (pg_temp.u('obB'), 'Rascunho') returning id into v_id;
  perform public.cancelar_concorrencia(v_id, 'Desisti');
  if exists (select 1 from public.concorrencias where id = v_id) then raise exception 'FALHOU: rascunho ficou'; end if;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000008a1', 'kb-teste8-ana@example.com');
do $$ begin
  if (select r ->> 'situacao' from public.concorrencias_recebidas(pg_temp.u('coX')) r) <> 'cancelada' then raise exception 'FALHOU: Ana vê cancelada'; end if;
  begin perform public.escrever_como_convidada((select (r -> 'convite' ->> 'id')::uuid from public.concorrencias_recebidas(pg_temp.u('coX')) r), 'x'); raise exception 'FALHOU: escreveu em cancelada';
  exception when others then if sqlerrm not like 'Esta concorrência foi cancelada%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
end $$;
reset role;

-- ---------- Excluir as empresas (cascata, como a limpeza dos testes do app) ----------
delete from public.empresas where id = pg_temp.u('B');
do $$ begin
  if (select count(*) from public.concorrencias where empresa_id = pg_temp.u('B')) + (select count(*) from public.concorrencia_convites where empresa_id = pg_temp.u('B')) <> 0 then raise exception 'FALHOU: sobrou concorrência da B'; end if;
  if (select vinculo_empresa_id from public.obras where id = pg_temp.u('obA')) is not null then raise exception 'FALHOU: vínculo da obra da A não zerou'; end if;
  if (select pai_id from public.concorrencias where id = pg_temp.u('coA')) is not null then raise exception 'FALHOU: concorrência de cima não zerou'; end if;
end $$;
delete from public.empresas where id in (pg_temp.u('C'), pg_temp.u('D'));
do $$ begin
  if (select convidada_id from public.concorrencia_convites where id = pg_temp.u('cvC2')) is not null then raise exception 'FALHOU: convidada excluída não zerou'; end if;
end $$;
delete from public.empresas where id = pg_temp.u('A');
do $$ begin
  if (select count(*) from public.concorrencias where empresa_id in (pg_temp.u('A'), pg_temp.u('B'), pg_temp.u('C'), pg_temp.u('D'))) <> 0 then raise exception 'FALHOU: sobrou concorrência'; end if;
end $$;

select 'fatia 7: todas as verificações passaram' as resultado;
rollback;
