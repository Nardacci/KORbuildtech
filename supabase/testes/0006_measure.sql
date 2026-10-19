-- KORbuild · teste da fatia 6 (supabase/migrations/20261017_0008_measure.sql): o Measure.
-- Tudo dentro de uma transação que termina em ROLLBACK: nada de teste fica no banco.
-- Cada verificação que falhar interrompe com 'FALHOU: …'. Se chegar ao fim, imprime 'fatia 6: todas as verificações passaram'.
-- Pessoas: Ana (Administradora da prestadora A: medir + catálogo), Rita (Gestora da A: mede, sem catálogo nem custos),
--          Tom (Administrador da construtora B: Measure só da própria empresa, 0015) e Eva (Administradora da C, de fora).

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000006a1', 'kb-teste6-ana@example.com', '{"nome":"Ana Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000006b1', 'kb-teste6-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000006c1', 'kb-teste6-rita@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000006e1', 'kb-teste6-eva@example.com', '{"nome":"Eva Teste"}', 'authenticated', 'authenticated');

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

-- ---------- Empresas e pessoas ----------
select pg_temp.como('00000000-0000-4000-8000-0000000006a1', 'kb-teste6-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Prestadora Teste A","atuacao":"prestadora"}')::text);
-- a Gestora tem measure.medir e crew.custos por padrão; aqui tiramos o crew.custos para testar quem não vê dinheiro
update public.perfis_acesso set permissoes = array_remove(permissoes, 'crew.custos') where chave = 'gestor';
insert into pg_temp.guarda values ('tr', public.convidar_usuario('kb-teste6-rita@example.com', 'Rita Teste', (select id from public.perfis_acesso where chave = 'gestor')));
insert into public.contatos (nome, papeis, email) values ('Construtora B', array['construtora'], 'b@example.com'), ('Madeireira', array['fornecedor'], 'm@example.com');
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000006c1', 'kb-teste6-rita@example.com');
select public.aceitar_convite(pg_temp.g('tr'));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000006b1', 'kb-teste6-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Construtora Teste B","atuacao":"construtora"}')::text);
insert into public.contatos (nome, papeis) values ('Dono', array['cliente']);
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000006e1', 'kb-teste6-eva@example.com');
insert into pg_temp.guarda values ('C', public.criar_empresa('{"nome":"Empresa Teste C","atuacao":"prestadora"}')::text);
reset role;

-- ---------- Ana: catálogo, preços, margens ----------
select pg_temp.como('00000000-0000-4000-8000-0000000006a1', 'kb-teste6-ana@example.com');
do $$
declare v_osb uuid; v_mo uuid; v_as uuid;
begin
  insert into public.itens (codigo, nome, categoria, unidade, etapa) values (' OSB-716 ', 'OSB 7/16"', 'material', 'chapa', 'Sheathing') returning id into v_osb;
  insert into public.itens (nome, categoria, unidade) values ('Carpinteiro', 'mao-de-obra', 'hora') returning id into v_mo;
  insert into pg_temp.guarda values ('osb', v_osb::text), ('mo', v_mo::text);
  if (select codigo from public.itens where id = v_osb) <> 'OSB-716' then raise exception 'FALHOU: código aparado'; end if;
  begin insert into public.itens (codigo, nome, categoria, unidade) values ('osb-716', 'Repetido', 'material', 'chapa'); raise exception 'FALHOU: código repetido';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- preços: só insert, autor carimbado pelo banco
  insert into public.item_precos (item_id, desde, valor, fonte, por_nome) values (v_osb, '2026-01-01', 16.90, 'Tabela', 'Impostor');
  if (select por_nome from public.item_precos where item_id = v_osb) <> 'Ana Teste' then raise exception 'FALHOU: autor do preço'; end if;
  insert into public.item_precos (item_id, desde, valor, fonte, fornecedor_id) values (v_osb, '2026-06-01', 18.50, 'Cotação', (select id from public.contatos where nome = 'Madeireira'));
  begin update public.item_precos set valor = 1; raise exception 'FALHOU: alterou preço';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from public.item_precos; if found then raise exception 'FALHOU: apagou preço'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.item_precos (item_id, desde, valor) values (v_osb, '2026-07-01', 0); raise exception 'FALHOU: preço zero';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- margens: motivo obrigatório, só insert
  begin insert into public.margens_versoes (desde, overhead_pct, lucro_pct, modo, motivo) values ('2026-01-01', 12, 10, 'markup', ' '); raise exception 'FALHOU: margem sem motivo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.margens_versoes (desde, overhead_pct, lucro_pct, modo, motivo) values ('2026-01-01', 12, 10, 'markup', 'Inicial');
  if not exists (select 1 from public.auditoria where tabela = 'margens_versoes') then raise exception 'FALHOU: margens sem auditoria'; end if;
  -- assembly: item da empresa e fórmula só com o alfabeto permitido
  begin insert into public.assemblies (nome, tipo, linhas) values ('Ruim', 'area', jsonb_build_array(jsonb_build_object('itemId', gen_random_uuid(), 'formula', 'area / 32'))); raise exception 'FALHOU: assembly com item de fora';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.assemblies (nome, tipo, linhas) values ('Ruim', 'area', jsonb_build_array(jsonb_build_object('itemId', v_osb, 'formula', 'area; drop table x'))); raise exception 'FALHOU: fórmula com caracteres fora do alfabeto';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.assemblies (nome, tipo, linhas) values ('Sheathing OSB', 'area', jsonb_build_array(jsonb_build_object('id', 'l1', 'itemId', v_osb, 'formula', 'area / 32', 'perda', 10, 'passo', 1),
    jsonb_build_object('id', 'l2', 'itemId', v_mo, 'formula', 'area / 200', 'perda', 0, 'passo', 0))) returning id into v_as;
  insert into pg_temp.guarda values ('as', v_as::text);
  -- item usado em assembly não sai; item sem assembly sai e leva os preços (o histórico fica na auditoria)
  begin delete from public.itens where id = v_osb; raise exception 'FALHOU: excluiu item usado em assembly';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; if sqlerrm not like '%usado em assembly%' then raise exception 'FALHOU: mensagem ao excluir item usado: %', sqlerrm; end if; end;
  insert into public.itens (nome, categoria, unidade) values ('Prego', 'material', 'caixa');
  insert into public.item_precos (item_id, desde, valor) values ((select id from public.itens where nome = 'Prego'), '2026-01-01', 9);
  delete from public.itens where nome = 'Prego';
  if exists (select 1 from public.itens where nome = 'Prego') or (select count(*) from public.item_precos) <> 2 then raise exception 'FALHOU: item sem assembly não saiu com os preços'; end if;
end $$;

-- ---------- Ana: projeto, folha, condição, typical ----------
do $$
declare v_pj uuid; v_fl uuid; v_fl2 uuid; v_cd uuid; v_versao int;
begin
  begin insert into public.projetos (nome, contratante_id, cidade, estado, tipo) values ('Sem contratante', null, 'Manchester', 'NH', 'residencial'); raise exception 'FALHOU: projeto sem contratante';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.projetos (nome, contratante_id, dono_id, cidade, estado, tipo)
  values ('Casa Modelo', (select id from public.contatos where nome = 'Construtora B'), (select id from public.contatos where nome = 'Construtora B'), 'Manchester', 'nh', 'residencial') returning id into v_pj;
  insert into pg_temp.guarda values ('pj', v_pj::text);
  if (select estado || coalesce(dono_id::text, '-') from public.projetos where id = v_pj) <> 'NH-' then raise exception 'FALHOU: estado em maiúsculas e dono igual ao contratante vira nulo'; end if;
  -- folha: a planta precisa estar na pasta da empresa e do projeto
  begin insert into public.folhas (projeto_id, nome, arquivo_path) values (v_pj, 'A-101', pg_temp.g('C') || '/x/y.pdf'); raise exception 'FALHOU: planta fora da pasta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.folhas (projeto_id, nome, arquivo_path, arquivo_nome, pagina) values (v_pj, 'A-101', pg_temp.g('A') || '/' || v_pj || '/arq1.pdf', 'casa.pdf', 1) returning id into v_fl;
  insert into public.folhas (projeto_id, nome, arquivo_path, arquivo_nome, pagina) values (v_pj, 'A-201', pg_temp.g('A') || '/' || v_pj || '/arq1.pdf', 'casa.pdf', 2) returning id into v_fl2;
  insert into pg_temp.guarda values ('fl', v_fl::text);
  update public.folhas set escala = '{"polPorPt": 0.6667, "origem": "lista"}' where id = v_fl;
  -- condição com medições dentro; a versão sobe; a versão velha é conflito
  insert into public.condicoes (projeto_id, nome, tipo, cor, folhas, medicoes) values (v_pj, ' Paredes externas ', 'linear', '#2563eb', array[v_fl], '[]') returning id into v_cd;
  insert into pg_temp.guarda values ('cd', v_cd::text);
  if (select nome || cor || versao from public.condicoes where id = v_cd) <> 'Paredes externas#2563EB1' then raise exception 'FALHOU: condição nova'; end if;
  update public.condicoes set medicoes = '[{"id":"m1","folhaId":"x","pontos":[[0,0],[100,0]],"desconto":false}]', versao = 1 where id = v_cd;
  if (select versao from public.condicoes where id = v_cd) <> 2 then raise exception 'FALHOU: a versão não subiu'; end if;
  begin update public.condicoes set medicoes = '[]', versao = 1 where id = v_cd; raise exception 'FALHOU: gravou com a versão velha';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; if sqlerrm not like 'KB_CONFLITO%' then raise exception 'FALHOU: conflito com a mensagem errada: %', sqlerrm; end if; end;
  begin update public.condicoes set tipo = 'area', versao = 2 where id = v_cd; raise exception 'FALHOU: trocou o tipo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- typicals: regiões não se sobrepõem; folha inteira não convive
  insert into public.typicais (projeto_id, folha_id, nome, regiao, ocorrencias) values (v_pj, v_fl, 'Apto A', '[0,0,100,100]', '[{"rotulo":"2º pav.","quantidade":4}]');
  if (select por_nome from public.typicais) <> '' then null; end if;
  begin insert into public.typicais (projeto_id, folha_id, nome, regiao, ocorrencias) values (v_pj, v_fl, 'Apto B', '[50,50,150,150]', '[{"rotulo":"3º pav.","quantidade":2}]'); raise exception 'FALHOU: typicals sobrepostos';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.typicais (projeto_id, folha_id, nome, regiao, ocorrencias) values (v_pj, v_fl, 'Folha', null, '[{"rotulo":"x","quantidade":2}]'); raise exception 'FALHOU: folha inteira com região na mesma folha';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.typicais (projeto_id, folha_id, nome, regiao, ocorrencias) values (v_pj, v_fl, 'Apto C', '[200,200,300,300]', '[{"rotulo":"","quantidade":1.5}]'); raise exception 'FALHOU: ocorrência inválida';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.typicais (projeto_id, folha_id, nome, regiao, ocorrencias) values (v_pj, v_fl, 'Apto C', '[200,200,300,300]', '[{"rotulo":"4º pav.","quantidade":3}]');
  insert into public.typicais (projeto_id, folha_id, nome, regiao, ocorrencias) values (v_pj, v_fl2, 'Fachada inteira', null, '[{"rotulo":"Bloco B","quantidade":3}]');
  if (select count(*) from public.typicais where projeto_id = v_pj) <> 3 then raise exception 'FALHOU: typicals criados'; end if;
end $$;

-- ---------- Ana emite a proposta ----------
do $$
declare v jsonb; v_pj uuid := pg_temp.g('pj')::uuid; r jsonb;
begin
  r := jsonb_build_object('contratante', jsonb_build_object('nome', 'Construtora B'), 'linhas', jsonb_build_array(jsonb_build_object('titulo', 'Sheathing', 'valor', 832.83)),
                          'extras', jsonb_build_array(jsonb_build_object('descricao', 'Mobilização', 'valor', 500)), 'total', 1332.83, 'custo', 676, 'margens', 'overhead 12% · lucro 10%');
  begin perform public.emitir_proposta(v_pj, r || '{"total": 999}'); raise exception 'FALHOU: total que não bate';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.emitir_proposta(v_pj, r || '{"linhas": [{"titulo":"x","valor":0}]}'); raise exception 'FALHOU: linha sem preço';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.emitir_proposta(v_pj, r - 'contratante'); raise exception 'FALHOU: sem contratante';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  v := public.emitir_proposta(v_pj, r);
  if v ->> 'numero' !~ '^P-\d{4}-001$' then raise exception 'FALHOU: número da primeira proposta: %', v; end if;
  if (select situacao from public.projetos where id = v_pj) <> 'enviada' then raise exception 'FALHOU: situação depois de emitir'; end if;
  v := public.emitir_proposta(v_pj, r);
  if v ->> 'numero' !~ '002$' then raise exception 'FALHOU: sequência: %', v; end if;
  if (select retrato ->> 'numero' from public.propostas_emitidas where numero = v ->> 'numero') <> (v ->> 'numero') then raise exception 'FALHOU: o retrato leva o número'; end if;
  begin update public.propostas_emitidas set total = 1; raise exception 'FALHOU: alterou proposta emitida';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from public.propostas_emitidas; if found then raise exception 'FALHOU: apagou proposta emitida'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- excluir o projeto leva folhas, condições e typicals; as propostas ficam
  delete from public.projetos where id = v_pj;
  if exists (select 1 from public.folhas where projeto_id = v_pj) or exists (select 1 from public.condicoes where projeto_id = v_pj) or exists (select 1 from public.typicais where projeto_id = v_pj) then
    raise exception 'FALHOU: excluir o projeto não levou folhas, condições e typicals'; end if;
  if (select count(*) from public.propostas_emitidas where projeto_id = v_pj) <> 2 then raise exception 'FALHOU: as propostas sumiram com o projeto'; end if;
end $$;
reset role;

-- ---------- Rita (Gestora: mede, sem catálogo nem custos) ----------
select pg_temp.como('00000000-0000-4000-8000-0000000006c1', 'kb-teste6-rita@example.com');
do $$
declare v_pj uuid;
begin
  if (select count(*) from public.itens) <> 2 or (select count(*) from public.assemblies) <> 1 then raise exception 'FALHOU: a gestora não lê o catálogo'; end if;
  if exists (select 1 from public.item_precos) or exists (select 1 from public.margens_versoes) then raise exception 'FALHOU: a gestora viu dinheiro (preços/margens)'; end if;
  begin insert into public.itens (nome, categoria, unidade) values ('Novo', 'material', 'un'); raise exception 'FALHOU: a gestora mexeu no catálogo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.margens_versoes (desde, overhead_pct, lucro_pct, modo, motivo) values ('2026-02-01', 1, 1, 'markup', 'x'); raise exception 'FALHOU: a gestora gravou margens';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- mede: projeto próprio
  insert into public.projetos (nome, contratante_id, cidade, estado, tipo) values ('Galpão', (select id from public.contatos where nome = 'Construtora B'), 'Nashua', 'NH', 'comercial') returning id into v_pj;
  insert into public.condicoes (projeto_id, nome, tipo) values (v_pj, 'Piso', 'area');
  if (select count(*) from public.propostas_emitidas) <> 2 then raise exception 'FALHOU: a gestora não lê as propostas emitidas'; end if;
  -- planta no Storage: na pasta da empresa pode; na de outra, não
  insert into storage.objects (bucket_id, name) values ('plantas', pg_temp.g('A') || '/' || v_pj || '/x.pdf');
  begin insert into storage.objects (bucket_id, name) values ('plantas', pg_temp.g('C') || '/' || v_pj || '/x.pdf'); raise exception 'FALHOU: gravou planta na pasta de outra empresa';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- ---------- Tom (construtora): tem o Measure (0015), mas só o da própria empresa ----------
select pg_temp.como('00000000-0000-4000-8000-0000000006b1', 'kb-teste6-tom@example.com');
do $$ begin
  if exists (select 1 from public.projetos) or exists (select 1 from public.itens) or exists (select 1 from public.propostas_emitidas) then raise exception 'FALHOU: a construtora leu o Measure de outra empresa'; end if;
  insert into public.contatos (nome, papeis) values ('Dono do projeto da B', array['cliente']);
  insert into public.projetos (nome, contratante_id, cidade, estado, tipo) values ('Projeto da construtora', (select id from public.contatos where nome = 'Dono do projeto da B'), 'Nashua', 'NH', 'comercial');
  if (select count(*) from public.projetos) <> 1 then raise exception 'FALHOU: a construtora não grava o próprio projeto'; end if;
  begin insert into storage.objects (bucket_id, name) values ('plantas', pg_temp.g('C') || '/x/y.pdf'); raise exception 'FALHOU: a construtora gravou planta de outra empresa';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- ---------- Eva (de fora) e anônimo ----------
select pg_temp.como('00000000-0000-4000-8000-0000000006e1', 'kb-teste6-eva@example.com');
do $$ begin
  if exists (select 1 from public.projetos) or exists (select 1 from public.condicoes) or exists (select 1 from public.itens) or exists (select 1 from public.item_precos)
     or exists (select 1 from public.propostas_emitidas) or exists (select 1 from storage.objects where bucket_id = 'plantas') then raise exception 'FALHOU: outra empresa leu o Measure'; end if;
  begin perform public.emitir_proposta((select id from public.projetos limit 1), '{}'); raise exception 'FALHOU: outra empresa emitiu';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.projetos; raise exception 'FALHOU: anônimo leu projetos';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.emitir_proposta(gen_random_uuid(), '{}'); raise exception 'FALHOU: anônimo chamou emitir_proposta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- Excluir a empresa leva tudo junto (cascata), sem esbarrar nas travas. (Confere só a empresa da cena: o banco de verdade tem a massa de demonstração.)
delete from public.empresas where id = pg_temp.g('A')::uuid;
do $$ begin
  if exists (select 1 from public.projetos where empresa_id = pg_temp.g('A')::uuid) or exists (select 1 from public.itens where empresa_id = pg_temp.g('A')::uuid) or exists (select 1 from public.item_precos where empresa_id = pg_temp.g('A')::uuid) or exists (select 1 from public.margens_versoes where empresa_id = pg_temp.g('A')::uuid)
     or exists (select 1 from public.propostas_emitidas where empresa_id = pg_temp.g('A')::uuid) or exists (select 1 from public.assemblies where empresa_id = pg_temp.g('A')::uuid) then
    raise exception 'FALHOU: sobrou Measure da empresa excluída';
  end if;
end $$;

select 'fatia 6: todas as verificações passaram' as resultado;
rollback;
