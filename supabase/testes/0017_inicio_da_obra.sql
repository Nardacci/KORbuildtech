-- KORbuild · teste da migração 0025: o início da obra é a data escolhida na liberação (padrão: hoje), editável depois, e não a da primeira tarefa.
-- Tudo dentro de uma transação que termina em ROLLBACK. Se chegar ao fim, imprime 'inicio da obra: todas as verificacoes passaram'.

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000017a1', 'kb-teste17-ana@example.com', '{"nome":"Ana Dezessete"}', 'authenticated', 'authenticated');

create function pg_temp.como(p_id uuid, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;
grant execute on function pg_temp.como(uuid, text) to authenticated;

select pg_temp.como('00000000-0000-4000-8000-0000000017a1', 'kb-teste17-ana@example.com');
select public.criar_empresa('{"nome":"Prestadora Dezessete","atuacao":"prestadora"}');
insert into public.contatos (nome, papeis, email) values ('Cliente Dezessete', array['cliente'], 'c17@example.com');

-- 1) liberado SEM inicio_obra, com tarefa no passado: a obra começa hoje (e não na tarefa), e o projeto guarda a data
insert into public.projetos (nome, contratante_id, cidade, estado, tipo, situacao, liberado_em, liberado_por, cronograma)
  values ('Sem data', (select id from public.contatos where nome = 'Cliente Dezessete'), 'Concord', 'NH', 'reforma', 'orcamento', now(), 'Ana',
          ('{"tarefas":[{"id":"t1","nome":"Demolição","quem":"proprio","inicio":"' || (current_date - 10) || '","dias":3},{"id":"t2","nome":"Pintura","inicio":"' || (current_date + 6) || '","dias":4}]}')::jsonb);
-- 2) liberado COM inicio_obra (amanhã): a obra começa amanhã; o fim continua vindo das tarefas
insert into public.projetos (nome, contratante_id, cidade, estado, tipo, situacao, liberado_em, liberado_por, inicio_obra, cronograma)
  values ('Com data', (select id from public.contatos where nome = 'Cliente Dezessete'), 'Concord', 'NH', 'reforma', 'orcamento', now(), 'Ana', current_date + 1,
          ('{"tarefas":[{"id":"t1","nome":"Demolição","quem":"proprio","inicio":"' || (current_date - 10) || '","dias":3},{"id":"t2","nome":"Pintura","inicio":"' || (current_date + 6) || '","dias":4}]}')::jsonb);
-- 3) liberado sem tarefas e sem data: hoje, e o prazo vai a +89 dias
insert into public.projetos (nome, contratante_id, cidade, estado, tipo, situacao, liberado_em, liberado_por)
  values ('Sem tarefas', (select id from public.contatos where nome = 'Cliente Dezessete'), 'Concord', 'NH', 'reforma', 'orcamento', now(), 'Ana');

do $$
declare p public.projetos; o public.obras;
begin
  select * into p from public.projetos where nome = 'Sem data';
  select * into o from public.obras where id = p.obra_id;
  if o.id is null then raise exception 'FALHOU: a obra não nasceu'; end if;
  if o.inicio <> current_date then raise exception 'FALHOU: sem data, a obra começou em % (esperado hoje)', o.inicio; end if;
  if p.inicio_obra is distinct from current_date then raise exception 'FALHOU: o projeto não guardou a data (%)', p.inicio_obra; end if;
  if o.prazo <> current_date + 9 then raise exception 'FALHOU: o prazo deveria vir da última tarefa (hoje + 9), veio %', o.prazo; end if;

  select * into p from public.projetos where nome = 'Com data';
  select * into o from public.obras where id = p.obra_id;
  if o.inicio <> current_date + 1 then raise exception 'FALHOU: com data escolhida, a obra começou em % (esperado amanhã)', o.inicio; end if;
  if o.prazo <> current_date + 9 then raise exception 'FALHOU: prazo com data escolhida: %', o.prazo; end if;

  select * into p from public.projetos where nome = 'Sem tarefas';
  select * into o from public.obras where id = p.obra_id;
  if o.inicio <> current_date or o.prazo <> current_date + 89 then raise exception 'FALHOU: sem tarefas: início % prazo %', o.inicio, o.prazo; end if;
end $$;

-- 4) mudar a data depois: a obra acompanha, e o prazo nunca fica antes do início
update public.projetos set inicio_obra = current_date + 30 where nome = 'Sem data';
do $$
declare o public.obras;
begin
  select ob.* into o from public.obras ob join public.projetos p on p.obra_id = ob.id where p.nome = 'Sem data';
  if o.inicio <> current_date + 30 then raise exception 'FALHOU: a obra não acompanhou a nova data (%)', o.inicio; end if;
  if o.prazo < o.inicio then raise exception 'FALHOU: prazo (%) antes do início (%)', o.prazo, o.inicio; end if;
end $$;

-- 5) editar outra coisa do projeto não mexe no início da obra
update public.projetos set descricao = 'mudou só a descrição' where nome = 'Com data';
do $$
begin
  if (select ob.inicio from public.obras ob join public.projetos p on p.obra_id = ob.id where p.nome = 'Com data') <> current_date + 1 then raise exception 'FALHOU: editar a descrição mexeu no início da obra'; end if;
end $$;

-- 6) data absurda é recusada
do $$
begin
  begin
    update public.projetos set inicio_obra = date '1999-01-01' where nome = 'Com data';
    raise exception 'FALHOU: aceitou data de 1999';
  exception when check_violation then null;
  end;
end $$;

reset role;
select 'inicio da obra: todas as verificacoes passaram' as resultado;
rollback;
