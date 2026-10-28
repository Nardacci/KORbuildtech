-- KORbuild · teste da migração 0023: Funções com valor hora padrão e o item de mão de obra ligado à função.
-- Tudo dentro de uma transação que termina em ROLLBACK. Se chegar ao fim, imprime 'funções: todas as verificações passaram'.

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000015a1', 'kb-teste15-ana@example.com', '{"nome":"Ana Quinze"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000015c1', 'kb-teste15-jose@example.com', '{}', 'authenticated', 'authenticated');

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

select pg_temp.como('00000000-0000-4000-8000-0000000015a1', 'kb-teste15-ana@example.com');
select public.criar_empresa('{"nome":"Prestadora Quinze","atuacao":"prestadora"}');
insert into pg_temp.guarda values ('tj', public.convidar_usuario('kb-teste15-jose@example.com', 'José Quinze', (select id from public.perfis_acesso where chave = 'encarregado')));

do $$
declare v_f uuid; v_it uuid; n int;
begin
  -- a empresa nova já nasce com as dez funções padrão, sem valor
  select count(*) into n from public.funcoes; if n <> 10 then raise exception 'FALHOU: funções padrão: %', n; end if;
  if exists (select 1 from public.funcao_valores) then raise exception 'FALHOU: valores que não deviam existir'; end if;
  -- nome único por empresa (sem diferenciar maiúsculas)
  begin insert into public.funcoes (nome) values ('  carpenter '); raise exception 'FALHOU: função repetida';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  insert into public.funcoes (nome) values ('Drywall finisher') returning id into v_f;
  -- valor com vigência: dois valores, o que vale na data é o mais recente até ela; mesma data não repete
  insert into public.funcao_valores (funcao_id, desde, valor, motivo) values (v_f, '2026-01-01', 38, 'Cadastro');
  insert into public.funcao_valores (funcao_id, desde, valor, motivo) values (v_f, '2026-11-01', 41.5, 'Reajuste');
  begin insert into public.funcao_valores (funcao_id, desde, valor, motivo) values (v_f, '2026-11-01', 50, 'Repetido'); raise exception 'FALHOU: valor repetido na mesma data';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.funcao_valores (funcao_id, desde, valor, motivo) values (v_f, '2026-12-01', 0, 'Zero'); raise exception 'FALHOU: valor zero';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin insert into public.funcao_valores (funcao_id, desde, valor, motivo) values (v_f, '2026-12-01', 40, '  '); raise exception 'FALHOU: sem motivo';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  if (select por from public.funcao_valores where funcao_id = v_f and desde = '2026-11-01') <> auth.uid() then raise exception 'FALHOU: autor do valor'; end if;
  if (select valor from public.funcao_valores where funcao_id = v_f and desde <= '2026-10-28' order by desde desc limit 1) <> 38 then raise exception 'FALHOU: valor vigente'; end if;
  -- item de mão de obra ligado à função
  insert into public.itens (nome, categoria, unidade, funcao_id) values ('Drywall finisher hour', 'mao-de-obra', 'hora', v_f) returning id into v_it;
  if (select funcao_id from public.itens where id = v_it) <> v_f then raise exception 'FALHOU: item sem função'; end if;
  -- função de outra empresa não liga (chave composta)
  begin update public.itens set funcao_id = gen_random_uuid() where id = v_it; raise exception 'FALHOU: ligou função inexistente';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  -- auditoria da função e do valor
  if (select count(*) from public.auditoria where tabela in ('funcoes', 'funcao_valores') and empresa_id = public.minha_empresa()) < 3 then raise exception 'FALHOU: auditoria'; end if;
  -- inativar mantém o histórico
  update public.funcoes set ativa = false where id = v_f;
  if (select count(*) from public.funcao_valores where funcao_id = v_f) <> 2 then raise exception 'FALHOU: histórico sumiu'; end if;
  insert into pg_temp.guarda values ('f', v_f::text), ('it', v_it::text);
end $$;
reset role;

-- José (encarregado): lê as funções, não lê os valores nem cria função
select pg_temp.como('00000000-0000-4000-8000-0000000015c1', 'kb-teste15-jose@example.com');
select public.aceitar_convite(pg_temp.g('tj'));
do $$
begin
  if (select count(*) from public.funcoes) <> 11 then raise exception 'FALHOU: o encarregado não lê as funções'; end if;
  if exists (select 1 from public.funcao_valores) then raise exception 'FALHOU: o encarregado leu os valores'; end if;
  begin insert into public.funcoes (nome) values ('X'); raise exception 'FALHOU: o encarregado criou função';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;
reset role;

-- apagar a função (como o banco) só desliga o item
do $$
begin
  delete from public.funcoes where id = pg_temp.g('f')::uuid;
  if (select funcao_id from public.itens where id = pg_temp.g('it')::uuid) is not null then raise exception 'FALHOU: item ficou apontando função apagada'; end if;
end $$;
select 'funções: todas as verificações passaram' as resultado;
rollback;
