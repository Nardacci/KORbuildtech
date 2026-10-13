-- KORbuild · teste da fatia 8c (supabase/migrations/20261021_0012_plataforma.sql): a administração da plataforma.
-- Tudo dentro de uma transação que termina em ROLLBACK (inclusive o apagar de administradores de teste logo abaixo).
-- Cada verificação que falhar interrompe com 'FALHOU: …'.
-- Pessoas: Adm (administrador da plataforma; também dono da empresa C), Ana (Administradora da prestadora A),
--          Tom (Administrador da construtora B), José (Encarregado da A; sem acesso a nada de administração).

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-000000000a01', 'kb-testea-adm@example.com', '{"nome":"Adm Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000a02', 'kb-testea-ana@example.com', '{"nome":"Ana Teste","idioma":"pt"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000a03', 'kb-testea-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-000000000a04', 'kb-testea-jose@example.com', '{}', 'authenticated', 'authenticated');

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
create function pg_temp.n(p_email text, p_cat text default null) returns int language sql security definer as $$
  select count(*)::int from public.notificacoes x join auth.users u on u.id = x.user_id where u.email = p_email and (p_cat is null or x.categoria = p_cat) $$;
create function pg_temp.nlog(p_empresa uuid, p_acao text) returns int language sql security definer as $$
  select count(*)::int from public.admin_log where (p_empresa is null or empresa_id = p_empresa) and acao = p_acao $$;
create function pg_temp.naud(p_empresa uuid) returns int language sql security definer as $$
  select count(*)::int from public.auditoria where empresa_id = p_empresa and tabela = 'empresas' and acao = 'plano' and motivo like 'Plataforma: %' $$;
grant execute on function pg_temp.n(text, text), pg_temp.nlog(uuid, text), pg_temp.naud(uuid) to authenticated;

-- só o Adm administra a plataforma neste teste (os outros administradores de verdade ficam como estavam: é tudo ROLLBACK)
delete from public.admins_plataforma;
insert into public.admins_plataforma (user_id) values ('00000000-0000-4000-8000-000000000a01');

-- ---------- Empresas ----------
select pg_temp.como('00000000-0000-4000-8000-000000000a01', 'kb-testea-adm@example.com');
insert into pg_temp.guarda values ('C', public.criar_empresa('{"nome":"Empresa Plataforma C","atuacao":"ambas"}')::text);
reset role;
select pg_temp.como('00000000-0000-4000-8000-000000000a02', 'kb-testea-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Prestadora Teste A","atuacao":"prestadora"}')::text);
insert into pg_temp.guarda values ('tj', public.convidar_usuario('kb-testea-jose@example.com', 'José Teste', (select id from public.perfis_acesso where chave = 'encarregado')));
reset role;
select pg_temp.como('00000000-0000-4000-8000-000000000a03', 'kb-testea-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Construtora Teste B","atuacao":"construtora"}')::text);
reset role;
select pg_temp.como('00000000-0000-4000-8000-000000000a04', 'kb-testea-jose@example.com');
select public.aceitar_convite(pg_temp.g('tj'));
reset role;

-- ---------- Empresa nova: teste de 14 dias e a configuração padrão ----------
do $$ declare a public.empresas; begin
  select * into a from public.empresas where id = pg_temp.u('A');
  if a.plano ->> 'status' <> 'teste' or a.plano ->> 'nome' <> 'Teste' or (a.plano ->> 'teste_ate')::date <> current_date + 14 or a.configuracao <> '{}'::jsonb then raise exception 'FALHOU: empresa nova: %', to_jsonb(a); end if;
end $$;

-- ---------- Só o administrador da plataforma entra ----------
select pg_temp.como('00000000-0000-4000-8000-000000000a02', 'kb-testea-ana@example.com');
do $$ begin
  if public.eh_admin_plataforma() then raise exception 'FALHOU: Ana é administradora da plataforma?'; end if;
  begin perform public.admin_empresas(); raise exception 'FALHOU: Ana listou as empresas';
  exception when others then if sqlerrm not like 'Sem acesso%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_alterar_plano(pg_temp.u('A'), '{"status":"ativa"}', 'quero'); raise exception 'FALHOU: Ana mudou o próprio plano';
  exception when others then if sqlerrm not like 'Sem acesso%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_valores_padrao(); raise exception 'FALHOU: Ana leu os valores padrão';
  exception when others then if sqlerrm not like 'Sem acesso%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_definir('kb-testea-ana@example.com', true); raise exception 'FALHOU: Ana se fez administradora';
  exception when others then if sqlerrm not like 'Sem acesso%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform * from public.admin_fila_email(); raise exception 'FALHOU: Ana leu a fila de e-mails';
  exception when others then if sqlerrm not like 'Sem acesso%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin insert into public.admins_plataforma (user_id) values (auth.uid()); raise exception 'FALHOU: Ana se inseriu na tabela';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform count(*) from public.plataforma; raise exception 'FALHOU: Ana leu a tabela da plataforma';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.admin_log; raise exception 'FALHOU: Ana leu o registro da plataforma';
  exception when insufficient_privilege then null; end;
  if not public.empresa_ativa() then raise exception 'FALHOU: empresa em teste devia estar ativa'; end if;
end $$;
reset role;

-- ---------- O administrador: lista, detalhe e busca ----------
select pg_temp.como('00000000-0000-4000-8000-000000000a01', 'kb-testea-adm@example.com');
do $$ declare x jsonb; d jsonb; n int; begin
  if not public.eh_admin_plataforma() then raise exception 'FALHOU: Adm devia ser administrador'; end if;
  select count(*) into n from public.admin_empresas('Teste A');
  if n <> 1 then raise exception 'FALHOU: busca por nome (%)', n; end if;
  select e into x from public.admin_empresas('Prestadora Teste') e;
  if x ->> 'nome' <> 'Prestadora Teste A' or (x ->> 'usuarios')::int <> 2 or (x ->> 'dias_de_teste')::int <> 14 or x -> 'plano' ->> 'status' <> 'teste' or jsonb_array_length(x -> 'modulos') <> 3 then raise exception 'FALHOU: linha da lista: %', x; end if;
  if (select count(*) from public.admin_empresas()) < 3 then raise exception 'FALHOU: a lista devia ter as 3 empresas do teste'; end if;
  d := public.admin_empresa(pg_temp.u('A'));
  if jsonb_array_length(d -> 'pessoas') <> 2 or not exists (select 1 from jsonb_array_elements(d -> 'pessoas') p where p ->> 'email' = 'kb-testea-ana@example.com' and p ->> 'perfil' = 'Administrador') or d -> 'empresa' ? 'logo_path' then raise exception 'FALHOU: detalhe da empresa: %', d; end if;
  begin perform public.admin_empresa(gen_random_uuid()); raise exception 'FALHOU: empresa que não existe';
  exception when others then if sqlerrm not like 'Empresa não encontrada%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
end $$;

-- ---------- Valores padrão: valem para as empresas novas ----------
do $$ declare v jsonb; begin
  v := public.admin_valores_padrao();
  if (v ->> 'teste_dias')::int <> 14 then raise exception 'FALHOU: padrão de 14 dias'; end if;
  begin perform public.admin_valores_padrao('{"teste_dias":0}'); raise exception 'FALHOU: aceitou 0 dias';
  exception when others then if sqlerrm not like 'Dias de teste%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_valores_padrao('{"outra":1}'); raise exception 'FALHOU: aceitou valor desconhecido';
  exception when others then if sqlerrm not like 'Valor padrão desconhecido%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  v := public.admin_valores_padrao('{"teste_dias":30,"configuracao":{"localizacao":{"gps_min":9}}}');
  if (v ->> 'teste_dias')::int <> 30 then raise exception 'FALHOU: valores gravados'; end if;
end $$;
reset role;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values ('00000000-0000-4000-8000-000000000a05', 'kb-testea-eva@example.com', '{"nome":"Eva Teste"}', 'authenticated', 'authenticated');
select pg_temp.como('00000000-0000-4000-8000-000000000a05', 'kb-testea-eva@example.com');
insert into pg_temp.guarda values ('E', public.criar_empresa('{"nome":"Empresa Nova E","atuacao":"prestadora"}')::text);
reset role;
do $$ declare e public.empresas; begin
  select * into e from public.empresas where id = pg_temp.u('E');
  if (e.plano ->> 'teste_ate')::date <> current_date + 30 or e.configuracao -> 'localizacao' ->> 'gps_min' <> '9' then raise exception 'FALHOU: a empresa nova não pegou os valores padrão: %', to_jsonb(e); end if;
  if (select (plano ->> 'teste_ate')::date from public.empresas where id = pg_temp.u('A')) <> current_date + 14 then raise exception 'FALHOU: mudar o padrão não pode mexer nas empresas que já existem'; end if;
end $$;

-- ---------- Mudar o plano: regras, registro, auditoria e aviso ----------
select pg_temp.como('00000000-0000-4000-8000-000000000a01', 'kb-testea-adm@example.com');
do $$ declare p jsonb; begin
  begin perform public.admin_alterar_plano(pg_temp.u('A'), '{"status":"ativa"}', ' '); raise exception 'FALHOU: mudou sem motivo';
  exception when others then if sqlerrm not like 'Diga o motivo%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_alterar_plano(pg_temp.u('A'), '{"status":"gratis"}', 'teste'); raise exception 'FALHOU: situação inventada';
  exception when others then if sqlerrm not like 'Situação inválida%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_alterar_plano(pg_temp.u('A'), '{"teste_ate":"amanhã"}', 'teste'); raise exception 'FALHOU: data inválida';
  exception when others then if sqlerrm not like 'Data do fim do teste%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_alterar_plano(pg_temp.u('A'), '{"limite_obras":-1}', 'teste'); raise exception 'FALHOU: limite negativo';
  exception when others then if sqlerrm not like 'Limite inválido%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_alterar_plano(pg_temp.u('A'), '{"preco":10}', 'teste'); raise exception 'FALHOU: campo desconhecido';
  exception when others then if sqlerrm not like 'Campo do plano desconhecido%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  p := public.admin_alterar_plano(pg_temp.u('A'), '{"status":"ativa","nome":"Profissional","limite_obras":5,"limite_usuarios":10}', 'Assinou o plano Profissional');
  if p ->> 'status' <> 'ativa' or p ->> 'nome' <> 'Profissional' or (p ->> 'limite_obras')::int <> 5 or p ->> 'teste_ate' is null then raise exception 'FALHOU: plano novo (o resto fica): %', p; end if;
  p := public.admin_alterar_plano(pg_temp.u('A'), '{"limite_obras":null,"teste_ate":null}', 'Sem limite e sem data de teste');
  if p ? 'limite_obras' or p ? 'teste_ate' or (p ->> 'limite_usuarios')::int <> 10 then raise exception 'FALHOU: null remove a chave: %', p; end if;
  if pg_temp.nlog(pg_temp.u('A'), 'plano') <> 2 then raise exception 'FALHOU: o registro da plataforma'; end if;
  if pg_temp.naud(pg_temp.u('A')) <> 2 then raise exception 'FALHOU: auditoria da empresa'; end if;
  if (public.admin_empresa(pg_temp.u('A')) -> 'log' -> 0 ->> 'quem') <> 'kb-testea-adm@example.com' then raise exception 'FALHOU: o log mostra quem'; end if;
  -- quem administra a conta é avisado (sininho e e-mail na hora); o José, que não administra, não
  if pg_temp.n('kb-testea-ana@example.com', 'conta') <> 2 or pg_temp.n('kb-testea-jose@example.com', 'conta') <> 0 then raise exception 'FALHOU: avisos do plano (Ana %, José %)', pg_temp.n('kb-testea-ana@example.com', 'conta'), pg_temp.n('kb-testea-jose@example.com', 'conta'); end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.notificacoes x join auth.users u on u.id = x.user_id where u.email = 'kb-testea-ana@example.com' and x.titulo = 'O plano da sua empresa foi alterado pelo KORbuild' and x.texto = 'Sem limite e sem data de teste' and x.imediato) then raise exception 'FALHOU: texto e urgência do aviso do plano'; end if;
  -- o registro da plataforma só entra
  begin update public.admin_log set acao = 'x'; raise exception 'FALHOU: alterou o registro da plataforma';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from public.admin_log; raise exception 'FALHOU: apagou o registro da plataforma';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ---------- Suspensa: não grava; lê e entra normalmente; reativar volta ----------
select pg_temp.como('00000000-0000-4000-8000-000000000a01', 'kb-testea-adm@example.com');
select public.admin_alterar_plano(pg_temp.u('A'), '{"status":"suspensa"}', 'Pagamento em atraso há 60 dias');
reset role;
select pg_temp.como('00000000-0000-4000-8000-000000000a02', 'kb-testea-ana@example.com');
do $$ begin
  if public.empresa_ativa() then raise exception 'FALHOU: empresa suspensa devia dizer que não está ativa'; end if;
  begin insert into public.contatos (nome, papeis) values ('Fornecedor', array['fornecedor']); raise exception 'FALHOU: gravou numa conta suspensa';
  exception when others then if sqlerrm not like 'Esta conta está suspensa%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.convidar_usuario('kb-testea-novo@example.com', 'Novo', (select id from public.perfis_acesso where chave = 'gestor')); raise exception 'FALHOU: convidou numa conta suspensa';
  exception when others then if sqlerrm not like 'Esta conta está suspensa%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin update public.empresas set telefone = '1' where id = pg_temp.u('A'); raise exception 'FALHOU: editou a empresa suspensa (não deve, a menos que o perfil...)';
  exception when others then if sqlerrm like 'FALHOU%' then null; end if; end;
  perform count(*) from public.contatos;                     -- ler continua
  perform public.registrar_acesso();                           -- entrar continua
  if (select count(*) from public.membros) < 2 then raise exception 'FALHOU: leitura dos usuários'; end if;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-000000000a03', 'kb-testea-tom@example.com');
insert into public.contatos (nome, papeis) values ('Dono', array['cliente']);   -- a outra empresa segue normal
reset role;
select pg_temp.como('00000000-0000-4000-8000-000000000a01', 'kb-testea-adm@example.com');
select public.admin_alterar_plano(pg_temp.u('A'), '{"status":"ativa"}', 'Pagou');
reset role;
select pg_temp.como('00000000-0000-4000-8000-000000000a02', 'kb-testea-ana@example.com');
insert into public.contatos (nome, papeis) values ('Fornecedor', array['fornecedor']);   -- reativada: grava
reset role;

-- ---------- Módulos ----------
select pg_temp.como('00000000-0000-4000-8000-000000000a01', 'kb-testea-adm@example.com');
do $$ declare m text[]; begin
  begin perform public.admin_alterar_modulos(pg_temp.u('A'), array['daily', 'folha'], 'x ok'); raise exception 'FALHOU: módulo inventado';
  exception when others then if sqlerrm not like 'Módulos inválidos%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_alterar_modulos(pg_temp.u('A'), array[]::text[], 'sem nada'); raise exception 'FALHOU: sem nenhum módulo';
  exception when others then if sqlerrm not like 'Módulos inválidos%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_alterar_modulos(pg_temp.u('B'), array['daily', 'crew'], 'construtora com ponto'); raise exception 'FALHOU: construtora com o Crew';
  exception when others then if sqlerrm not like 'A construtora só usa o Daily%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  m := public.admin_alterar_modulos(pg_temp.u('A'), array['measure', 'daily', 'daily'], 'Só Daily e Measure');
  if m <> array['daily', 'measure'] or (select modulos from public.empresas where id = pg_temp.u('A')) <> array['daily', 'measure'] then raise exception 'FALHOU: módulos gravados: %', m; end if;
  if pg_temp.nlog(pg_temp.u('A'), 'modulos') <> 1 then raise exception 'FALHOU: registro dos módulos'; end if;
end $$;

-- ---------- A fila de e-mails e os administradores ----------
do $$ declare r jsonb; x jsonb; begin
  select e into x from public.admin_fila_email() e where e ->> 'modelo' = 'convite-usuario' limit 1;
  if x is null or x ->> 'para_email' <> 'kb-testea-jose@example.com' or x ->> 'empresa' <> 'Prestadora Teste A' or x ->> 'idioma' <> 'pt' or x ? 'dados' or x::text like '%token%' then raise exception 'FALHOU: a fila sem o token: %', x; end if;
  r := public.admin_resumo_email();
  if (r ->> 'fila_pendente')::int < 1 or not (r ? 'avisos_pendentes') then raise exception 'FALHOU: resumo: %', r; end if;
  if not public.admin_reenviar((x ->> 'id')::bigint) then raise exception 'FALHOU: reenviar'; end if;
  if public.admin_reenviar(-1) then raise exception 'FALHOU: reenviar o que não existe'; end if;
  begin perform public.admin_definir('ninguem@example.com', true); raise exception 'FALHOU: administrador sem usuário';
  exception when others then if sqlerrm not like 'Não há usuário%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  begin perform public.admin_definir('kb-testea-adm@example.com', false); raise exception 'FALHOU: tirou o último administrador';
  exception when others then if sqlerrm not like 'Não dá para tirar o último%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
  perform public.admin_definir('KB-TesteA-Tom@example.com', true);
  if (select count(*) from public.admin_administradores()) <> 2 then raise exception 'FALHOU: dois administradores'; end if;
  perform public.admin_definir('kb-testea-adm@example.com', false);   -- agora pode: sobra o Tom (e o Adm perde o acesso na mesma hora)
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-000000000a01', 'kb-testea-adm@example.com');
do $$ begin
  begin perform public.admin_empresas(); raise exception 'FALHOU: ex-administrador ainda entra';
  exception when others then if sqlerrm not like 'Sem acesso%' then raise exception 'FALHOU: %', sqlerrm; end if; end;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-000000000a03', 'kb-testea-tom@example.com');
do $$ begin
  if (select count(*) from public.admin_administradores()) <> 1 or (select e ->> 'email' from public.admin_administradores() e) <> 'kb-testea-tom@example.com' then raise exception 'FALHOU: sobrou só o Tom como administrador'; end if;
  if pg_temp.nlog(null, 'administrador') <> 2 then raise exception 'FALHOU: registro dos administradores'; end if;
end $$;
reset role;

-- ---------- Excluir empresas: o registro da plataforma fica, sem o vínculo ----------
delete from public.empresas where id in (pg_temp.u('A'), pg_temp.u('B'), pg_temp.u('C'), pg_temp.u('E'));
do $$ begin
  if exists (select 1 from public.admin_log where empresa_id in (pg_temp.u('A'), pg_temp.u('B'), pg_temp.u('C'), pg_temp.u('E'))) then raise exception 'FALHOU: o registro da plataforma ficou apontando empresa excluída'; end if;
  if (select count(*) from public.admin_log where acao = 'plano') <> 4 then raise exception 'FALHOU: o registro da plataforma devia ficar (4 mudanças de plano)'; end if;
end $$;

select 'fatia 8c: todas as verificações passaram' as resultado;
rollback;
