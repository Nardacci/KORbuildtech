-- KORbuild · teste do limite de tentativas compartilhado (supabase/migrations/20261023_0014_limite_tentativas.sql).
-- Tudo em uma transação que termina em ROLLBACK. Se chegar ao fim, imprime 'limite: todas as verificações passaram'.
begin;

do $$ declare i int; ok boolean; k text := 'kb-teste-limite-' || gen_random_uuid(); k2 text := 'kb-teste-limite-' || gen_random_uuid(); begin
  -- 12 tentativas cabem; a 13ª passa do limite
  for i in 1..12 loop
    ok := public.contar_tentativa(k, 12, true);
    if not ok then raise exception 'FALHOU: a tentativa % de 12 já foi barrada', i; end if;
  end loop;
  if public.contar_tentativa(k, 12, false) is not true then raise exception 'FALHOU: olhar o contador (sem contar) não deveria barrar com 12 de 12'; end if;
  if public.contar_tentativa(k, 12, true) then raise exception 'FALHOU: a 13ª tentativa deveria ser barrada'; end if;
  if public.contar_tentativa(k, 12, false) then raise exception 'FALHOU: com 13 de 12 o contador deveria barrar também sem contar'; end if;
  -- chaves diferentes não se misturam
  if not public.contar_tentativa(k2, 12, true) then raise exception 'FALHOU: outra chave foi barrada'; end if;
  -- o contador sem registrar não cria linha
  if exists (select 1 from public.limite_tentativas where chave = 'kb-teste-limite-vazio') then raise exception 'FALHOU: linha inesperada'; end if;
  perform public.contar_tentativa('kb-teste-limite-vazio', 5, false);
  if exists (select 1 from public.limite_tentativas where chave = 'kb-teste-limite-vazio') then raise exception 'FALHOU: olhar o contador criou linha'; end if;
  -- chave inválida
  begin perform public.contar_tentativa('x', 5, true); raise exception 'FALHOU: aceitou chave curta';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
  begin perform public.contar_tentativa(null, 5, true); raise exception 'FALHOU: aceitou chave nula';
  exception when others then if sqlerrm like 'FALHOU%' then raise; end if; end;
end $$;

-- ninguém de fora executa a função nem lê a tabela
select set_config('role', 'authenticated', true), set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000012a1","role":"authenticated"}', true);
do $$ begin
  begin perform public.contar_tentativa('kb-teste-limite-x', 5, true); raise exception 'FALHOU: authenticated executou contar_tentativa';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.limite_tentativas; raise exception 'FALHOU: authenticated leu limite_tentativas';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin perform public.contar_tentativa('kb-teste-limite-x', 5, true); raise exception 'FALHOU: anon executou contar_tentativa';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.limite_tentativas; raise exception 'FALHOU: anon leu limite_tentativas';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- o service_role (a função de borda) executa
select set_config('role', 'service_role', true);
do $$ begin
  if not public.contar_tentativa('kb-teste-limite-servico', 5, true) then raise exception 'FALHOU: service_role não conseguiu usar o contador'; end if;
end $$;
reset role;

do $$ begin raise notice 'limite: todas as verificações passaram'; end $$;
rollback;
