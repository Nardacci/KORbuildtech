-- KORbuild · teste da fatia 2 (supabase/migrations/20261013_0004_settings.sql).
-- Tudo dentro de uma transação que termina em ROLLBACK: nada de teste fica no banco.
-- Cada verificação que falhar interrompe com 'FALHOU: …'. Se chegar ao fim, imprime 'fatia 2: todas as verificações passaram'.
-- Pessoas: Ana (Administradora da prestadora A), Gil (Gestor da A), José (Trabalhador da A), Tom (Administrador da B).

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000002a1', 'kb-teste2-ana@example.com', '{"nome":"Ana Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000002b1', 'kb-teste2-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000002c1', 'kb-teste2-jose@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000002d1', 'kb-teste2-gil@example.com', '{}', 'authenticated', 'authenticated');

create function pg_temp.como(p_id uuid, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;
grant execute on function pg_temp.como(uuid, text) to authenticated;
create table pg_temp.guarda (chave text primary key, valor text);
grant all on pg_temp.guarda to authenticated;
create function pg_temp.g(p text) returns uuid language sql as $$ select valor::uuid from pg_temp.guarda where chave = p $$;
grant execute on function pg_temp.g(text) to authenticated;

-- Empresas: A (prestadora, da Ana) e B (do Tom); Ana convida José (Trabalhador) e Gil (Gestor)
select pg_temp.como('00000000-0000-4000-8000-0000000002a1', 'kb-teste2-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Prestadora Teste A","atuacao":"prestadora"}')::text);
insert into pg_temp.guarda values ('tj', public.convidar_usuario('kb-teste2-jose@example.com', 'José Teste', (select id from public.perfis_acesso where chave = 'trabalhador')));
insert into pg_temp.guarda values ('tg', public.convidar_usuario('kb-teste2-gil@example.com', 'Gil Teste', (select id from public.perfis_acesso where chave = 'gestor')));
insert into pg_temp.guarda values ('ana', (select id::text from public.membros where user_id = auth.uid()));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000002c1', 'kb-teste2-jose@example.com');
select public.aceitar_convite((select valor from pg_temp.guarda where chave = 'tj'));
insert into pg_temp.guarda values ('jose', (select id::text from public.membros where user_id = auth.uid()));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000002d1', 'kb-teste2-gil@example.com');
select public.aceitar_convite((select valor from pg_temp.guarda where chave = 'tg'));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000002b1', 'kb-teste2-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Construtora Teste B","atuacao":"construtora"}')::text);

-- ---------- Ana cadastra (Administradora) ----------
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000002a1', 'kb-teste2-ana@example.com');
do $$
declare v_func uuid; v_seg date := public.segunda_de(public.hoje_da_empresa(public.minha_empresa()));
begin
  -- Contatos
  insert into public.contatos (nome, papeis, etapas) values (' Granite Builders ', array['construtora'], array['Framing']);
  if (select etapas from public.contatos where nome = 'Granite Builders') <> '{}' then raise exception 'FALHOU: etapas só ficam no fornecedor'; end if;
  begin insert into public.contatos (nome, papeis) values ('granite builders', array['cliente']); raise exception 'FALHOU: contato com nome repetido';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.contatos (nome, papeis) values ('Sem papel', '{}'); raise exception 'FALHOU: contato sem papel';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.contatos (nome, papeis, etapas) values ('Lumber Co', array['fornecedor'], array['Framing']);
  insert into pg_temp.guarda values ('ct', (select id::text from public.contatos where nome = 'Granite Builders'));

  -- Funcionários: o cadastro já leva o valor hora da admissão
  v_func := public.criar_funcionario('{"nome":"Carlos Teste","funcao":"Carpenter","admissao":"2026-01-05","certificacoes":[{"nome":"OSHA 10","validade":"2027-01-01"},{"nome":" "}]}', 32.5);
  insert into pg_temp.guarda values ('f1', v_func::text);
  if (select count(*) from public.funcionario_valores where funcionario_id = v_func and valor = 32.5 and motivo = 'Admissão' and desde = '2026-01-05') <> 1 then
    raise exception 'FALHOU: o valor hora da admissão não foi gravado'; end if;
  if (select por from public.funcionario_valores where funcionario_id = v_func) <> auth.uid() then raise exception 'FALHOU: o autor do valor não é quem gravou'; end if;
  if jsonb_array_length((select certificacoes from public.funcionarios where id = v_func)) <> 1 then raise exception 'FALHOU: certificação sem nome ficou'; end if;
  perform public.criar_funcionario('{"nome":"Dan Autônomo","funcao":"Laborer","admissao":"2026-02-02","classificacao":"1099","flsa":"nao-isento"}', 28);
  if (select flsa from public.funcionarios where nome = 'Dan Autônomo') <> 'isento' then raise exception 'FALHOU: 1099 tem que ser isento'; end if;
  begin perform public.criar_funcionario('{"nome":"Sem Valor","funcao":"Laborer","admissao":"2026-02-02"}', 0); raise exception 'FALHOU: funcionário sem valor hora';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin update public.funcionarios set situacao = 'desligado' where id = v_func; raise exception 'FALHOU: desligado sem data';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- Valor hora: nova versão entra; a antiga não muda nem some (BD-04)
  insert into public.funcionario_valores (funcionario_id, desde, valor, motivo) values (v_func, v_seg + 7, 34, 'Reajuste');
  begin insert into public.funcionario_valores (funcionario_id, desde, valor, motivo) values (v_func, v_seg + 14, 35, ' '); raise exception 'FALHOU: valor sem motivo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin update public.funcionario_valores set valor = 99 where funcionario_id = v_func; raise exception 'FALHOU: alterou um valor hora gravado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from public.funcionario_valores where funcionario_id = v_func; raise exception 'FALHOU: apagou um valor hora gravado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- Encargos e regras: não valem para o passado
  begin insert into public.encargos_versoes (desde, itens, motivo) values (v_seg - 7, '[{"nome":"FICA","pct":7.65}]', 'Teste'); raise exception 'FALHOU: encargos no passado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.encargos_versoes (desde, itens, motivo) values (v_seg, '[{"nome":"FICA","pct":120}]', 'Teste'); raise exception 'FALHOU: encargo acima de 100%%';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.encargos_versoes (desde, itens, motivo) values (v_seg, '[{"nome":"FICA","pct":7.65},{"nome":"Workers comp","pct":14}]', 'Tabela 2026');
  insert into public.regras_jornada_versoes (desde, nome, semanal, diaria, intervalo, motivo)
    values (v_seg + 9, 'NH', '{"limite":40,"fator":1.5}', '{"ativo":false,"limite":8,"fator":1.5,"dobra":12,"fatorDobra":2}', '{"minimo":30,"apos":5}', 'Regra inicial');
  if (select desde from public.regras_jornada_versoes) <> v_seg + 7 then raise exception 'FALHOU: a regra não começou na segunda-feira'; end if;
  begin insert into public.regras_jornada_versoes (desde, semanal, diaria, intervalo, motivo)
    values (v_seg, '{"limite":40,"fator":1.5}', '{"ativo":true,"limite":8,"fator":1.5,"dobra":8,"fatorDobra":2}', '{"minimo":30,"apos":5}', 'x'); raise exception 'FALHOU: dobra menor que o limite diário';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin update public.encargos_versoes set motivo = 'outro'; raise exception 'FALHOU: alterou uma versão de encargos';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- Obras: prestadora precisa de quem preenche o diário; dono igual ao contratante vira vazio
  begin insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo)
    values ('Obra sem responsável', pg_temp.g('ct'), 'Manchester', 'NH', 42.99, -71.46, '2026-10-01', '2026-12-01'); raise exception 'FALHOU: obra de prestadora sem responsável';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo, responsavel_id)
    values ('Prazo errado', pg_temp.g('ct'), 'Manchester', 'NH', 42.99, -71.46, '2026-10-01', '2026-09-01', pg_temp.g('ana')); raise exception 'FALHOU: prazo antes do início';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.obras (nome, contratante_id, dono_id, municipio, estado, lat, lon, inicio, prazo, responsavel_id, dias_trabalho)
    values ('Atlantic Ave', pg_temp.g('ct'), pg_temp.g('ct'), 'Manchester', 'NH', 42.99, -71.46, '2026-10-01', '2026-12-01', pg_temp.g('ana'), '{5,1,1,2}');
  insert into pg_temp.guarda values ('ob', (select id::text from public.obras where nome = 'Atlantic Ave'));
  if (select dono_id from public.obras where nome = 'Atlantic Ave') is not null then raise exception 'FALHOU: dono igual ao contratante ficou gravado'; end if;
  if (select dias_trabalho from public.obras where nome = 'Atlantic Ave') <> '{1,2,5}' then raise exception 'FALHOU: dias de trabalho sem ordem/repetidos'; end if;
  begin update public.obras set vinculo_empresa_id = pg_temp.g('B') where nome = 'Atlantic Ave'; raise exception 'FALHOU: o app gravou a ligação entre obras';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from public.obras where nome = 'Atlantic Ave'; raise exception 'FALHOU: apagou uma obra';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  update public.obras set situacao = 'paralisada' where nome = 'Atlantic Ave';
  if not found then raise exception 'FALHOU: Ana não alterou a situação da obra'; end if;
  begin delete from public.contatos where nome = 'Granite Builders'; raise exception 'FALHOU: apagou o contratante de uma obra';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;

  -- Alocação e modelos de etapas
  insert into public.alocacoes (obra_id, membro_id, papel) values (pg_temp.g('ob'), pg_temp.g('jose'), 'Laborer');
  insert into public.alocacoes (obra_id, funcionario_id) values (pg_temp.g('ob'), v_func);
  begin insert into public.modelos_cronograma (nome, etapas) values ('Errado', '[{"nome":"A","pct":50},{"nome":"B","pct":40}]'); raise exception 'FALHOU: modelo somando 90%%';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.modelos_cronograma (nome, etapas) values ('Casa', '[{"nome":"Framing","pct":60},{"nome":"Siding","pct":40}]');
end $$;

-- ---------- Gil (Gestor): cuida das obras e vê custos, mas não mexe em funcionários nem em regras ----------
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000002d1', 'kb-teste2-gil@example.com');
do $$ begin
  if (select count(*) from public.funcionario_valores) <> 3 then raise exception 'FALHOU: o Gestor (crew.custos) não vê os valores'; end if;
  if (select count(*) from public.encargos_versoes) <> 1 then raise exception 'FALHOU: o Gestor (crew.custos) não vê os encargos'; end if;
  update public.obras set situacao = 'andamento' where id = pg_temp.g('ob');
  if not found then raise exception 'FALHOU: o Gestor (settings.obras) não alterou a obra'; end if;
  begin perform public.criar_funcionario('{"nome":"Novo","funcao":"Laborer","admissao":"2026-02-02"}', 25); raise exception 'FALHOU: o Gestor cadastrou funcionário';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.encargos_versoes (desde, itens, motivo) values (current_date + 30, '[{"nome":"X","pct":1}]', 'x'); raise exception 'FALHOU: o Gestor mudou os encargos';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ---------- José (Trabalhador): lê os cadastros do dia a dia, não vê dinheiro, não altera nada; muda o próprio nome ----------
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000002c1', 'kb-teste2-jose@example.com');
do $$ begin
  if (select count(*) from public.funcionarios) <> 2 or (select count(*) from public.obras) <> 1 or (select count(*) from public.regras_jornada_versoes) <> 1
     or (select count(*) from public.contatos) <> 2 or (select count(*) from public.alocacoes) <> 2 or (select count(*) from public.modelos_cronograma) <> 1 then
    raise exception 'FALHOU: o Trabalhador não lê os cadastros da empresa'; end if;
  if exists (select 1 from public.funcionario_valores) or exists (select 1 from public.encargos_versoes) then raise exception 'FALHOU: o Trabalhador vê valores em dinheiro'; end if;
  begin insert into public.contatos (nome, papeis) values ('Do José', array['cliente']); raise exception 'FALHOU: o Trabalhador criou contato';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  update public.funcionarios set funcao = 'Boss' where true;
  if found then raise exception 'FALHOU: o Trabalhador alterou funcionário'; end if;
  update public.obras set situacao = 'concluida' where true;
  if found then raise exception 'FALHOU: o Trabalhador alterou a obra'; end if;
  perform public.atualizar_meu_perfil(' José Silva ', '603-555-0100');
  if (select nome from public.membros where user_id = auth.uid()) <> 'José Silva' then raise exception 'FALHOU: o próprio nome não mudou'; end if;
  begin perform public.atualizar_meu_perfil('J', ''); raise exception 'FALHOU: nome de uma letra';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ---------- Tom (outra empresa) não vê nem usa nada da A ----------
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000002b1', 'kb-teste2-tom@example.com');
do $$ begin
  if exists (select 1 from public.funcionarios) or exists (select 1 from public.funcionario_valores) or exists (select 1 from public.encargos_versoes)
     or exists (select 1 from public.regras_jornada_versoes) or exists (select 1 from public.contatos) or exists (select 1 from public.obras)
     or exists (select 1 from public.alocacoes) or exists (select 1 from public.modelos_cronograma) then
    raise exception 'FALHOU: Tom vê cadastros da empresa A'; end if;
  begin insert into public.contatos (empresa_id, nome, papeis) values (pg_temp.g('A'), 'Invasor', array['cliente']); raise exception 'FALHOU: Tom gravou na empresa A';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- obra da construtora B (sem responsável: a construtora só gerencia) apontando para o contato da A: recusada
  begin insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo)
    values ('Obra do Tom', pg_temp.g('ct'), 'Nashua', 'NH', 42.76, -71.46, '2026-10-01', '2026-12-01'); raise exception 'FALHOU: Tom usou o contato da empresa A';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.contatos (nome, papeis) values ('Cliente do Tom', array['cliente']);
  insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo)
    values ('Obra do Tom', (select id from public.contatos where nome = 'Cliente do Tom'), 'Nashua', 'NH', 42.76, -71.46, '2026-10-01', '2026-12-01');
  begin perform public.criar_funcionario(format('{"nome":"X","funcao":"Y","admissao":"2026-01-01"}')::jsonb, 20);
    -- a construtora pode ter funcionários; o que importa é não poder ligar à A
    insert into public.alocacoes (obra_id, funcionario_id) values ((select id from public.obras where nome = 'Obra do Tom'), pg_temp.g('f1'));
    raise exception 'FALHOU: Tom alocou um funcionário da empresa A';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ---------- Auditoria e exclusão da empresa inteira ----------
reset role;
do $$ begin
  if (select count(distinct tabela) from public.auditoria where empresa_id = pg_temp.g('A')
       and tabela in ('funcionarios','funcionario_valores','encargos_versoes','regras_jornada_versoes','contatos','obras','alocacoes','modelos_cronograma')) <> 8 then
    raise exception 'FALHOU: falta auditoria de algum cadastro'; end if;
  if (select quem from public.auditoria where empresa_id = pg_temp.g('A') and tabela = 'funcionario_valores' limit 1) <> '00000000-0000-4000-8000-0000000002a1' then
    raise exception 'FALHOU: a auditoria não guardou quem gravou o valor hora'; end if;
  delete from public.empresas where id = pg_temp.g('A');
  if exists (select 1 from public.funcionarios where empresa_id = pg_temp.g('A')) or exists (select 1 from public.obras where empresa_id = pg_temp.g('A')) then
    raise exception 'FALHOU: a exclusão da empresa não levou os cadastros'; end if;
end $$;

select 'fatia 2: todas as verificações passaram' as resultado;
rollback;
