-- KORbuild · teste da migração 0024: o Daily lê o essencial dos projetos liberados, sem expor o resto.
-- Tudo dentro de uma transação que termina em ROLLBACK. Se chegar ao fim, imprime 'projetos do daily: todas as verificações passaram'.

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000016a1', 'kb-teste16-ana@example.com', '{"nome":"Ana Dezesseis"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000016c1', 'kb-teste16-jose@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000016d1', 'kb-teste16-bob@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000016e1', 'kb-teste16-eva@example.com', '{"nome":"Eva Dezesseis"}', 'authenticated', 'authenticated');

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

-- empresa A: Ana (administradora), José (encarregado), Bob (trabalhador, sem permissão do Daily); empresa B: Eva
select pg_temp.como('00000000-0000-4000-8000-0000000016a1', 'kb-teste16-ana@example.com');
select public.criar_empresa('{"nome":"Prestadora Dezesseis A","atuacao":"prestadora"}');
insert into pg_temp.guarda values ('tj', public.convidar_usuario('kb-teste16-jose@example.com', 'José Dezesseis', (select id from public.perfis_acesso where chave = 'encarregado')));
insert into pg_temp.guarda values ('tb', public.convidar_usuario('kb-teste16-bob@example.com', 'Bob Dezesseis', (select id from public.perfis_acesso where chave = 'trabalhador')));
insert into public.contatos (nome, papeis, email) values ('Cliente Dezesseis', array['cliente'], 'c16@example.com');
insert into public.projetos (nome, contratante_id, cidade, estado, tipo, situacao, liberado_em, liberado_por, cronograma, proposta_rascunho, cotacao)
  values ('Liberado A', (select id from public.contatos where nome = 'Cliente Dezesseis'), 'Concord', 'NH', 'reforma', 'orcamento', now(), 'Ana',
          '{"tarefas":[{"id":"t1","nome":"Demolição","quem":"proprio","inicio":"2026-11-02","dias":3,"pct":20,"avancos":[{"pct":20}],"segredo":"x"},{"id":"t2","nome":"Pintura","inicio":"2026-11-09","dias":4}],"marcos":[]}',
          '{"extras":[{"descricao":"Caçamba","valor":999}]}', '{"envios":[{"fornecedorId":"f1"}]}');
insert into public.projetos (nome, contratante_id, cidade, estado, tipo, situacao)
  values ('Em análise A', (select id from public.contatos where nome = 'Cliente Dezesseis'), 'Concord', 'NH', 'reforma', 'orcamento');
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000016c1', 'kb-teste16-jose@example.com');
select public.aceitar_convite(pg_temp.g('tj'));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000016d1', 'kb-teste16-bob@example.com');
select public.aceitar_convite(pg_temp.g('tb'));
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000016e1', 'kb-teste16-eva@example.com');
select public.criar_empresa('{"nome":"Prestadora Dezesseis B","atuacao":"prestadora"}');
insert into public.contatos (nome, papeis, email) values ('Cliente B', array['cliente'], 'cb@example.com');
insert into public.projetos (nome, contratante_id, cidade, estado, tipo, situacao, liberado_em)
  values ('Liberado B', (select id from public.contatos where nome = 'Cliente B'), 'Nashua', 'NH', 'reforma', 'orcamento', now());
reset role;

-- José (encarregado): não lê a tabela, mas a função devolve só o projeto liberado da empresa dele, só com o essencial
select pg_temp.como('00000000-0000-4000-8000-0000000016c1', 'kb-teste16-jose@example.com');
do $$
declare r record; n int; t jsonb;
begin
  if exists (select 1 from public.projetos) then raise exception 'FALHOU: o encarregado leu a tabela de projetos'; end if;
  select count(*) into n from public.projetos_do_daily();
  if n <> 1 then raise exception 'FALHOU: projetos do daily para o encarregado: %', n; end if;
  select * into r from public.projetos_do_daily();
  if r.nome <> 'Liberado A' or r.obra_id is null or r.liberado_em is null or r.liberado_por <> 'Ana' or r.cidade <> 'Concord' then raise exception 'FALHOU: dados do projeto (%)', r; end if;
  -- só as tarefas, só com os campos do Daily: nada de avanços, de campos extras, de proposta, de cotação
  t := r.cronograma;
  if jsonb_array_length(t -> 'tarefas') <> 2 or (t -> 'tarefas' -> 0 ->> 'nome') <> 'Demolição' or (t -> 'tarefas' -> 0 ->> 'pct') <> '20' or (t -> 'tarefas' -> 1 ->> 'pct') <> '0' then raise exception 'FALHOU: tarefas (%)', t; end if;
  if (t -> 'tarefas' -> 0) ? 'segredo' or (t -> 'tarefas' -> 0) ? 'avancos' or t ? 'marcos' then raise exception 'FALHOU: campo a mais nas tarefas (%)', t -> 'tarefas' -> 0; end if;
  if to_jsonb(r)::text ~* 'caçamba|999|fornecedor|proposta|cotacao' then raise exception 'FALHOU: dado comercial no resultado'; end if;
end $$;
reset role;

-- Ana (administradora) vê o mesmo; Bob (sem permissão do Daily) não vê nada; Eva só o da empresa dela
select pg_temp.como('00000000-0000-4000-8000-0000000016a1', 'kb-teste16-ana@example.com');
do $$ begin if (select count(*) from public.projetos_do_daily()) <> 1 then raise exception 'FALHOU: a administradora não vê o projeto liberado'; end if; end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000016d1', 'kb-teste16-bob@example.com');
do $$ begin if exists (select 1 from public.projetos_do_daily()) then raise exception 'FALHOU: o trabalhador (sem Daily) recebeu projetos'; end if; end $$;
reset role;
select pg_temp.como('00000000-0000-4000-8000-0000000016e1', 'kb-teste16-eva@example.com');
do $$ begin
  if (select count(*) from public.projetos_do_daily()) <> 1 or (select nome from public.projetos_do_daily()) <> 'Liberado B' then raise exception 'FALHOU: Eva viu projeto de outra empresa'; end if;
end $$;
reset role;
-- sem login, nada
do $$ begin
  begin perform set_config('role', 'anon', true); perform * from public.projetos_do_daily(); raise exception 'FALHOU: anônimo chamou a função';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

select 'projetos do daily: todas as verificações passaram' as resultado;
rollback;
