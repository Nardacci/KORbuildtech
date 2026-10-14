-- KORbuild · teste da fatia 1 (supabase/migrations/20261012_0001_contas_empresas.sql).
-- Tudo dentro de uma transação que termina em ROLLBACK: os usuários e empresas de teste não ficam no banco.
-- Cada verificação que falhar interrompe com 'FALHOU: …'. Se chegar ao fim, imprime 'fatia 1: todas as verificações passaram'.
-- Simula o login de cada pessoa como o Supabase faz: papel authenticated + request.jwt.claims com o id e o e-mail.

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'kb-teste-ana@example.com', '{"nome":"Ana Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b1', 'kb-teste-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c1', 'kb-teste-jose@example.com', '{}', 'authenticated', 'authenticated');

create function pg_temp.como(p_id uuid, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;
grant execute on function pg_temp.como(uuid, text) to authenticated;
create table pg_temp.guarda (chave text primary key, valor text);
grant all on pg_temp.guarda to authenticated;

-- Ana cria a empresa A; tentar de novo é recusado (uma pessoa, uma empresa)
select pg_temp.como('00000000-0000-4000-8000-0000000000a1', 'kb-teste-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Construtora Teste A","atuacao":"construtora"}')::text);
do $$ begin
  begin perform public.criar_empresa('{"nome":"Outra"}'); raise exception 'FALHOU: criou uma segunda empresa para a mesma pessoa';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  if (select count(*) from public.empresas) <> 1 then raise exception 'FALHOU: Ana deveria ver só a própria empresa'; end if;
  if (select count(*) from public.perfis_acesso) <> 4 then raise exception 'FALHOU: a empresa nasce com os 4 perfis padrão'; end if;
  if (select pa.chave from public.membros m join public.perfis_acesso pa on pa.id = m.perfil_id) <> 'administrador' then raise exception 'FALHOU: quem cria é Administrador'; end if;
  if (select modulos from public.empresas) <> array['daily'] then raise exception 'FALHOU: construtora só com o Daily (HS-09)'; end if;
end $$;

-- Tom cria a empresa B e não enxerga nada da A
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000000b1', 'kb-teste-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Prestadora Teste B"}')::text);
do $$ begin
  if (select count(*) from public.empresas) <> 1 or (select count(*) from public.membros) <> 1 then raise exception 'FALHOU: Tom vê dados de outra empresa'; end if;
  if exists (select 1 from public.perfis_acesso where empresa_id = (select valor::uuid from pg_temp.guarda where chave = 'A')) then raise exception 'FALHOU: Tom vê os perfis da empresa A'; end if;
  update public.empresas set nome = 'invadida' where id = (select valor::uuid from pg_temp.guarda where chave = 'A');
  if found then raise exception 'FALHOU: Tom alterou a empresa A'; end if;
  if (select modulos from public.empresas) <> array['daily','crew','measure'] then raise exception 'FALHOU: prestadora com Daily, Crew e Measure'; end if;
end $$;

-- Ana convida José como Trabalhador; outro e-mail não aceita; José aceita
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000000a1', 'kb-teste-ana@example.com');
insert into pg_temp.guarda values ('token', public.convidar_usuario('KB-Teste-Jose@example.com ', 'José Teste',
  (select id from public.perfis_acesso where chave = 'trabalhador')));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000000b1', 'kb-teste-tom@example.com');
do $$ begin
  begin perform public.aceitar_convite((select valor from pg_temp.guarda where chave = 'token')); raise exception 'FALHOU: Tom aceitou o convite de outro e-mail';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000000c1', 'kb-teste-jose@example.com');
do $$ begin
  if public.aceitar_convite((select valor from pg_temp.guarda where chave = 'token')) <> (select valor::uuid from pg_temp.guarda where chave = 'A') then raise exception 'FALHOU: José não entrou na empresa A'; end if;
  begin perform public.aceitar_convite((select valor from pg_temp.guarda where chave = 'token')); raise exception 'FALHOU: o convite foi usado duas vezes';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- José (Trabalhador) não altera a empresa, não vê a auditoria e não convida
  update public.empresas set nome = 'mudada' where true;
  if found then raise exception 'FALHOU: Trabalhador alterou a empresa'; end if;
  if exists (select 1 from public.auditoria) then raise exception 'FALHOU: Trabalhador vê a auditoria'; end if;
  begin perform public.convidar_usuario('x@example.com', 'X', (select id from public.perfis_acesso where chave = 'trabalhador')); raise exception 'FALHOU: Trabalhador convidou';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- Administrador travado; ninguém tira o próprio acesso; a empresa nunca fica sem quem cuide dos acessos
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000000a1', 'kb-teste-ana@example.com');
do $$ begin
  begin update public.perfis_acesso set permissoes = '{}' where chave = 'administrador'; raise exception 'FALHOU: alterou o Administrador';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin update public.membros set ativo = false where user_id = auth.uid(); raise exception 'FALHOU: Ana tirou o próprio acesso';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin delete from public.perfis_acesso where chave = 'trabalhador'; raise exception 'FALHOU: excluiu um perfil em uso';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- Ana pode mudar o perfil do José; a mudança vai para a auditoria da empresa A
  update public.membros set perfil_id = (select id from public.perfis_acesso where chave = 'encarregado') where user_id = '00000000-0000-4000-8000-0000000000c1';
  if not exists (select 1 from public.auditoria where tabela = 'membros' and acao = 'update') then raise exception 'FALHOU: mudança de perfil fora da auditoria'; end if;
  if exists (select 1 from public.auditoria where empresa_id <> (select valor::uuid from pg_temp.guarda where chave = 'A')) then raise exception 'FALHOU: Ana vê auditoria de outra empresa'; end if;
end $$;

-- Sem login (anon) não se lê nada
reset role;
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  -- desde a migração 13, anon nem tem privilégio nas tabelas: "permission denied" também é o resultado certo
  begin
    if exists (select 1 from public.empresas) or exists (select 1 from public.membros) then raise exception 'FALHOU: anônimo leu dados'; end if;
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select 'fatia 1: todas as verificações passaram' as resultado;

rollback;
