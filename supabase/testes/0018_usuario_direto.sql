-- KORbuild · teste da migração 0026: cadastro direto pelo administrador (preparar_usuario_direto, finalizar_usuario_direto, preparar_nova_senha).
-- Tudo dentro de uma transação que termina em ROLLBACK. Se chegar ao fim, imprime 'usuario direto: todas as verificacoes passaram'.

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000018a1', 'kb-teste18-ana@example.com', '{"nome":"Ana Dezoito"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000018b1', 'kb-teste18-beto@example.com', '{"nome":"Beto Dezoito"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000018c1', 'kb-teste18-cris@example.com', '{"nome":"Cris Dezoito"}', 'authenticated', 'authenticated');

create function pg_temp.como(p_id uuid, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;
grant execute on function pg_temp.como(uuid, text) to authenticated;
create function pg_temp.erra(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return null; exception when others then return sqlerrm; end $$;
grant execute on function pg_temp.erra(text) to authenticated, service_role;

-- Ana: empresa A (administradora). Cris: empresa C (administradora de outra empresa). Beto: entra na A como Gestor de obras (sem settings.acesso).
select pg_temp.como('00000000-0000-4000-8000-0000000018a1', 'kb-teste18-ana@example.com');
select public.criar_empresa('{"nome":"Empresa A Dezoito","atuacao":"prestadora"}');
select pg_temp.como('00000000-0000-4000-8000-0000000018c1', 'kb-teste18-cris@example.com');
select public.criar_empresa('{"nome":"Empresa C Dezoito","atuacao":"prestadora"}');
reset role;
insert into public.membros (empresa_id, user_id, perfil_id, nome)
  select e.id, '00000000-0000-4000-8000-0000000018b1', pa.id, 'Beto Dezoito' from public.empresas e join public.perfis_acesso pa on pa.empresa_id = e.id and pa.chave = 'gestor' where e.nome = 'Empresa A Dezoito';

create temp table cena as select
  (select pa.id from public.perfis_acesso pa join public.empresas e on e.id = pa.empresa_id where e.nome = 'Empresa A Dezoito' and pa.chave = 'encarregado') as perfil_a,
  (select pa.id from public.perfis_acesso pa join public.empresas e on e.id = pa.empresa_id where e.nome = 'Empresa C Dezoito' and pa.chave = 'encarregado') as perfil_c,
  (select id from public.empresas where nome = 'Empresa A Dezoito') as emp_a;
grant select on cena to authenticated, service_role;

-- 1) a administradora prepara um e-mail novo: devolve a empresa dela
select pg_temp.como('00000000-0000-4000-8000-0000000018a1', 'kb-teste18-ana@example.com');
do $$ declare r uuid; begin
  r := public.preparar_usuario_direto('Novo.Pessoa@Example.com', (select perfil_a from cena));
  if r is distinct from (select emp_a from cena) then raise exception 'FALHA 1: devia devolver a empresa da administradora'; end if;
end $$;

-- 2) quem não tem settings.acesso (Beto, Gestor) não prepara nada
select pg_temp.como('00000000-0000-4000-8000-0000000018b1', 'kb-teste18-beto@example.com');
do $$ declare e text; begin
  e := pg_temp.erra('select public.preparar_usuario_direto(''outra@example.com'', (select perfil_a from cena))');
  if e is null or e not like '%Sem permiss%' then raise exception 'FALHA 2: o Gestor não podia preparar (%)', e; end if;
  e := pg_temp.erra('select public.preparar_nova_senha((select id from public.membros where nome = ''Ana Dezoito''))');
  if e is null or e not like '%Sem permiss%' then raise exception 'FALHA 2b: o Gestor não podia gerar senha (%)', e; end if;
end $$;

-- 3) recusas da administradora: e-mail que já tem conta, e-mail inválido, perfil de outra empresa
select pg_temp.como('00000000-0000-4000-8000-0000000018a1', 'kb-teste18-ana@example.com');
do $$ declare e text; begin
  e := pg_temp.erra('select public.preparar_usuario_direto(''kb-teste18-cris@example.com'', (select perfil_a from cena))');
  if e is null or e not like '%já tem conta%' then raise exception 'FALHA 3a: e-mail com conta devia ser recusado (%)', e; end if;
  e := pg_temp.erra('select public.preparar_usuario_direto(''isso-nao-e-email'', (select perfil_a from cena))');
  if e is null or e not like '%E-mail inválido%' then raise exception 'FALHA 3b: e-mail inválido (%)', e; end if;
  e := pg_temp.erra('select public.preparar_usuario_direto(''nova2@example.com'', (select perfil_c from cena))');
  if e is null or e not like '%Perfil inválido%' then raise exception 'FALHA 3c: perfil de outra empresa (%)', e; end if;
end $$;

-- 4) quem está logado NÃO executa a finalização (só a função de borda, com a chave de serviço)
do $$ declare e text; begin
  e := pg_temp.erra('select public.finalizar_usuario_direto(''00000000-0000-4000-8000-0000000018a1'', ''00000000-0000-4000-8000-0000000018d1'', (select perfil_a from cena), ''X'', '''', '''')');
  if e is null or e not like '%permission denied%' then raise exception 'FALHA 4: authenticated não podia finalizar (%)', e; end if;
end $$;

-- 5) a função de borda (service_role) finaliza: cria o membro com cargo e telefone, e a auditoria atribui à administradora
reset role;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values ('00000000-0000-4000-8000-0000000018d1', 'novo.pessoa@example.com', '{"nome":"Novo Pessoa"}', 'authenticated', 'authenticated');
set local role service_role;
do $$ declare m uuid; begin
  m := public.finalizar_usuario_direto('00000000-0000-4000-8000-0000000018a1', '00000000-0000-4000-8000-0000000018d1', (select perfil_a from cena), 'Novo Pessoa', 'Encarregado de obra', '(603) 555-0180');
  if m is null then raise exception 'FALHA 5: sem membro'; end if;
end $$;
reset role;
do $$ declare x record; a record; begin
  select * into x from public.membros where user_id = '00000000-0000-4000-8000-0000000018d1';
  if x.empresa_id is distinct from (select emp_a from cena) or x.perfil_id is distinct from (select perfil_a from cena) or x.cargo <> 'Encarregado de obra' or x.telefone <> '(603) 555-0180' or not x.ativo then
    raise exception 'FALHA 5b: membro errado %', to_jsonb(x);
  end if;
  select * into a from public.auditoria where tabela = 'membros' and registro = x.id and acao = 'insert';
  if a.quem is distinct from '00000000-0000-4000-8000-0000000018a1' or a.motivo is distinct from 'Cadastro direto pelo administrador' or a.empresa_id is distinct from x.empresa_id then
    raise exception 'FALHA 5c: auditoria errada %', to_jsonb(a);
  end if;
end $$;

-- 6) a finalização reconfere: administrador sem permissão (Beto), perfil de outra empresa e login que já tem empresa
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000018e1', 'x18e@example.com', 'authenticated', 'authenticated');
set local role service_role;
do $$ declare e text; begin
  e := pg_temp.erra('select public.finalizar_usuario_direto(''00000000-0000-4000-8000-0000000018b1'', ''00000000-0000-4000-8000-0000000018e1'', (select perfil_a from cena), ''X Dezoito'', '''', '''')');
  if e is null or e not like '%Sem permiss%' then raise exception 'FALHA 6a: administrador sem permissão (%)', e; end if;
  e := pg_temp.erra('select public.finalizar_usuario_direto(''00000000-0000-4000-8000-0000000018a1'', ''00000000-0000-4000-8000-0000000018e1'', (select perfil_c from cena), ''X Dezoito'', '''', '''')');
  if e is null or e not like '%Perfil inválido%' then raise exception 'FALHA 6b: perfil de outra empresa (%)', e; end if;
  e := pg_temp.erra('select public.finalizar_usuario_direto(''00000000-0000-4000-8000-0000000018a1'', ''00000000-0000-4000-8000-0000000018d1'', (select perfil_a from cena), ''Repetido'', '''', '''')');
  if e is null or e not like '%já pertence%' then raise exception 'FALHA 6c: login que já tem empresa (%)', e; end if;
end $$;
reset role;

-- 7) nova senha provisória: a administradora gera para quem é da empresa dela; não para si, nem para outra empresa; fica na auditoria
select pg_temp.como('00000000-0000-4000-8000-0000000018a1', 'kb-teste18-ana@example.com');
do $$ declare u uuid; e text; begin
  u := public.preparar_nova_senha((select id from public.membros where user_id = '00000000-0000-4000-8000-0000000018d1'));
  if u is distinct from '00000000-0000-4000-8000-0000000018d1' then raise exception 'FALHA 7a: devia devolver o login da pessoa'; end if;
  e := pg_temp.erra('select public.preparar_nova_senha((select id from public.membros where user_id = ''00000000-0000-4000-8000-0000000018a1''))');
  if e is null or e not like '%própria senha%' then raise exception 'FALHA 7b: a própria senha (%)', e; end if;
  e := pg_temp.erra('select public.preparar_nova_senha((select id from public.membros where user_id = ''00000000-0000-4000-8000-0000000018c1''))');
  if e is null or e not like '%não encontrada%' then raise exception 'FALHA 7c: pessoa de outra empresa (%)', e; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.auditoria where acao = 'senha_provisoria' and quem = '00000000-0000-4000-8000-0000000018a1') <> 1 then raise exception 'FALHA 7d: auditoria da senha provisória'; end if;
end $$;

select 'usuario direto: todas as verificacoes passaram' as resultado;
rollback;
