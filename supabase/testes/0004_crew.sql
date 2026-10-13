-- KORbuild · teste da fatia 4 (supabase/migrations/20261015_0006_crew.sql): o Crew.
-- Tudo dentro de uma transação que termina em ROLLBACK: nada de teste fica no banco.
-- Cada verificação que falhar interrompe com 'FALHOU: …'. Se chegar ao fim, imprime 'fatia 4: todas as verificações passaram'.
-- Pessoas: Ana (Administradora da prestadora A), José (Encarregado da A), Luis (Trabalhador da A, ligado ao funcionário
--          Luis), Tom (Administrador da construtora B, que contrata a A numa obra) e Eva (Administradora da C, de fora).

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000004a1', 'kb-teste4-ana@example.com', '{"nome":"Ana Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004b1', 'kb-teste4-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004c1', 'kb-teste4-jose@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004d1', 'kb-teste4-luis@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004e1', 'kb-teste4-eva@example.com', '{"nome":"Eva Teste"}', 'authenticated', 'authenticated');

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
-- um instante num dia da semana passada, no fuso da empresa (Nova York): dia 0 = segunda
create function pg_temp.t(p_dia int, p_hora text) returns timestamptz language sql as $$
  select ((pg_temp.g('seg')::date + p_dia) + p_hora::time) at time zone 'America/New_York' $$;
grant execute on function pg_temp.t(int, text) to authenticated;
-- uma batida como o app manda
create function pg_temp.b(p_id text, p_func text, p_tipo text, p_dia int, p_hora text, p_obra text, p_lat float8 default null, p_lon float8 default null) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'funcionario_id', pg_temp.g(p_func), 'tipo', p_tipo, 'em', pg_temp.t(p_dia, p_hora),
                            'obra_id', pg_temp.g(p_obra), 'etapa', 'Framing', 'lat', p_lat, 'lon', p_lon, 'precisao', 8, 'fonte_gps', 'gps') $$;
grant execute on function pg_temp.b(text, text, text, int, text, text, float8, float8) to authenticated;

-- ---------- Empresas, pessoas, funcionários, equipe e obras ----------
select pg_temp.como('00000000-0000-4000-8000-0000000004a1', 'kb-teste4-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Prestadora Teste A","atuacao":"prestadora"}')::text);
insert into pg_temp.guarda values ('tj', public.convidar_usuario('kb-teste4-jose@example.com', 'José Teste', (select id from public.perfis_acesso where chave = 'encarregado')));
insert into pg_temp.guarda values ('tl', public.convidar_usuario('kb-teste4-luis@example.com', 'Luis Teste', (select id from public.perfis_acesso where chave = 'trabalhador')));
insert into pg_temp.guarda values ('seg', (public.segunda_de(public.hoje_da_empresa(pg_temp.g('A')::uuid)) - 7)::text);
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000004c1', 'kb-teste4-jose@example.com');
select public.aceitar_convite(pg_temp.g('tj'));
insert into pg_temp.guarda values ('jose', (select id::text from public.membros where user_id = auth.uid()));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000004d1', 'kb-teste4-luis@example.com');
select public.aceitar_convite(pg_temp.g('tl'));
insert into pg_temp.guarda values ('mluis', (select id::text from public.membros where user_id = auth.uid()));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000004a1', 'kb-teste4-ana@example.com');
insert into public.contatos (nome, papeis) values ('Construtora B', array['construtora']);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, raio, inicio, prazo, responsavel_id)
  values ('Obra 1', (select id from public.contatos where nome = 'Construtora B'), 'Nashua', 'NH', 42.7600, -71.4600, 150, '2026-01-01', '2027-12-31', pg_temp.g('jose')::uuid),
         ('Obra 2', (select id from public.contatos where nome = 'Construtora B'), 'Manchester', 'NH', 42.9900, -71.4600, 150, '2026-01-01', '2027-12-31', pg_temp.g('jose')::uuid);
insert into pg_temp.guarda values ('o1', (select id::text from public.obras where nome = 'Obra 1')), ('o2', (select id::text from public.obras where nome = 'Obra 2')),
  ('fl', public.criar_funcionario('{"nome":"Luis Teste","funcao":"Carpenter","admissao":"2026-01-05"}', 30)::text),
  ('fp', public.criar_funcionario('{"nome":"Pedro Teste","funcao":"Laborer","admissao":"2026-01-05"}', 22)::text),
  ('fj', public.criar_funcionario('{"nome":"José Teste","funcao":"Foreman","admissao":"2026-01-05"}', 40)::text);
insert into public.equipes (nome, encarregado_id, obra_base_id) values ('Equipe 1', pg_temp.g('jose')::uuid, pg_temp.g('o1')::uuid);
update public.funcionarios set equipe_id = (select id from public.equipes where nome = 'Equipe 1');
update public.membros set funcionario_id = pg_temp.g('fl')::uuid where id = pg_temp.g('mluis')::uuid;
update public.membros set funcionario_id = pg_temp.g('fj')::uuid where id = pg_temp.g('jose')::uuid;
do $$ begin
  if (select count(*) from public.funcionarios where equipe_id is not null) <> 3 then raise exception 'FALHOU: funcionários na equipe'; end if;
  if not exists (select 1 from public.auditoria where tabela = 'equipes') then raise exception 'FALHOU: a equipe não foi para a auditoria'; end if;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000004b1', 'kb-teste4-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Construtora Teste B","atuacao":"construtora"}')::text);
insert into public.contatos (nome, papeis) values ('Dono', array['cliente']);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo)
  values ('Obra B', (select id from public.contatos where nome = 'Dono'), 'Nashua', 'NH', 42.76, -71.46, '2026-01-01', '2027-12-31');
insert into pg_temp.guarda values ('ob', (select id::text from public.obras where nome = 'Obra B'));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000004e1', 'kb-teste4-eva@example.com');
insert into pg_temp.guarda values ('C', public.criar_empresa('{"nome":"Empresa Teste C","atuacao":"prestadora"}')::text);
reset role;
-- a ligação entre as obras é gravada pelas funções das concorrências (fatia 7); aqui, direto como administrador do banco
update public.obras set vinculo_empresa_id = pg_temp.g('B')::uuid, vinculo_obra_id = pg_temp.g('ob')::uuid where id = pg_temp.g('o1')::uuid;

-- ---------- José bate o ponto da equipe (crew.ponto.equipe) ----------
select pg_temp.como('00000000-0000-4000-8000-0000000004c1', 'kb-teste4-jose@example.com');
do $$
declare v jsonb;
begin
  -- segunda: Luis e Pedro entram na Obra 1 (Luis dentro da cerca, Pedro a ~1 km), almoço, troca para a Obra 2, saída
  v := public.registrar_batidas(jsonb_build_array(
    pg_temp.b('b4000000-0000-4000-8000-000000000001', 'fl', 'entrada', 0, '07:00', 'o1', 42.7601, -71.4601),
    pg_temp.b('b4000000-0000-4000-8000-000000000002', 'fp', 'entrada', 0, '07:00', 'o1', 42.7690, -71.4600),
    pg_temp.b('b4000000-0000-4000-8000-000000000003', 'fl', 'intervalo-inicio', 0, '12:00', 'o1'),
    pg_temp.b('b4000000-0000-4000-8000-000000000004', 'fl', 'intervalo-fim', 0, '12:30', 'o1'),
    pg_temp.b('b4000000-0000-4000-8000-000000000005', 'fl', 'troca', 0, '14:00', 'o1'),
    pg_temp.b('b4000000-0000-4000-8000-000000000006', 'fl', 'chegada', 0, '14:30', 'o2', 42.9900, -71.4600),
    pg_temp.b('b4000000-0000-4000-8000-000000000007', 'fl', 'saida', 0, '17:00', 'o2', 42.9900, -71.4600),
    -- Pedro fica sem saída na segunda
    -- terça: os dois com entrada e saída
    pg_temp.b('b4000000-0000-4000-8000-000000000011', 'fl', 'entrada', 1, '07:00', 'o1', 42.7600, -71.4600),
    pg_temp.b('b4000000-0000-4000-8000-000000000012', 'fl', 'saida', 1, '15:00', 'o1', 42.7600, -71.4600),
    pg_temp.b('b4000000-0000-4000-8000-000000000013', 'fp', 'entrada', 1, '07:00', 'o1'),
    pg_temp.b('b4000000-0000-4000-8000-000000000014', 'fp', 'saida', 1, '15:00', 'o1')));
  if jsonb_array_length(v -> 'gravadas') <> 11 or jsonb_array_length(v -> 'recusadas') <> 0 then raise exception 'FALHOU: batidas da equipe: %', v; end if;
  if (select modo from public.batidas where id = 'b4000000-0000-4000-8000-000000000001') <> 'equipe' then raise exception 'FALHOU: modo da batida pela equipe'; end if;
  if (select registrado_por from public.batidas where id = 'b4000000-0000-4000-8000-000000000001') <> pg_temp.g('jose')::uuid then raise exception 'FALHOU: quem registrou'; end if;
  -- a cerca é conferida no banco (RN-09): dentro, fora (aceita e marcada) e sem GPS = fora
  if (select dentro_cerca from public.batidas where id = 'b4000000-0000-4000-8000-000000000001') is not true then raise exception 'FALHOU: dentro da cerca'; end if;
  if (select dentro_cerca from public.batidas where id = 'b4000000-0000-4000-8000-000000000002') is not false then raise exception 'FALHOU: fora da cerca'; end if;
  if (select dentro_cerca from public.batidas where id = 'b4000000-0000-4000-8000-000000000013') is not false then raise exception 'FALHOU: sem GPS conta como fora'; end if;
  -- o aparelho manda de novo (sinal ruim): não duplica
  v := public.registrar_batidas(jsonb_build_array(pg_temp.b('b4000000-0000-4000-8000-000000000001', 'fl', 'entrada', 0, '07:00', 'o1', 42.7601, -71.4601)));
  if jsonb_array_length(v -> 'gravadas') <> 1 or (select count(*) from public.batidas where funcionario_id = pg_temp.g('fl')::uuid) <> 8 then raise exception 'FALHOU: batida repetida duplicou'; end if;
  -- recusadas com o motivo, sem derrubar as outras: obra de fora, funcionário de fora, hora no futuro, entrada sem obra
  v := public.registrar_batidas(jsonb_build_array(
    pg_temp.b('b4000000-0000-4000-8000-000000000021', 'fl', 'entrada', 2, '07:00', 'ob'),
    jsonb_build_object('id', 'b4000000-0000-4000-8000-000000000022', 'funcionario_id', gen_random_uuid(), 'tipo', 'entrada', 'em', now(), 'obra_id', pg_temp.g('o1')),
    jsonb_build_object('id', 'b4000000-0000-4000-8000-000000000023', 'funcionario_id', pg_temp.g('fl'), 'tipo', 'saida', 'em', now() + interval '1 day', 'obra_id', pg_temp.g('o1')),
    jsonb_build_object('id', 'b4000000-0000-4000-8000-000000000024', 'funcionario_id', pg_temp.g('fl'), 'tipo', 'entrada', 'em', now()),
    pg_temp.b('b4000000-0000-4000-8000-000000000025', 'fl', 'saida', 2, '07:00', 'o1')));
  if jsonb_array_length(v -> 'recusadas') <> 4 or jsonb_array_length(v -> 'gravadas') <> 1 then raise exception 'FALHOU: recusas por item: %', v; end if;
  if not (v -> 'recusadas') @> '[{"motivo":"obra"},{"motivo":"funcionario"},{"motivo":"hora"}]' then raise exception 'FALHOU: motivos das recusas: %', v; end if;
  -- a batida não muda nem sai (RN-01), nem pela tabela
  begin update public.batidas set em = now() where id = 'b4000000-0000-4000-8000-000000000001'; raise exception 'FALHOU: o app alterou uma batida';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.batidas (id, empresa_id, funcionario_id, tipo, em, modo) values (gen_random_uuid(), pg_temp.g('A')::uuid, pg_temp.g('fl')::uuid, 'entrada', now(), 'equipe');
    raise exception 'FALHOU: o app gravou batida direto na tabela';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- o encarregado não ajusta, não aprova nem vê dinheiro
  begin perform public.ajustar_batida(jsonb_build_object('id', gen_random_uuid(), 'funcionario_id', pg_temp.g('fp'), 'tipo', 'saida', 'em', pg_temp.t(0, '16:00'), 'obra_id', pg_temp.g('o1'), 'motivo', 'x'));
    raise exception 'FALHOU: o encarregado ajustou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.decidir_semana(array[pg_temp.g('fl')::uuid], pg_temp.g('seg')::date, 'aprovado'); raise exception 'FALHOU: o encarregado aprovou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  if (select count(*) from public.batidas) <> 12 then raise exception 'FALHOU: o encarregado não lê o ponto da equipe'; end if;
  if exists (select 1 from public.orcamentos_obra) or exists (select 1 from public.funcionario_valores) then raise exception 'FALHOU: o encarregado viu dinheiro'; end if;
end $$;
reset role;

-- ---------- Luis, trabalhador: só o próprio ponto e a própria localização ----------
select pg_temp.como('00000000-0000-4000-8000-0000000004d1', 'kb-teste4-luis@example.com');
do $$
declare v jsonb;
begin
  -- não bate o ponto dos outros
  v := public.registrar_batidas(jsonb_build_array(pg_temp.b('b4000000-0000-4000-8000-000000000031', 'fp', 'saida', 2, '15:00', 'o1')));
  if v -> 'recusadas' -> 0 ->> 'motivo' is distinct from 'permissao' then raise exception 'FALHOU: o trabalhador bateu o ponto de outro: %', v; end if;
  -- só vê as próprias batidas
  if exists (select 1 from public.batidas where funcionario_id <> pg_temp.g('fl')::uuid) then raise exception 'FALHOU: o trabalhador viu o ponto de outro'; end if;
  -- localização: sem o aviso aceito, recusa (RN-17)
  v := public.registrar_localizacoes(jsonb_build_array(jsonb_build_object('id', 'c4000000-0000-4000-8000-000000000001', 'em', pg_temp.t(0, '09:00'), 'lat', 42.76, 'lon', -71.46, 'gatilho', 'periodico')));
  if v -> 'recusadas' -> 0 ->> 'motivo' is distinct from 'sem-aviso' then raise exception 'FALHOU: localização sem o aviso aceito: %', v; end if;
  if public.aceitar_aviso_gps() is null then raise exception 'FALHOU: aceitar o aviso de localização'; end if;
  -- com o ponto aberto grava (e a obra vem da jornada); no intervalo, fora do expediente e no deslocamento sem obra
  v := public.registrar_localizacoes(jsonb_build_array(
    jsonb_build_object('id', 'c4000000-0000-4000-8000-000000000001', 'em', pg_temp.t(0, '09:00'), 'lat', 42.76, 'lon', -71.46, 'precisao', 9, 'gatilho', 'periodico'),
    jsonb_build_object('id', 'c4000000-0000-4000-8000-000000000002', 'em', pg_temp.t(0, '12:10'), 'lat', 42.76, 'lon', -71.46, 'gatilho', 'periodico'),
    jsonb_build_object('id', 'c4000000-0000-4000-8000-000000000003', 'em', pg_temp.t(0, '14:10'), 'lat', 42.85, 'lon', -71.46, 'gatilho', 'periodico'),
    jsonb_build_object('id', 'c4000000-0000-4000-8000-000000000004', 'em', pg_temp.t(0, '18:00'), 'lat', 42.99, 'lon', -71.46, 'gatilho', 'app-aberto'),
    jsonb_build_object('id', 'c4000000-0000-4000-8000-000000000005', 'em', pg_temp.t(0, '06:00'), 'lat', 42.99, 'lon', -71.46, 'gatilho', 'app-aberto')));
  if jsonb_array_length(v -> 'gravadas') <> 2 then raise exception 'FALHOU: localizações gravadas: %', v; end if;
  if not (v -> 'recusadas') @> '[{"motivo":"intervalo"},{"motivo":"ponto-fechado"}]' or jsonb_array_length(v -> 'recusadas') <> 3 then raise exception 'FALHOU: localizações recusadas: %', v; end if;
  if (select obra_id from public.localizacoes where id = 'c4000000-0000-4000-8000-000000000001') <> pg_temp.g('o1')::uuid then raise exception 'FALHOU: obra da localização'; end if;
  if (select obra_id from public.localizacoes where id = 'c4000000-0000-4000-8000-000000000003') is not null then raise exception 'FALHOU: deslocamento sem obra'; end if;
  -- repetida: não duplica
  v := public.registrar_localizacoes(jsonb_build_array(jsonb_build_object('id', 'c4000000-0000-4000-8000-000000000001', 'em', pg_temp.t(0, '09:00'), 'lat', 42.76, 'lon', -71.46, 'gatilho', 'periodico')));
  if (select count(*) from public.localizacoes) <> 2 then raise exception 'FALHOU: localização repetida duplicou'; end if;
  begin delete from public.localizacoes; if found then raise exception 'FALHOU: o trabalhador apagou a localização'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- O encarregado não vê a localização dos outros (só o escritório que acompanha e o próprio trabalhador).
select pg_temp.como('00000000-0000-4000-8000-0000000004c1', 'kb-teste4-jose@example.com');
do $$ begin
  if exists (select 1 from public.localizacoes) then raise exception 'FALHOU: o encarregado viu a localização de outro'; end if;
  -- e a localização é só do próprio celular: José não grava a do Luis (grava a dele, sem o aviso aceito: recusa)
  if (public.registrar_localizacoes(jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'em', pg_temp.t(0, '09:00'), 'lat', 42.76, 'lon', -71.46, 'gatilho', 'periodico'))) -> 'gravadas') <> '[]'
    then raise exception 'FALHOU: localização sem jornada do próprio encarregado'; end if;
end $$;
reset role;

-- ---------- Ana, escritório: conferir, ajustar, aprovar, devolver, orçamento ----------
select pg_temp.como('00000000-0000-4000-8000-0000000004a1', 'kb-teste4-ana@example.com');
do $$
declare v_seg date := pg_temp.g('seg')::date;
begin
  if (select count(*) from public.localizacoes) <> 2 then raise exception 'FALHOU: o escritório não vê as localizações'; end if;
  perform public.conferir_batida('b4000000-0000-4000-8000-000000000002');
  perform public.conferir_batida('b4000000-0000-4000-8000-000000000002');   -- de novo: sem efeito
  if (select count(*) from public.batidas_conferidas) <> 1 then raise exception 'FALHOU: conferir'; end if;
  if (select dentro_cerca from public.batidas where id = 'b4000000-0000-4000-8000-000000000002') is not false then raise exception 'FALHOU: a conferência mudou a batida'; end if;
  -- Pedro ficou sem saída na segunda: não aprova (RN-08)
  begin perform public.decidir_semana(array[pg_temp.g('fl')::uuid, pg_temp.g('fp')::uuid], v_seg, 'aprovado'); raise exception 'FALHOU: aprovou semana com dia sem saída';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; if sqlerrm not like '%Pedro Teste%' then raise exception 'FALHOU: aviso sem o nome: %', sqlerrm; end if; end;
  -- ajuste sem motivo: recusa; com motivo: batida nova, marcada, auditada
  begin perform public.ajustar_batida(jsonb_build_object('id', 'b4000000-0000-4000-8000-000000000041', 'funcionario_id', pg_temp.g('fp'), 'tipo', 'saida', 'em', pg_temp.t(0, '16:00'), 'obra_id', pg_temp.g('o1')));
    raise exception 'FALHOU: ajuste sem motivo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  perform public.ajustar_batida(jsonb_build_object('id', 'b4000000-0000-4000-8000-000000000041', 'funcionario_id', pg_temp.g('fp'), 'tipo', 'saida', 'em', pg_temp.t(0, '16:00'),
                                                   'obra_id', pg_temp.g('o1'), 'motivo', 'Esqueceu de bater a saída; confirmado com o encarregado.'));
  if (select modo || '|' || coalesce(dentro_cerca::text, 'null') from public.batidas where id = 'b4000000-0000-4000-8000-000000000041') <> 'ajuste|null' then raise exception 'FALHOU: batida de ajuste'; end if;
  if not exists (select 1 from public.auditoria where tabela = 'batidas' and registro = 'b4000000-0000-4000-8000-000000000041') then raise exception 'FALHOU: ajuste sem auditoria'; end if;
  -- devolver exige motivo
  begin perform public.decidir_semana(array[pg_temp.g('fp')::uuid], v_seg, 'devolvido', ' '); raise exception 'FALHOU: devolveu sem motivo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  perform public.decidir_semana(array[pg_temp.g('fp')::uuid], v_seg, 'devolvido', 'Conferir a terça.');
  -- agora aprova os dois (a data pode vir em qualquer dia: vale a segunda-feira)
  if public.decidir_semana(array[pg_temp.g('fl')::uuid, pg_temp.g('fp')::uuid], v_seg + 3, 'aprovado') <> 2 then raise exception 'FALHOU: aprovar'; end if;
  if (select count(*) from public.aprovacoes_semana where semana = v_seg) <> 3 then raise exception 'FALHOU: decisões da semana'; end if;
  -- semana aprovada é fechada: não aprova/devolve de novo, não recebe ajuste, nem batida atrasada, nem valor hora novo
  begin perform public.decidir_semana(array[pg_temp.g('fl')::uuid], v_seg, 'devolvido', 'x'); raise exception 'FALHOU: mudou semana aprovada';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.ajustar_batida(jsonb_build_object('id', gen_random_uuid(), 'funcionario_id', pg_temp.g('fl'), 'tipo', 'saida', 'em', pg_temp.t(2, '16:00'), 'obra_id', pg_temp.g('o1'), 'motivo', 'x'));
    raise exception 'FALHOU: ajustou semana aprovada';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.funcionario_valores (funcionario_id, desde, valor, motivo) values (pg_temp.g('fl')::uuid, v_seg + 2, 33, 'Reajuste');
    raise exception 'FALHOU: valor hora dentro de semana aprovada (RN-13)';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.funcionario_valores (funcionario_id, desde, valor, motivo) values (pg_temp.g('fl')::uuid, v_seg - 14, 33, 'Reajuste');
    raise exception 'FALHOU: valor hora antes de semana aprovada (reescreveria a folha)';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.funcionario_valores (funcionario_id, desde, valor, motivo) values (pg_temp.g('fl')::uuid, v_seg + 7, 33, 'Reajuste');   -- semana seguinte: pode
  -- orçamento: versões, só INSERT, com autor
  insert into public.orcamentos_obra (obra_id, valor, avanco, por_etapa) values (pg_temp.g('o1')::uuid, 100000, 10, '{"Framing": 60000}');
  if (select por from public.orcamentos_obra) <> auth.uid() then raise exception 'FALHOU: autor do orçamento'; end if;
  begin update public.orcamentos_obra set valor = 1; raise exception 'FALHOU: alterou o orçamento';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- Batida atrasada (sem sinal) numa semana já aprovada: volta como recusada, sem derrubar o resto.
select pg_temp.como('00000000-0000-4000-8000-0000000004c1', 'kb-teste4-jose@example.com');
do $$ declare v jsonb;
begin
  v := public.registrar_batidas(jsonb_build_array(pg_temp.b('b4000000-0000-4000-8000-000000000051', 'fl', 'etapa', 1, '10:00', 'o1')));
  if v -> 'recusadas' -> 0 ->> 'motivo' is distinct from 'semana-aprovada' then raise exception 'FALHOU: batida em semana aprovada: %', v; end if;
end $$;
reset role;

-- ---------- Tom, contratante: presença sem dinheiro, só pela função (HS-10) ----------
select pg_temp.como('00000000-0000-4000-8000-0000000004b1', 'kb-teste4-tom@example.com');
do $$
declare v jsonb; v_seg date := pg_temp.g('seg')::date; txt text;
begin
  if exists (select 1 from public.batidas) or exists (select 1 from public.localizacoes) or exists (select 1 from public.equipes)
     or exists (select 1 from public.aprovacoes_semana) then raise exception 'FALHOU: a contratante leu o ponto da prestadora direto'; end if;
  select jsonb_agg(x) into v from public.presenca_na_obra(pg_temp.g('ob')::uuid, v_seg, v_seg + 6) x;
  if jsonb_array_length(v) <> 1 or v -> 0 -> 'empresa' ->> 'nome' <> 'Prestadora Teste A' then raise exception 'FALHOU: presença na obra: %', v; end if;
  if jsonb_array_length(v -> 0 -> 'pessoas') <> 2 then raise exception 'FALHOU: pessoas na obra: %', v -> 0 -> 'pessoas'; end if;
  txt := v::text;
  if txt ~ '(valor|lat|lon|nota|foto|custo|precisao)' then raise exception 'FALHOU: a presença mostrou dado que não devia: %', txt; end if;
  if txt like '%' || pg_temp.g('o2') || '%' or txt like '%Obra 2%' then raise exception 'FALHOU: a presença revelou a outra obra da prestadora'; end if;
  -- a batida da troca/chegada em outra obra vem só como "outra obra" (obra_id null)
  if not exists (select 1 from jsonb_array_elements(v -> 0 -> 'pessoas') p, jsonb_array_elements(p -> 'batidas') b
                  where p ->> 'nome' = 'Luis Teste' and b ->> 'tipo' = 'chegada' and b -> 'obra_id' = 'null') then raise exception 'FALHOU: batida em outra obra'; end if;
  -- período longo demais: nada
  if exists (select 1 from public.presenca_na_obra(pg_temp.g('ob')::uuid, v_seg - 100, v_seg)) then raise exception 'FALHOU: período sem limite'; end if;
end $$;
reset role;

-- ---------- Eva, de fora: não vê nem grava nada ----------
select pg_temp.como('00000000-0000-4000-8000-0000000004e1', 'kb-teste4-eva@example.com');
do $$
begin
  if exists (select 1 from public.batidas) or exists (select 1 from public.equipes) or exists (select 1 from public.orcamentos_obra)
     or exists (select 1 from public.batidas_conferidas) or exists (select 1 from public.aprovacoes_semana) then raise exception 'FALHOU: outra empresa leu o ponto'; end if;
  if exists (select 1 from public.presenca_na_obra(pg_temp.g('ob')::uuid, pg_temp.g('seg')::date, pg_temp.g('seg')::date + 6)) then raise exception 'FALHOU: outra empresa leu a presença'; end if;
  begin perform public.conferir_batida('b4000000-0000-4000-8000-000000000002'); raise exception 'FALHOU: outra empresa conferiu';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.decidir_semana(array[pg_temp.g('fl')::uuid], pg_temp.g('seg')::date + 7, 'aprovado'); raise exception 'FALHOU: outra empresa aprovou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.registrar_batidas(jsonb_build_array(pg_temp.b(gen_random_uuid()::text, 'fl', 'entrada', 2, '07:00', 'o1'))); raise exception 'FALHOU: outra empresa bateu o ponto';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- Anônimo: nada.
set local role anon;
do $$ begin
  begin perform 1 from public.batidas; raise exception 'FALHOU: anônimo leu batidas';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.registrar_batidas('[]'); raise exception 'FALHOU: anônimo chamou registrar_batidas';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- Excluir a empresa leva tudo junto (cascata), sem esbarrar nas travas. (Confere só a empresa da cena: o banco de verdade tem a massa de demonstração.)
delete from public.empresas where id = pg_temp.g('A')::uuid;
do $$ begin
  if exists (select 1 from public.batidas where empresa_id = pg_temp.g('A')::uuid) or exists (select 1 from public.localizacoes where empresa_id = pg_temp.g('A')::uuid) or exists (select 1 from public.aprovacoes_semana where empresa_id = pg_temp.g('A')::uuid) then
    raise exception 'FALHOU: sobrou ponto da empresa excluída';
  end if;
end $$;

select 'fatia 4: todas as verificações passaram' as resultado;
rollback;
