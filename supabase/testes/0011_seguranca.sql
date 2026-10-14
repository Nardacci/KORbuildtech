-- KORbuild · teste de SEGURANÇA (supabase/migrations/20261022_0013_endurecimento.sql e tudo o que veio antes).
-- Duas partes: (1) o catálogo do banco inteiro (nenhuma tabela sem RLS, nenhum privilégio sobrando para anon, nenhuma função perigosa
-- aberta) e (2) ataques de verdade, feitos como um usuário comum de uma empresa (subir o próprio plano, mudar de empresa, virar administrador
-- da plataforma, escrever nos registros de auditoria, ler a empresa do vizinho). Tudo em uma transação que termina em ROLLBACK.
-- Cada verificação que falhar interrompe com 'FALHOU: …'. Se chegar ao fim, imprime 'segurança: todas as verificações passaram'.
-- Roda no banco com a massa de demonstração também: só olha o catálogo e cria os próprios usuários (kb-sec-…@example.com).

begin;

-- ---------- 1. O catálogo ----------
do $$ declare l text; begin
  -- toda tabela do schema public tem RLS ligada
  select string_agg(c.relname, ', ') into l from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if l is not null then raise exception 'FALHOU: tabelas sem RLS: %', l; end if;

  -- views do schema public rodam com os privilégios de quem consulta (senão furam a RLS)
  select string_agg(c.relname, ', ') into l from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v' and not coalesce(c.reloptions @> array['security_invoker=true'], false);
  if l is not null then raise exception 'FALHOU: views sem security_invoker (furam a RLS): %', l; end if;

  -- anon (quem não entrou) não tem privilégio nenhum em tabela do app
  select string_agg(distinct table_name, ', ') into l from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon';
  if l is not null then raise exception 'FALHOU: anon tem privilégio nestas tabelas: %', l; end if;

  -- quem entrou (authenticated) não precisa de TRUNCATE, REFERENCES nem TRIGGER em nenhuma tabela (TRUNCATE passa por cima da RLS)
  select string_agg(distinct table_name || ':' || privilege_type, ', ') into l from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER');
  if l is not null then raise exception 'FALHOU: authenticated com privilégio perigoso: %', l; end if;

  -- toda função SECURITY DEFINER fixa o search_path (senão um usuário pode sombrear uma função do sistema)
  select string_agg(p.proname, ', ') into l from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if l is not null then raise exception 'FALHOU: SECURITY DEFINER sem search_path fixo: %', l; end if;

  -- anon só executa o que é público de propósito: o link do diário aprovado (e nenhuma função que devolva "gatilho")
  select string_agg(p.proname, ', ') into l from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('diario_por_codigo');
  if l is not null then raise exception 'FALHOU: anon executa estas funções: %', l; end if;

  -- função que liga o "modo sistema" (pula as travas dos registros) não pode estar ao alcance de quem entrou
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ligar_sistema'
              and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))) then
    raise exception 'FALHOU: ligar_sistema() está ao alcance de authenticated/anon';
  end if;

  -- nenhuma política "libera tudo" (using true) para anon, public ou authenticated nas tabelas do app e no Storage
  select string_agg(tablename || '.' || policyname, ', ') into l from pg_policies
   where schemaname in ('public', 'storage') and (trim(qual) = 'true' or trim(with_check) = 'true' or roles && array['anon', 'public']::name[]);
  if l is not null then raise exception 'FALHOU: políticas abertas demais: %', l; end if;

  -- todo bucket do Storage é privado (as fotos e plantas só saem por link assinado)
  select string_agg(id, ', ') into l from storage.buckets where public;
  if l is not null then raise exception 'FALHOU: buckets públicos: %', l; end if;

  -- todo bucket tem tamanho máximo e tipos de arquivo permitidos (sem isso qualquer pessoa de uma empresa enche o disco com qualquer coisa)
  select string_agg(id, ', ') into l from storage.buckets where file_size_limit is null or allowed_mime_types is null;
  if l is not null then raise exception 'FALHOU: buckets sem limite de tamanho ou de tipo: %', l; end if;
end $$;

-- ---------- 2. Ataques como usuário comum ----------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-00000000a501', 'kb-sec-ana@example.com', '{"nome":"Ana Sec"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000b501', 'kb-sec-tom@example.com', '{"nome":"Tom Sec"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000c501', 'kb-sec-sem@example.com', '{"nome":"Sem Empresa"}', 'authenticated', 'authenticated');

create function pg_temp.como(p_id uuid, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;
grant execute on function pg_temp.como(uuid, text) to authenticated;
create function pg_temp.anonimo() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true), set_config('request.jwt.claim.sub', '', true)
$$;
grant execute on function pg_temp.anonimo() to anon, authenticated;
create table pg_temp.guarda (chave text primary key, valor text);
grant all on pg_temp.guarda to authenticated, anon;

select pg_temp.como('00000000-0000-4000-8000-00000000a501', 'kb-sec-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Sec A","atuacao":"prestadora"}')::text);
reset role;
select pg_temp.como('00000000-0000-4000-8000-00000000b501', 'kb-sec-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Sec B","atuacao":"construtora"}')::text);
reset role;

-- Ana (administradora da A) tenta subir o próprio plano, os módulos, a atuação e a data de criação: o app nunca faz isso, só a plataforma
select pg_temp.como('00000000-0000-4000-8000-00000000a501', 'kb-sec-ana@example.com');
do $$
declare a uuid := (select valor::uuid from pg_temp.guarda where chave = 'A'); antes jsonb; r int;
begin
  select plano into antes from public.empresas where id = a;
  foreach r in array array[1, 2, 3, 4, 5] loop
    begin
      if r = 1 then update public.empresas set plano = '{"nome":"Enterprise","status":"ativa","limite_obras":9999,"limite_usuarios":9999}'::jsonb where id = a;
      elsif r = 2 then update public.empresas set modulos = array['daily', 'crew', 'measure', 'plataforma'] where id = a;
      elsif r = 3 then update public.empresas set atuacao = 'construtora' where id = a;
      elsif r = 4 then update public.empresas set criada_em = now() + interval '5 years' where id = a;
      else update public.empresas set id = gen_random_uuid() where id = a; end if;
      raise exception 'FALHOU: a administradora da empresa conseguiu mudar plano/módulos/atuação/identidade da própria empresa (tentativa %)', r;
    exception when insufficient_privilege then null;
    end;
  end loop;
  if (select plano from public.empresas where id = a) is distinct from antes then raise exception 'FALHOU: o plano da empresa mudou'; end if;
  -- o que o app edita continua funcionando
  update public.empresas set nome = 'Sec A Ltda', telefone = '603-555-0100', cidade = 'Concord', licencas = 'Contractor license 123', logo_path = null, configuracao = '{"localizacao":{}}'::jsonb where id = a;
  if (select nome from public.empresas where id = a) <> 'Sec A Ltda' then raise exception 'FALHOU: o perfil da empresa deveria poder ser editado'; end if;
end $$;
reset role;

-- Ana tenta mexer na empresa do Tom, nos membros e nos perfis dele
select pg_temp.como('00000000-0000-4000-8000-00000000a501', 'kb-sec-ana@example.com');
do $$
declare a uuid := (select valor::uuid from pg_temp.guarda where chave = 'A'); b uuid := (select valor::uuid from pg_temp.guarda where chave = 'B'); n int; pb uuid; mb uuid;
begin
  if exists (select 1 from public.empresas where id = b) then raise exception 'FALHOU: Ana enxerga a empresa B'; end if;
  update public.empresas set nome = 'Invadida' where id = b; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: Ana alterou a empresa B'; end if;
  delete from public.empresas where id = b; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: Ana apagou a empresa B'; end if;
  begin insert into public.empresas (nome) values ('Clone'); raise exception 'FALHOU: Ana inseriu uma empresa direto na tabela';
  exception when insufficient_privilege or others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- mudar o próprio vínculo para a empresa B, ou o perfil para um perfil da B
  select id into pb from public.perfis_acesso where empresa_id = a limit 1;
  begin update public.membros set empresa_id = b where user_id = auth.uid(); get diagnostics n = row_count;
    if n > 0 then raise exception 'FALHOU: Ana se mudou para a empresa B'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin update public.membros set user_id = '00000000-0000-4000-8000-00000000b501' where user_id = auth.uid(); get diagnostics n = row_count;
    if n > 0 then raise exception 'FALHOU: Ana trocou o dono do vínculo'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  reset role;
  select id into pb from public.perfis_acesso where empresa_id = b and chave = 'administrador';
  perform pg_temp.como('00000000-0000-4000-8000-00000000a501', 'kb-sec-ana@example.com');
  begin update public.membros set perfil_id = pb where user_id = auth.uid(); get diagnostics n = row_count;
    if n > 0 then raise exception 'FALHOU: Ana assumiu um perfil da empresa B'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- perfis_acesso da B: nem ver, nem mudar permissões
  update public.perfis_acesso set permissoes = '{}' where empresa_id = b; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: Ana alterou perfis da empresa B'; end if;
end $$;
reset role;

-- Virar administrador da plataforma, ler/escrever os registros da plataforma, chamar o painel
select pg_temp.como('00000000-0000-4000-8000-00000000a501', 'kb-sec-ana@example.com');
do $$
declare n int; f record;
begin
  begin insert into public.admins_plataforma (user_id) values ('00000000-0000-4000-8000-00000000a501'); raise exception 'FALHOU: Ana se cadastrou como administradora da plataforma';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  if public.eh_admin_plataforma() then raise exception 'FALHOU: Ana aparece como administradora da plataforma'; end if;
  if exists (select 1 from public.admins_plataforma) then raise exception 'FALHOU: Ana enxerga a lista de administradores da plataforma'; end if;
  begin insert into public.admin_log (admin_id, acao) values ('00000000-0000-4000-8000-00000000a501', 'x'); raise exception 'FALHOU: Ana escreveu no registro da plataforma';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin update public.admin_log set acao = 'apagado'; get diagnostics n = row_count; if n > 0 then raise exception 'FALHOU: Ana alterou o registro da plataforma'; end if;
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- todas as funções admin_* recusam quem não é da plataforma (chamadas com NULL em todos os argumentos: o teste de acesso vem antes de tudo)
  for f in select p.oid, p.proname, p.pronargs from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.proname like 'admin\_%' and p.proname not in ('admin_exigir') and has_function_privilege('authenticated', p.oid, 'execute') loop
    begin
      execute format('select public.%I(%s)', f.proname, (select coalesce(string_agg('null', ','), '') from generate_series(1, f.pronargs)));
      raise exception 'FALHOU: % respondeu a quem não é administrador da plataforma', f.proname;
    exception when others then
      if sqlerrm like 'FALHOU%' then raise; end if;
      if sqlerrm not like '%Sem acesso%' and sqlstate <> '42883' then raise exception 'FALHOU: % recusou por outro motivo (o teste de acesso deveria vir primeiro): %', f.proname, sqlerrm; end if;
    end;
  end loop;
end $$;
reset role;

-- Avisos: quem recebe só pode marcar como lido; não escreve aviso para os outros nem muda o texto
select pg_temp.como('00000000-0000-4000-8000-00000000a501', 'kb-sec-ana@example.com');
do $$ declare n int; begin
  begin insert into public.notificacoes (user_id, categoria, titulo) values ('00000000-0000-4000-8000-00000000b501', 'daily', 'Phishing'); raise exception 'FALHOU: Ana escreveu um aviso para o Tom';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.fila_email (empresa_id, para_email, modelo) values ((select valor::uuid from pg_temp.guarda where chave = 'A'), 'vitima@example.com', 'aviso-link'); raise exception 'FALHOU: Ana escreveu na fila de e-mails';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin
    if exists (select 1 from public.fila_email) then raise exception 'FALHOU: Ana lê a fila de e-mails'; end if;
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Anônimo (sem entrar): nada de tabela, nenhuma função do app
select pg_temp.anonimo();
do $$ declare t text; n int; begin
  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then raise exception 'FALHOU: anon lê % linhas de %', n, t; end if;
    exception when insufficient_privilege then null; end;
  end loop;
  begin perform public.criar_empresa('{"nome":"Anon"}'); raise exception 'FALHOU: anon criou uma empresa';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- Quem entrou mas ainda não tem empresa não vê nenhuma empresa e não escreve em nada
select pg_temp.como('00000000-0000-4000-8000-00000000c501', 'kb-sec-sem@example.com');
do $$ begin
  if exists (select 1 from public.empresas) or exists (select 1 from public.membros) or exists (select 1 from public.perfis_acesso) then
    raise exception 'FALHOU: quem não tem empresa enxerga dados de empresas';
  end if;
end $$;
reset role;

do $$ begin raise notice 'segurança: todas as verificações passaram'; end $$;
rollback;
