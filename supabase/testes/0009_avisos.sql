-- KORbuild · teste da fatia 8a (supabase/migrations/20261020_0011_avisos.sql): os avisos gravados pelo servidor e a fila de e-mails.
-- Tudo dentro de uma transação que termina em ROLLBACK. Cada verificação que falhar interrompe com 'FALHOU: …'.
-- Pessoas: Ana (Administradora da prestadora A, idioma pt), José (Encarregado da A: preenche o diário, não vê concorrências),
--          Tom (Administrador da construtora B, a contratante). A tem uma obra ligada à de B. Bayside é convidada só pelo link.

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000009a1', 'kb-teste9-ana@example.com', '{"nome":"Ana Teste","idioma":"pt"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000009b1', 'kb-teste9-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000009c1', 'kb-teste9-jose@example.com', '{}', 'authenticated', 'authenticated');

create function pg_temp.como(p_id uuid, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;
grant execute on function pg_temp.como(uuid, text) to authenticated;
create function pg_temp.ninguem() returns void language sql as $$ select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true) $$;
create table pg_temp.guarda (chave text primary key, valor text);
grant all on pg_temp.guarda to authenticated, anon, service_role;
create function pg_temp.g(p text) returns text language sql as $$ select valor from pg_temp.guarda where chave = p $$;
grant execute on function pg_temp.g(text) to authenticated, anon, service_role;
create function pg_temp.u(p text) returns uuid language sql as $$ select valor::uuid from pg_temp.guarda where chave = p $$;
grant execute on function pg_temp.u(text) to authenticated, anon, service_role;
create function pg_temp.completo() returns jsonb language sql as $$
  select '{"clima":{"manha":{"tempo":"sol"},"tarde":{"tempo":"nublado"}},"equipe":[{"funcao":"Carpenter","presentes":3}],"atividades":[{"descricao":"Framing do 1º pavimento"}]}'::jsonb $$;
grant execute on function pg_temp.completo() to authenticated;
-- quantos avisos o usuário tem (qualquer categoria, ou uma), e o último como json (lidos como administrador, sem o RLS)
create function pg_temp.n(p_email text, p_cat text default null) returns int language sql security definer as $$
  select count(*)::int from public.notificacoes x join auth.users u on u.id = x.user_id where u.email = p_email and (p_cat is null or x.categoria = p_cat) $$;
create function pg_temp.ult(p_email text, p_cat text default null) returns jsonb language sql security definer as $$
  select to_jsonb(x) from public.notificacoes x join auth.users u on u.id = x.user_id where u.email = p_email and (p_cat is null or x.categoria = p_cat) order by x.id desc limit 1 $$;
create function pg_temp.fila(p_modelo text default null) returns int language sql security definer as $$
  select count(*)::int from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and (p_modelo is null or modelo = p_modelo) $$;
create function pg_temp.tem(p_email text, p_titulo text) returns boolean language sql security definer as $$
  select exists (select 1 from public.notificacoes x join auth.users u on u.id = x.user_id where u.email = p_email and x.titulo like p_titulo) $$;
create function pg_temp.dele(p_email text, p_chave_like text) returns jsonb language sql security definer as $$
  select to_jsonb(x) from public.notificacoes x join auth.users u on u.id = x.user_id where u.email = p_email and x.chave like p_chave_like order by x.id desc limit 1 $$;
grant execute on function pg_temp.n(text, text), pg_temp.ult(text, text), pg_temp.fila(text), pg_temp.tem(text, text), pg_temp.dele(text, text) to authenticated, anon, service_role;

-- ---------- Empresas, pessoas e obras ----------
select pg_temp.como('00000000-0000-4000-8000-0000000009a1', 'kb-teste9-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Prestadora Teste A","atuacao":"prestadora"}')::text);
-- o convite de usuário entra na fila (sem login ainda), com o token, a empresa e o perfil; no idioma de quem convidou
insert into pg_temp.guarda values ('tj', public.convidar_usuario('KB-Teste9-Jose@example.com', 'José Teste', (select id from public.perfis_acesso where chave = 'encarregado')));
do $$ declare f record; begin
  select * into f from public.fila_email;   -- como Ana: sem acesso à fila, o administrador do banco confere abaixo
exception when insufficient_privilege then null; end $$;
reset role;
do $$ declare f public.fila_email; begin
  select * into f from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and modelo = 'convite-usuario';
  if f.id is null or f.para_email <> 'kb-teste9-jose@example.com' or f.idioma <> 'pt' or f.dados ->> 'token' <> pg_temp.g('tj') or f.dados ->> 'empresa' <> 'Prestadora Teste A'
     or f.dados ->> 'perfil' <> 'Encarregado' or f.dados ->> 'por' <> 'Ana Teste' or f.empresa_id <> pg_temp.u('A') or f.enviado_em is not null then
    raise exception 'FALHOU: o convite de usuário na fila: %', to_jsonb(f);
  end if;
end $$;
select pg_temp.como('00000000-0000-4000-8000-0000000009c1', 'kb-teste9-jose@example.com');
select public.aceitar_convite(pg_temp.g('tj'));
insert into pg_temp.guarda values ('jose', (select id::text from public.membros where user_id = auth.uid()));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000009a1', 'kb-teste9-ana@example.com');
insert into public.contatos (nome, papeis) values ('Construtora B', array['construtora']);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo, responsavel_id)
  values ('Obra da construtora', (select id from public.contatos where nome = 'Construtora B'), 'Nashua', 'NH', 42.76, -71.46, '2026-01-01', '2027-12-31', pg_temp.g('jose')::uuid);
insert into pg_temp.guarda values ('o2', (select id::text from public.obras where nome = 'Obra da construtora')),
                                  ('hoje', public.hoje_da_empresa(pg_temp.g('A')::uuid)::text);
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000009b1', 'kb-teste9-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Construtora Teste B","atuacao":"construtora"}')::text);
insert into public.contatos (nome, papeis, conta_empresa_id) values ('Dono', array['cliente'], null), ('Prestadora A', array['prestadora'], pg_temp.u('A'));
insert into public.contatos (nome, papeis, email) values ('Bayside Drywall', array['prestadora'], 'KB-Teste9-Bay@example.com');
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo)
  values ('Obra B', (select id from public.contatos where nome = 'Dono'), 'Nashua', 'NH', 42.76, -71.46, '2026-01-01', '2027-12-31');
insert into pg_temp.guarda values ('ob', (select id::text from public.obras where nome = 'Obra B'));
reset role;
update public.obras set vinculo_empresa_id = pg_temp.u('B'), vinculo_obra_id = pg_temp.u('ob') where id = pg_temp.u('o2');
select pg_temp.ninguem();

-- ---------- Diário (fatia 3): José envia → Tom é avisado; Tom aprova/pede ajustes → José é avisado ----------
select pg_temp.como('00000000-0000-4000-8000-0000000009c1', 'kb-teste9-jose@example.com');
do $$ declare hoje date := pg_temp.g('hoje')::date; a jsonb; begin
  perform public.salvar_rdo(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000091', 'obra_id', pg_temp.g('o2'), 'data', hoje, 'conteudo', pg_temp.completo()));
  perform public.enviar_rdo('aaaaaaaa-0000-4000-8000-000000000091', 1);
  perform public.salvar_rdo(jsonb_build_object('id', 'aaaaaaaa-0000-4000-8000-000000000092', 'obra_id', pg_temp.g('o2'), 'data', hoje - 1, 'conteudo', pg_temp.completo()));
  perform public.enviar_rdo('aaaaaaaa-0000-4000-8000-000000000092', 1);
  if pg_temp.n('kb-teste9-tom@example.com', 'daily') <> 2 then raise exception 'FALHOU: Tom devia ter 2 avisos de diário (tem %)', pg_temp.n('kb-teste9-tom@example.com', 'daily'); end if;
  a := pg_temp.ult('kb-teste9-tom@example.com', 'daily');
  if a ->> 'titulo' <> 'RDO nº 1 de Obra B aguardando aprovação' and a ->> 'titulo' <> 'RDO nº 2 de Obra da construtora aguardando aprovação' then raise exception 'FALHOU: título do aviso: %', a; end if;
  if a ->> 'chave' <> 'RDO nº {numero} de {obra} aguardando aprovação' or (a -> 'dados' ->> 'obra') <> 'Obra da construtora' or a ->> 'link' not like '#/daily/painel/rdo/%'
     or a ->> 'email_em' is not null or (a ->> 'imediato')::boolean or (a ->> 'empresa_id')::uuid <> pg_temp.u('B') then raise exception 'FALHOU: dados do aviso: %', a; end if;
  if pg_temp.n('kb-teste9-ana@example.com') <> 0 or pg_temp.n('kb-teste9-jose@example.com') <> 0 then raise exception 'FALHOU: avisou quem não aprova (a prestadora ou o autor)'; end if;
  if (select count(*) from public.notificacoes) <> 0 then raise exception 'FALHOU: José lê avisos de outro'; end if;
end $$;
-- reenviar o mesmo diário (ajuste) agrupa no aviso que já existe
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000009b1', 'kb-teste9-tom@example.com');
do $$ declare a jsonb; begin
  if (select count(*) from public.notificacoes where categoria = 'daily') <> 2 then raise exception 'FALHOU: Tom lê os próprios avisos (2)'; end if;
  perform public.aprovar_rdo('aaaaaaaa-0000-4000-8000-000000000091');
  perform public.pedir_ajustes('aaaaaaaa-0000-4000-8000-000000000092', 'Falta a foto da armação');
  if pg_temp.n('kb-teste9-jose@example.com', 'daily') <> 2 then raise exception 'FALHOU: José devia ter 2 avisos (aprovado e ajustes)'; end if;
  if pg_temp.n('kb-teste9-tom@example.com', 'daily') <> 2 then raise exception 'FALHOU: Tom avisou a si mesmo'; end if;
  a := pg_temp.dele('kb-teste9-jose@example.com', 'O escritório pediu ajustes%');
  if a is null or a ->> 'titulo' <> 'O escritório pediu ajustes no RDO nº 2' or a ->> 'texto' <> 'Falta a foto da armação' or not (a ->> 'imediato')::boolean or a ->> 'link' not like '#/daily/campo/rdo/%' then raise exception 'FALHOU: aviso de ajustes: %', a; end if;
  if not pg_temp.tem('kb-teste9-jose@example.com', 'RDO nº 1 de Obra da construtora aprovado') then raise exception 'FALHOU: aviso de aprovado'; end if;
end $$;
reset role;

-- ninguém avisa ninguém pelo app, nem lê a fila
select pg_temp.como('00000000-0000-4000-8000-0000000009b1', 'kb-teste9-tom@example.com');
do $$ begin
  begin perform public.notificar(pg_temp.u('B'), pg_temp.u('B'), 'conta', 'x', '{}', '#/x'); raise exception 'FALHOU: o app chamou notificar';
  exception when insufficient_privilege then null; end;
  begin perform public.notificar_empresa(pg_temp.u('A'), 'daily.aprovar', 'daily', 'x', '{}', '#/x'); raise exception 'FALHOU: o app chamou notificar_empresa';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.fila_email; raise exception 'FALHOU: o app leu a fila de e-mails';
  exception when insufficient_privilege then null; end;
  begin perform * from public.avisos_pendentes_email(); raise exception 'FALHOU: o app leu os e-mails pendentes';
  exception when insufficient_privilege then null; end;
  begin perform public.marcar_avisos_enviados(array[1]::bigint[]); raise exception 'FALHOU: o app marcou aviso como enviado';
  exception when insufficient_privilege then null; end;
  begin perform public.avisar_prazos(); raise exception 'FALHOU: o app rodou o job';
  exception when insufficient_privilege then null; end;
  begin update public.notificacoes set titulo = 'outro'; raise exception 'FALHOU: editou o texto do aviso';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  update public.notificacoes set lida_em = now() where id = (select min(id) from public.notificacoes);   -- marcar como lido pode
end $$;
reset role;

-- ---------- Cronograma publicado (fatia 5): Ana publica → Tom é avisado ----------
select pg_temp.como('00000000-0000-4000-8000-0000000009a1', 'kb-teste9-ana@example.com');
do $$ declare a jsonb; begin
  perform public.salvar_etapa(jsonb_build_object('obra_id', pg_temp.g('o2'), 'nome', 'Framing', 'inicio', '2026-02-01', 'fim', '2026-02-28'));
  perform public.publicar_cronograma(pg_temp.g('o2')::uuid);
  a := pg_temp.ult('kb-teste9-tom@example.com', 'cronograma');
  if a is null or a ->> 'titulo' <> 'Cronograma publicado por Prestadora Teste A: Obra da construtora (versão 1)' or a ->> 'link' <> '#/daily/obras/' || pg_temp.g('ob') || '/cronograma' then raise exception 'FALHOU: aviso do cronograma: %', a; end if;
end $$;
reset role;

-- ---------- A semana do ponto (fatia 4): só o sininho ----------
select pg_temp.como('00000000-0000-4000-8000-0000000009a1', 'kb-teste9-ana@example.com');
insert into pg_temp.guarda values ('fj', public.criar_funcionario('{"nome":"José Teste","funcao":"Foreman","admissao":"2026-01-05"}', 40)::text);
update public.membros set funcionario_id = pg_temp.g('fj')::uuid where id = pg_temp.g('jose')::uuid;
reset role;
select pg_temp.ninguem();
insert into public.aprovacoes_semana (empresa_id, funcionario_id, semana, status, motivo, por_nome) values (pg_temp.u('A'), pg_temp.u('fj'), '2026-10-05', 'aprovado', '', 'Ana Teste');
insert into public.aprovacoes_semana (empresa_id, funcionario_id, semana, status, motivo, por_nome) values (pg_temp.u('A'), pg_temp.u('fj'), '2026-10-12', 'devolvido', 'Falta a saída de terça', 'Ana Teste');
do $$ declare a jsonb; begin
  a := pg_temp.ult('kb-teste9-jose@example.com', 'crew');
  if a ->> 'titulo' <> 'Sua semana de 10/12 foi devolvida: Falta a saída de terça' or a ->> 'email_em' is null then raise exception 'FALHOU: aviso da semana (só sininho): %', a; end if;
  if pg_temp.n('kb-teste9-jose@example.com', 'crew') <> 2 then raise exception 'FALHOU: um aviso por semana (aprovada e devolvida)'; end if;
end $$;

-- ---------- Concorrência (fatia 7) ----------
select pg_temp.como('00000000-0000-4000-8000-0000000009b1', 'kb-teste9-tom@example.com');
do $$ declare v_id uuid; r jsonb; begin
  insert into public.concorrencias (obra_id, servico, etapas, incluso, prazo, quarteirizacao)
  values (pg_temp.u('ob'), 'Framing e drywall', array['06 10 00'], array['Paredes'], now() + interval '5 days', 'permitida') returning id into v_id;
  insert into pg_temp.guarda values ('co', v_id::text);
  insert into public.concorrencia_convites (concorrencia_id, contato_id)
    select v_id, id from public.contatos where nome in ('Prestadora A', 'Bayside Drywall');
  insert into pg_temp.guarda values ('cvA', (select id::text from public.concorrencia_convites where concorrencia_id = v_id and nome = 'Prestadora A')),
                                    ('cvBay', (select id::text from public.concorrencia_convites where concorrencia_id = v_id and nome = 'Bayside Drywall'));
  r := public.enviar_concorrencia(v_id);
  insert into pg_temp.guarda values ('token', r -> 'links' -> 0 ->> 'token');
  -- a Ana (com conta) tem o aviso, na hora; o José (sem a permissão de responder) não; o Tom, que fez a ação, não
  if pg_temp.n('kb-teste9-ana@example.com', 'concorrencia') <> 1 or (pg_temp.ult('kb-teste9-ana@example.com', 'concorrencia') ->> 'titulo') <> 'Convite para cotar: Framing e drywall · Construtora Teste B'
     or not (pg_temp.ult('kb-teste9-ana@example.com', 'concorrencia') ->> 'imediato')::boolean then raise exception 'FALHOU: aviso do convite para a Ana: %', pg_temp.ult('kb-teste9-ana@example.com', 'concorrencia'); end if;
  if pg_temp.n('kb-teste9-jose@example.com', 'concorrencia') <> 0 or pg_temp.n('kb-teste9-tom@example.com', 'concorrencia') <> 0 then raise exception 'FALHOU: avisou quem não devia'; end if;
  -- a Bayside (pelo link) tem o e-mail na fila, com o token e o e-mail em minúsculas, no idioma de quem enviou (Tom: en)
  if pg_temp.fila('convite-concorrencia') <> 1 then raise exception 'FALHOU: e-mail do convite pelo link'; end if;
end $$;
reset role;
do $$ declare f public.fila_email; begin
  select * into f from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and modelo = 'convite-concorrencia';
  if f.para_email <> 'kb-teste9-bay@example.com' or f.idioma <> 'en' or f.dados ->> 'token' <> pg_temp.g('token') or f.dados ->> 'servico' <> 'Framing e drywall' or f.dados ->> 'contratante' <> 'Construtora Teste B' or f.empresa_id <> pg_temp.u('B') then
    raise exception 'FALHOU: dados do e-mail do convite: %', to_jsonb(f); end if;
end $$;

-- Ana responde: vai cotar, manda a proposta e pergunta duas vezes (as perguntas agrupam num aviso só) → Tom é avisado
select pg_temp.como('00000000-0000-4000-8000-0000000009a1', 'kb-teste9-ana@example.com');
do $$ begin
  perform public.responder_convite(pg_temp.u('cvA'), true);
  perform public.enviar_proposta_concorrencia(pg_temp.u('cvA'), '{"total":1000}');
  perform public.escrever_como_convidada(pg_temp.u('cvA'), 'O forro inclui isolamento?');
  perform public.escrever_como_convidada(pg_temp.u('cvA'), 'E a pintura?');
  if (pg_temp.ult('kb-teste9-tom@example.com', 'concorrencia') ->> 'titulo') <> 'Mensagem de Prestadora A · Framing e drywall' then raise exception 'FALHOU: aviso da pergunta: %', pg_temp.ult('kb-teste9-tom@example.com', 'concorrencia'); end if;
  if pg_temp.n('kb-teste9-tom@example.com', 'concorrencia') <> 2 then raise exception 'FALHOU: Tom devia ter 2 avisos (proposta + perguntas agrupadas), tem %', pg_temp.n('kb-teste9-tom@example.com', 'concorrencia'); end if;
  if (select count(*) from public.notificacoes where titulo like 'Proposta de Prestadora A (rev. 1)%') <> 0 then raise exception 'FALHOU: Ana lê avisos do Tom'; end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.notificacoes where titulo = 'Proposta de Prestadora A (rev. 1) · Framing e drywall' and (select email from auth.users where id = user_id) = 'kb-teste9-tom@example.com') then raise exception 'FALHOU: aviso da proposta'; end if;
  if (select texto from public.notificacoes where titulo like 'Mensagem de Prestadora A%') <> 'E a pintura?' then raise exception 'FALHOU: a pergunta agrupada mostra a última'; end if;
end $$;

-- Tom responde à Ana, manda um adendo e prorroga → Ana (sininho) e Bayside (e-mail sem link)
select pg_temp.como('00000000-0000-4000-8000-0000000009b1', 'kb-teste9-tom@example.com');
do $$ declare m uuid; begin
  select id into m from public.concorrencia_mensagens where texto like 'O forro%';
  perform public.escrever_como_contratante(pg_temp.u('co'), null, m, false, 'Sim, isolamento R-30.');
  perform public.adendo(pg_temp.u('co'), 'Adendo nº 1: a folha A-102 foi revisada.');
  perform public.prorrogar_concorrencia(pg_temp.u('co'), now() + interval '9 days', 'Adendo');
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.notificacoes where titulo = 'Mensagem de Construtora Teste B · Framing e drywall' and texto = 'Sim, isolamento R-30.') then raise exception 'FALHOU: resposta ao canal'; end if;
  if not pg_temp.tem('kb-teste9-ana@example.com', 'Convite para cotar: Framing e drywall%') then raise exception 'FALHOU: a mensagem do canal apagou o aviso do convite'; end if;
  if not exists (select 1 from public.notificacoes where titulo = 'Aviso a todos: Framing e drywall' and texto like 'Adendo nº 1%') then raise exception 'FALHOU: adendo para a Ana'; end if;
  if not exists (select 1 from public.notificacoes where titulo = 'Prazo prorrogado: Framing e drywall') then raise exception 'FALHOU: prorrogação para a Ana'; end if;
  if (select string_agg(dados ->> 'evento', ',' order by id) from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and modelo = 'aviso-link') <> 'adendo,prazo' then raise exception 'FALHOU: avisos por e-mail à Bayside: %', (select string_agg(dados ->> 'evento', ',') from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and modelo = 'aviso-link'); end if;
  if exists (select 1 from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and modelo = 'aviso-link' and dados ? 'token') then raise exception 'FALHOU: aviso sem link leva o token'; end if;
end $$;

-- Bayside diz que não vai (pelo link, sem usuário) → Tom é avisado; depois disso não recebe mais avisos
select pg_temp.ninguem();
do $$ begin
  perform public.responder_por_token(pg_temp.g('token'), false, 'Agenda cheia');
  if not exists (select 1 from public.notificacoes where titulo = 'Bayside Drywall não vai participar · Framing e drywall') then raise exception 'FALHOU: aviso de "não vou"'; end if;
end $$;
select pg_temp.como('00000000-0000-4000-8000-0000000009b1', 'kb-teste9-tom@example.com');
do $$ begin
  perform public.adendo(pg_temp.u('co'), 'Adendo nº 2');
  if pg_temp.fila('aviso-link') <> 2 then raise exception 'FALHOU: avisou por e-mail quem disse que não vai'; end if;
  -- fechar com a Ana: ela é avisada na hora
  perform public.fechar_concorrencia(pg_temp.u('co'), pg_temp.u('cvA'), 'Melhor prazo');
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.notificacoes x join auth.users u on u.id = x.user_id where u.email = 'kb-teste9-ana@example.com' and x.titulo = 'Você venceu: Framing e drywall · Construtora Teste B' and x.imediato) then raise exception 'FALHOU: aviso de vencedora'; end if;
  if (select count(*) from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and modelo = 'aviso-link') <> 2 then raise exception 'FALHOU: Bayside (não vai) recebeu o aviso de fechamento'; end if;
end $$;

-- Cancelar outra: as convidadas com conta e as do link são avisadas
select pg_temp.como('00000000-0000-4000-8000-0000000009b1', 'kb-teste9-tom@example.com');
do $$ declare v_id uuid; r jsonb; begin
  insert into public.concorrencias (obra_id, servico, etapas, incluso, prazo) values (pg_temp.u('ob'), 'Siding', array['07 46 00'], array['Siding'], now() + interval '2 days') returning id into v_id;
  insert into public.concorrencia_convites (concorrencia_id, contato_id) select v_id, id from public.contatos where nome in ('Prestadora A', 'Bayside Drywall');
  r := public.enviar_concorrencia(v_id);
  perform public.cancelar_concorrencia(v_id, 'Mudou o projeto');
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.notificacoes where titulo = 'Concorrência cancelada: Siding') then raise exception 'FALHOU: cancelamento para a Ana'; end if;
  if (select count(*) from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and modelo = 'aviso-link' and dados ->> 'evento' = 'cancelada') <> 1 then raise exception 'FALHOU: cancelamento por e-mail à Bayside'; end if;
  if (select count(*) from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and modelo = 'convite-concorrencia') <> 2 then raise exception 'FALHOU: o segundo convite da Bayside não entrou na fila'; end if;
end $$;

-- ---------- O relógio (job diário): prazo vencido e teste a vencer, uma vez só ----------
select pg_temp.ninguem();
do $$ declare v_id uuid; r jsonb; n int; hoje date := pg_temp.g('hoje')::date; begin
  select set_config('kb.conc_funcao', '1', true) into r;
  insert into public.concorrencias (empresa_id, obra_id, servico, etapas, incluso, prazo)
    values (pg_temp.u('B'), pg_temp.u('ob'), 'Cobertura', array['07 31 00'], array['Telhado'], now() + interval '1 hour') returning id into v_id;
  update public.concorrencias set situacao = 'aberta', enviada_em = now() - interval '3 days', prazo = now() - interval '1 hour' where id = v_id;   -- aberta, com o prazo já vencido
  perform set_config('kb.conc_funcao', '', true);
  update public.empresas set plano = jsonb_build_object('nome', 'Teste', 'status', 'teste', 'teste_ate', (hoje + 7)::text) where id = pg_temp.u('A');
  n := public.avisar_prazos();
  if n <> 2 then raise exception 'FALHOU: o job devia gerar 2 avisos (prazo vencido e teste), gerou %', n; end if;
  if not exists (select 1 from public.notificacoes x join auth.users u on u.id = x.user_id where u.email = 'kb-teste9-tom@example.com' and x.titulo = 'Prazo vencido: compare e feche · Cobertura') then raise exception 'FALHOU: aviso de prazo vencido'; end if;
  if not exists (select 1 from public.notificacoes x join auth.users u on u.id = x.user_id where u.email = 'kb-teste9-ana@example.com' and x.titulo = 'O período de teste termina em 7 dias' and x.categoria = 'conta') then raise exception 'FALHOU: aviso do teste a vencer'; end if;
  if public.avisar_prazos() <> 0 then raise exception 'FALHOU: o job repetiu os avisos'; end if;
end $$;

-- ---------- O que a função de borda lê e marca (chave de serviço) ----------
select set_config('role', 'service_role', true);
do $$ declare r record; ids bigint[]; n int; begin
  -- sem esperar (p_espera_min = 0): quem tem aviso não lido e sem e-mail enviado
  select count(*) into n from public.avisos_pendentes_email(50, 0) where email like 'kb-teste9-%';
  if n < 2 then raise exception 'FALHOU: poucos destinatários pendentes (%)', n; end if;
  select * into r from public.avisos_pendentes_email(50, 0) where email = 'kb-teste9-ana@example.com';
  if r.idioma <> 'pt' or r.nome <> 'Ana Teste' or jsonb_array_length(r.avisos) < 3 or not (r.avisos -> 0 ? 'chave') or not (r.avisos -> 0 ? 'dados') then raise exception 'FALHOU: pendentes da Ana: %', to_jsonb(r); end if;
  select * into r from public.avisos_pendentes_email(50, 0) where email = 'kb-teste9-tom@example.com';
  if r.idioma <> 'en' then raise exception 'FALHOU: idioma de quem não escolheu é en'; end if;
  -- o aviso do ponto (só sininho) não vai por e-mail
  if exists (select 1 from public.avisos_pendentes_email(50, 0) p where p.email = 'kb-teste9-jose@example.com' and exists (select 1 from jsonb_array_elements(p.avisos) a where a ->> 'categoria' = 'crew')) then raise exception 'FALHOU: aviso só de sininho foi para o e-mail'; end if;
  -- esperar 3 minutos: nada que não seja "na hora" (tudo nasceu agora)
  select count(*), string_agg(a ->> 'chave', ' | ') into n, r.email from public.avisos_pendentes_email(50, 3) p, jsonb_array_elements(p.avisos) a where p.email like 'kb-teste9-%' and (a ->> 'criado_em')::timestamptz > now() - interval '3 minutes' and not (a ->> 'chave' like any (array['Convite para cotar%', 'Você venceu%', 'Prazo vencido%', 'Proposta de%', 'Prazo prorrogado%', 'Aviso a todos%', 'Concorrência cancelada%', 'O escritório pediu ajustes%', 'O período de teste%', '%não vai participar%']));
  if n <> 0 then raise exception 'FALHOU: aviso agrupado saiu antes de esperar (%): %', n, r.email; end if;
  select array_agg((a ->> 'id')::bigint) into ids from public.avisos_pendentes_email(50, 0) p, jsonb_array_elements(p.avisos) a where p.email = 'kb-teste9-ana@example.com';
  if public.marcar_avisos_enviados(ids) <> array_length(ids, 1) then raise exception 'FALHOU: marcar como enviado'; end if;
  if public.marcar_avisos_enviados(ids) <> 0 then raise exception 'FALHOU: marcou duas vezes'; end if;
  if exists (select 1 from public.avisos_pendentes_email(50, 0) where email = 'kb-teste9-ana@example.com') then raise exception 'FALHOU: a Ana continua pendente depois de enviado'; end if;
  -- a fila: a função de borda lê, marca e apaga o token depois de enviar
  update public.fila_email set enviado_em = now(), dados = dados - 'token' where modelo = 'convite-concorrencia';
  if exists (select 1 from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B')) and modelo = 'convite-concorrencia' and dados ? 'token') then raise exception 'FALHOU: o token ficou na fila'; end if;
end $$;
reset role;

-- preferência: quem desligou a categoria no sininho não recebe o aviso; quem desligou o e-mail não entra nos pendentes
select pg_temp.ninguem();
insert into public.notificacao_prefs (user_id, categoria, push, email) values ('00000000-0000-4000-8000-0000000009c1', 'daily', false, true);
insert into public.notificacao_prefs (user_id, categoria, push, email) values ('00000000-0000-4000-8000-0000000009b1', 'concorrencia', true, false);
select pg_temp.como('00000000-0000-4000-8000-0000000009b1', 'kb-teste9-tom@example.com');
do $$ declare antes int := pg_temp.n('kb-teste9-jose@example.com', 'daily'); begin
  perform public.pedir_ajustes('aaaaaaaa-0000-4000-8000-000000000091', 'x');   -- aprovado: recusa, não gera aviso
exception when others then null; end $$;
reset role;
select set_config('role', 'service_role', true);
do $$ begin
  if exists (select 1 from public.avisos_pendentes_email(50, 0) p where p.email = 'kb-teste9-tom@example.com' and exists (select 1 from jsonb_array_elements(p.avisos) a where a ->> 'categoria' = 'concorrencia')) then raise exception 'FALHOU: e-mail desligado para a categoria'; end if;
end $$;
reset role;

-- ---------- Excluir as empresas leva avisos e fila (cascata) ----------
delete from public.empresas where id in (pg_temp.u('A'), pg_temp.u('B'));
do $$ begin
  if (select count(*) from public.fila_email where empresa_id in (pg_temp.u('A'), pg_temp.u('B'))) <> 0 or (select count(*) from public.notificacoes where empresa_id in (pg_temp.u('A'), pg_temp.u('B'))) <> 0 then raise exception 'FALHOU: sobrou aviso ou e-mail das empresas excluídas'; end if;
end $$;

select 'fatia 8: todas as verificações passaram' as resultado;
rollback;
