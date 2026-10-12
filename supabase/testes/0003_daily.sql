-- KORbuild · teste da fatia 3 (supabase/migrations/20261014_0005_daily.sql): o Daily.
-- Tudo dentro de uma transação que termina em ROLLBACK: nada de teste fica no banco.
-- Cada verificação que falhar interrompe com 'FALHOU: …'. Se chegar ao fim, imprime 'fatia 3: todas as verificações passaram'.
-- Pessoas: Ana (Administradora da prestadora A), José (Encarregado da A), Luis (Trabalhador da A),
--          Tom (Administrador da construtora B, que contrata a A numa obra) e o cliente sem login (anon).

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000003a1', 'kb-teste3-ana@example.com', '{"nome":"Ana Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000003b1', 'kb-teste3-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000003c1', 'kb-teste3-jose@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000003d1', 'kb-teste3-luis@example.com', '{}', 'authenticated', 'authenticated');

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
-- um diário completo (clima, equipe, atividade), como o app manda
create function pg_temp.completo() returns jsonb language sql as $$
  select '{"clima":{"manha":{"tempo":"sol"},"tarde":{"tempo":"nublado"}},"equipe":[{"funcao":"Carpenter","presentes":3}],"atividades":[{"descricao":"Framing do 1º pavimento"}]}'::jsonb $$;
grant execute on function pg_temp.completo() to authenticated;

-- ---------- Empresas, pessoas e obras ----------
select pg_temp.como('00000000-0000-4000-8000-0000000003a1', 'kb-teste3-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Prestadora Teste A","atuacao":"prestadora"}')::text);
insert into pg_temp.guarda values ('tj', public.convidar_usuario('kb-teste3-jose@example.com', 'José Teste', (select id from public.perfis_acesso where chave = 'encarregado')));
insert into pg_temp.guarda values ('tl', public.convidar_usuario('kb-teste3-luis@example.com', 'Luis Teste', (select id from public.perfis_acesso where chave = 'trabalhador')));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000003c1', 'kb-teste3-jose@example.com');
select public.aceitar_convite(pg_temp.g('tj'));
insert into pg_temp.guarda values ('jose', (select id::text from public.membros where user_id = auth.uid()));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000003d1', 'kb-teste3-luis@example.com');
select public.aceitar_convite(pg_temp.g('tl'));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000003a1', 'kb-teste3-ana@example.com');
insert into public.contatos (nome, papeis) values ('Cliente Direto', array['cliente']), ('Construtora B', array['construtora']);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo, responsavel_id)
  values ('Obra própria', (select id from public.contatos where nome = 'Cliente Direto'), 'Manchester', 'NH', 42.99, -71.46, '2026-01-01', '2027-12-31', pg_temp.g('jose')::uuid),
         ('Obra da construtora', (select id from public.contatos where nome = 'Construtora B'), 'Nashua', 'NH', 42.76, -71.46, '2026-01-01', '2027-12-31', pg_temp.g('jose')::uuid);
insert into pg_temp.guarda values ('o1', (select id::text from public.obras where nome = 'Obra própria')),
                                  ('o2', (select id::text from public.obras where nome = 'Obra da construtora')),
                                  ('hoje', public.hoje_da_empresa(pg_temp.g('A')::uuid)::text);
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000003b1', 'kb-teste3-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Construtora Teste B","atuacao":"construtora"}')::text);
insert into public.contatos (nome, papeis) values ('Dono', array['cliente']);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo)
  values ('Obra B', (select id from public.contatos where nome = 'Dono'), 'Nashua', 'NH', 42.76, -71.46, '2026-01-01', '2027-12-31');
insert into pg_temp.guarda values ('ob', (select id::text from public.obras where nome = 'Obra B'));
-- a ligação entre as obras é gravada pelas funções das concorrências (fatia 7); aqui, direto como administrador do banco
reset role;
update public.obras set vinculo_empresa_id = pg_temp.g('B')::uuid, vinculo_obra_id = pg_temp.g('ob')::uuid where id = pg_temp.g('o2')::uuid;

-- ---------- José preenche (Encarregado, daily.preencher) ----------
select pg_temp.como('00000000-0000-4000-8000-0000000003c1', 'kb-teste3-jose@example.com');
do $$
declare v jsonb; v_id uuid := 'aaaaaaaa-0000-4000-8000-000000000001'; hoje date := pg_temp.g('hoje')::date; seg text;
begin
  v := public.salvar_rdo(jsonb_build_object('id', v_id, 'obra_id', pg_temp.g('o1'), 'data', hoje, 'versao', null, 'conteudo', '{"atividades":[]}'::jsonb,
         'historico', jsonb_build_array(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-00000000000a', 'em', now(), 'quem', 'José', 'acao', 'Começou o RDO'))));
  if (v ->> 'numero')::int <> 1 or (v ->> 'versao')::int <> 1 or v ->> 'status' <> 'rascunho' then raise exception 'FALHOU: diário novo (nº 1, versão 1, rascunho): %', v; end if;
  -- o aparelho manda de novo o mesmo histórico (sinal ruim): não duplica
  v := public.salvar_rdo(jsonb_build_object('id', v_id, 'versao', 1, 'conteudo', '{"atividades":[]}'::jsonb,
         'historico', jsonb_build_array(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-00000000000a', 'em', now(), 'quem', 'José', 'acao', 'Começou o RDO'))));
  if (v ->> 'versao')::int <> 2 then raise exception 'FALHOU: a versão não subiu ao gravar'; end if;
  if (select count(*) from public.rdo_historico where rdo_id = v_id) <> 1 then raise exception 'FALHOU: o histórico repetido duplicou'; end if;
  -- outro aparelho com a versão antiga: conflito
  begin perform public.salvar_rdo(jsonb_build_object('id', v_id, 'versao', 1, 'conteudo', '{}'::jsonb)); raise exception 'FALHOU: gravou com a versão antiga (sem conflito)';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; if sqlerrm not like 'KB_CONFLITO%' then raise exception 'FALHOU: conflito com a mensagem errada: %', sqlerrm; end if; end;
  -- um segundo diário no mesmo dia e obra: recusado
  begin perform public.salvar_rdo(jsonb_build_object('id', gen_random_uuid(), 'obra_id', pg_temp.g('o1'), 'data', hoje, 'conteudo', '{}'::jsonb)); raise exception 'FALHOU: dois diários no mesmo dia';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- o app não grava direto na tabela
  begin update public.rdos set status = 'aprovado' where id = v_id; raise exception 'FALHOU: o app mudou a situação direto na tabela';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- enviar incompleto: recusado
  begin perform public.enviar_rdo(v_id, 2); raise exception 'FALHOU: enviou sem clima, equipe e atividade';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- completa, com uma foto na pasta certa e outra na pasta de outra empresa (essa fica de fora)
  seg := pg_temp.g('A') || '/' || pg_temp.g('o1') || '/' || v_id || '/';
  v := public.salvar_rdo(jsonb_build_object('id', v_id, 'versao', 2, 'conteudo', pg_temp.completo(), 'fotos', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-00000000000f', 'path', seg || 'f1.jpg', 'path_mini', seg || 'f1-mini.jpg', 'legenda', 'Parede norte', 'hash_original', 'abc', 'tirada_em', now()),
         jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-0000000000ff', 'path', pg_temp.g('B') || '/x/y/f2.jpg'))));
  if (select count(*) from public.rdo_fotos where rdo_id = v_id) <> 1 then raise exception 'FALHOU: foto fora da pasta do diário foi aceita'; end if;
  v := public.enviar_rdo(v_id, 3);
  if v ->> 'status' <> 'enviado' then raise exception 'FALHOU: não enviou'; end if;
  v := public.enviar_rdo(v_id, 3);   -- o aparelho repete o envio
  if v ->> 'status' <> 'enviado' then raise exception 'FALHOU: o envio repetido deu erro'; end if;
  begin perform public.salvar_rdo(jsonb_build_object('id', v_id, 'versao', 4, 'conteudo', '{}'::jsonb)); raise exception 'FALHOU: editou um diário já enviado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.aprovar_rdo(v_id); raise exception 'FALHOU: o Encarregado aprovou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- dia sem atividade (ontem), repetido pelo aparelho
  v := public.dia_sem_atividade(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000003', 'obra_id', pg_temp.g('o1'), 'data', hoje - 1, 'motivo', 'Chuva'));
  v := public.dia_sem_atividade(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000003', 'obra_id', pg_temp.g('o1'), 'data', hoje - 1, 'motivo', 'Chuva'));
  if (select count(*) from public.rdos where obra_id = pg_temp.g('o1')::uuid and data = hoje - 1 and status = 'enviado' and sem_atividade ->> 'motivo' = 'Chuva') <> 1 then
    raise exception 'FALHOU: dia sem atividade'; end if;
  -- anteontem: completo e enviado (vai voltar para ajustes)
  perform public.salvar_rdo(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000002', 'obra_id', pg_temp.g('o1'), 'data', hoje - 2, 'conteudo', pg_temp.completo()));
  perform public.enviar_rdo('aaaaaaaa-0000-4000-8000-000000000002', 1);
  -- na obra da construtora: um enviado e um rascunho
  perform public.salvar_rdo(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000004', 'obra_id', pg_temp.g('o2'), 'data', hoje, 'conteudo', pg_temp.completo()));
  perform public.enviar_rdo('aaaaaaaa-0000-4000-8000-000000000004', 1);
  perform public.salvar_rdo(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000005', 'obra_id', pg_temp.g('o2'), 'data', hoje - 1, 'conteudo', '{}'::jsonb));
  -- fotos no Storage: na pasta do rascunho da própria empresa pode; na de outra empresa, não
  insert into storage.objects (bucket_id, name) values ('diarios', pg_temp.g('A') || '/' || pg_temp.g('o2') || '/aaaaaaaa-0000-4000-8000-000000000005/f.jpg');
  begin insert into storage.objects (bucket_id, name) values ('diarios', pg_temp.g('B') || '/' || pg_temp.g('ob') || '/x/f.jpg'); raise exception 'FALHOU: gravou foto na pasta de outra empresa';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
-- a foto do diário enviado, gravada antes (como o aparelho faz: primeiro as fotos, depois o diário)
reset role;
insert into storage.objects (bucket_id, name) values ('diarios', pg_temp.g('A') || '/' || pg_temp.g('o2') || '/aaaaaaaa-0000-4000-8000-000000000004/f.jpg'),
                                                     ('diarios', pg_temp.g('A') || '/' || pg_temp.g('o1') || '/aaaaaaaa-0000-4000-8000-000000000001/f1.jpg');

-- ---------- Luis (Trabalhador) não vê nem preenche ----------
select pg_temp.como('00000000-0000-4000-8000-0000000003d1', 'kb-teste3-luis@example.com');
do $$ begin
  if exists (select 1 from public.rdos) then raise exception 'FALHOU: o Trabalhador vê os diários'; end if;
  begin perform public.salvar_rdo(jsonb_build_object('obra_id', pg_temp.g('o1'), 'data', pg_temp.g('hoje')::date - 5, 'conteudo', '{}'::jsonb)); raise exception 'FALHOU: o Trabalhador preencheu';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ---------- Ana aprova a obra própria (HS-13), não a da construtora (HS-11) ----------
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000003a1', 'kb-teste3-ana@example.com');
do $$
declare v jsonb;
begin
  v := public.aprovar_rdo('aaaaaaaa-0000-4000-8000-000000000001');
  if v ->> 'status' <> 'aprovado' or v ->> 'codigo' !~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' then raise exception 'FALHOU: aprovação com código: %', v; end if;
  insert into pg_temp.guarda values ('codigo', v ->> 'codigo');
  if not public.lacre_confere('aaaaaaaa-0000-4000-8000-000000000001') then raise exception 'FALHOU: o lacre não confere logo depois de aprovar'; end if;
  if (select aprovado_por from public.rdos where id = 'aaaaaaaa-0000-4000-8000-000000000001') <> 'Ana Teste' then raise exception 'FALHOU: quem aprovou'; end if;
  begin perform public.aprovar_rdo('aaaaaaaa-0000-4000-8000-000000000004'); raise exception 'FALHOU: a prestadora aprovou o diário que é da construtora aprovar';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- pedir ajustes e o ciclo de volta
  perform public.pedir_ajustes('aaaaaaaa-0000-4000-8000-000000000002', 'Falta a foto da armação');
  if (select status from public.rdos where id = 'aaaaaaaa-0000-4000-8000-000000000002') <> 'ajustes' then raise exception 'FALHOU: pedir ajustes'; end if;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000003c1', 'kb-teste3-jose@example.com');
do $$
declare v jsonb; ver int;
begin
  ver := (select versao from public.rdos where id = 'aaaaaaaa-0000-4000-8000-000000000002');
  v := public.salvar_rdo(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000002', 'versao', ver, 'conteudo', pg_temp.completo() || '{"observacoes":"foto incluída"}'));
  perform public.enviar_rdo('aaaaaaaa-0000-4000-8000-000000000002', (v ->> 'versao')::int);
  if not exists (select 1 from public.rdo_historico where rdo_id = 'aaaaaaaa-0000-4000-8000-000000000002' and acao = 'Reenviou com os ajustes') then raise exception 'FALHOU: reenvio com ajustes'; end if;
  -- aprovado é lacrado: não muda nem sai, nem a foto
  begin perform public.salvar_rdo(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000001', 'versao', 99, 'conteudo', '{}'::jsonb)); raise exception 'FALHOU: mexeu no diário aprovado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into storage.objects (bucket_id, name) values ('diarios', pg_temp.g('A') || '/' || pg_temp.g('o1') || '/aaaaaaaa-0000-4000-8000-000000000001/nova.jpg'); raise exception 'FALHOU: foto nova num diário aprovado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;
do $$ begin
  -- nem o administrador do banco altera o aprovado
  begin update public.rdos set conteudo = '{}' where id = 'aaaaaaaa-0000-4000-8000-000000000001'; raise exception 'FALHOU: alterou o diário aprovado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from public.rdo_fotos where rdo_id = 'aaaaaaaa-0000-4000-8000-000000000001'; raise exception 'FALHOU: apagou a foto do diário aprovado';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin update public.rdo_historico set acao = 'x' where rdo_id = 'aaaaaaaa-0000-4000-8000-000000000001'; raise exception 'FALHOU: alterou o histórico';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ---------- Tom (construtora B): recebe e aprova o diário da prestadora na obra ligada ----------
select pg_temp.como('00000000-0000-4000-8000-0000000003b1', 'kb-teste3-tom@example.com');
do $$
declare v jsonb;
begin
  if exists (select 1 from public.rdos) or exists (select 1 from public.rdo_fotos) then raise exception 'FALHOU: a construtora lê a tabela da prestadora'; end if;
  if (select count(*) from public.diarios_recebidos(pg_temp.g('ob')::uuid)) <> 1 then raise exception 'FALHOU: a construtora deveria receber só o diário enviado da obra ligada'; end if;
  if (select count(*) from public.diarios_recebidos(null)) <> 1 then raise exception 'FALHOU: a obra própria da prestadora apareceu para a construtora'; end if;
  if (select x ->> 'status' from public.diarios_recebidos() x) <> 'enviado' then raise exception 'FALHOU: diário recebido'; end if;
  if not exists (select 1 from storage.objects where name like '%aaaaaaaa-0000-4000-8000-000000000004/f.jpg') then raise exception 'FALHOU: a construtora não vê a foto do diário recebido'; end if;
  if exists (select 1 from storage.objects where name like '%aaaaaaaa-0000-4000-8000-000000000001/%' or name like '%aaaaaaaa-0000-4000-8000-000000000005/%') then
    raise exception 'FALHOU: a construtora vê fotos de diário da obra própria ou de rascunho'; end if;
  v := public.aprovar_rdo('aaaaaaaa-0000-4000-8000-000000000004');
  if v ->> 'status' <> 'aprovado' then raise exception 'FALHOU: a construtora não aprovou'; end if;
  if (select x ->> 'aprovado_por_empresa' from public.diarios_recebidos() x) <> 'Construtora Teste B' then raise exception 'FALHOU: empresa de quem aprovou'; end if;
  begin perform public.pedir_ajustes('aaaaaaaa-0000-4000-8000-000000000002', 'x'); raise exception 'FALHOU: a construtora mexeu no diário da obra própria da prestadora';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ---------- O cliente, sem login, pelo código ----------
reset role;
select set_config('role', 'anon', true), set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true),
       set_config('TimeZone', 'Pacific/Auckland', true);   -- o lacre confere em qualquer fuso
do $$
declare v jsonb;
begin
  v := public.diario_por_codigo(lower(pg_temp.g('codigo')));
  if v is null or (v ->> 'lacre_confere')::boolean is not true or v ? 'historico' or jsonb_array_length(v -> 'fotos') <> 1 then raise exception 'FALHOU: link do cliente: %', v; end if;
  if public.diario_por_codigo('0000-0000-0000') is not null then raise exception 'FALHOU: código inexistente devolveu diário'; end if;
  begin perform 1 from public.rdos; raise exception 'FALHOU: sem login leu a tabela';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.aprovar_rdo('aaaaaaaa-0000-4000-8000-000000000002'); raise exception 'FALHOU: sem login aprovou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ---------- Auditoria e a empresa inteira saindo (cascata) ----------
reset role;
do $$ begin
  if not exists (select 1 from public.auditoria where empresa_id = pg_temp.g('A')::uuid and tabela = 'rdos' and acao = 'update') then raise exception 'FALHOU: diários fora da auditoria'; end if;
  delete from public.empresas where id = pg_temp.g('A')::uuid;
  if exists (select 1 from public.rdos where empresa_id = pg_temp.g('A')::uuid) then raise exception 'FALHOU: a exclusão da empresa não levou os diários'; end if;
end $$;

select 'fatia 3: todas as verificações passaram' as resultado;
rollback;
