-- KORbuild · teste da 0009: excluir empresas ligadas na mesma instrução.
-- A construtora B nasce ANTES da prestadora A (ordem física das linhas): em "delete … where id in (A, B)", a cascata de B
-- zera o vínculo na obra de A depois que a linha de A já saiu. Sem a 0009, a auditoria desse UPDATE apontava uma empresa
-- que não existe mais e a exclusão falhava. Também cobre projetos.obra_id e item_precos.fornecedor_id (set null).
-- Tudo dentro de uma transação que termina em ROLLBACK.

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000007a1', 'kb-teste7-ana@example.com', '{"nome":"Ana Teste"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000007b1', 'kb-teste7-tom@example.com', '{"nome":"Tom Teste"}', 'authenticated', 'authenticated');

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

-- B primeiro
select pg_temp.como('00000000-0000-4000-8000-0000000007b1', 'kb-teste7-tom@example.com');
insert into pg_temp.guarda values ('B', public.criar_empresa('{"nome":"Construtora Teste B","atuacao":"construtora"}')::text);
insert into public.contatos (nome, papeis) values ('Dono', array['cliente']);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo)
  values ('Obra B', (select id from public.contatos where nome = 'Dono'), 'Nashua', 'NH', 42.76, -71.46, '2026-01-01', '2027-12-31');
insert into pg_temp.guarda values ('ob', (select id::text from public.obras where nome = 'Obra B'));
reset role;
-- A depois, com a obra ligada à de B, um projeto ligado à obra e um preço com fornecedor
select pg_temp.como('00000000-0000-4000-8000-0000000007a1', 'kb-teste7-ana@example.com');
insert into pg_temp.guarda values ('A', public.criar_empresa('{"nome":"Prestadora Teste A","atuacao":"prestadora"}')::text);
insert into public.contatos (nome, papeis) values ('Construtora B', array['construtora']), ('Madeireira', array['fornecedor']);
insert into public.obras (nome, contratante_id, municipio, estado, lat, lon, inicio, prazo, responsavel_id)
  values ('Obra A', (select id from public.contatos where nome = 'Construtora B'), 'Manchester', 'NH', 42.99, -71.46, '2026-01-01', '2027-12-31', (select id from public.membros where user_id = auth.uid()));
insert into public.projetos (nome, contratante_id, cidade, estado, tipo, obra_id) values ('Projeto A', (select id from public.contatos where nome = 'Construtora B'), 'Manchester', 'NH', 'reforma', (select id from public.obras where nome = 'Obra A'));
insert into public.itens (nome, categoria, unidade) values ('Prego', 'material', 'caixa');
insert into public.item_precos (item_id, desde, valor, fornecedor_id) values ((select id from public.itens where nome = 'Prego'), '2026-01-01', 9, (select id from public.contatos where nome = 'Madeireira'));
reset role;
update public.obras set vinculo_empresa_id = pg_temp.g('B')::uuid, vinculo_obra_id = pg_temp.g('ob')::uuid where nome = 'Obra A';

-- as duas na mesma instrução (a ordem física é B, A)
delete from public.empresas where id in (pg_temp.g('A')::uuid, pg_temp.g('B')::uuid);
do $$ begin
  if exists (select 1 from public.obras where empresa_id in (pg_temp.g('A')::uuid, pg_temp.g('B')::uuid))
     or exists (select 1 from public.projetos where empresa_id = pg_temp.g('A')::uuid)
     or exists (select 1 from public.item_precos where empresa_id = pg_temp.g('A')::uuid) then raise exception 'FALHOU: sobrou algo das empresas excluídas'; end if;
  if exists (select 1 from public.auditoria where empresa_id in (pg_temp.g('A')::uuid, pg_temp.g('B')::uuid)) then raise exception 'FALHOU: sobrou auditoria das empresas excluídas'; end if;
end $$;

select 'cascata: todas as verificações passaram' as resultado;
rollback;
