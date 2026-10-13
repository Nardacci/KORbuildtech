-- KORbuild · excluir empresas ligadas na mesma instrução não esbarra na auditoria.
-- O caso: a obra da prestadora A aponta a construtora B (obras.vinculo_empresa_id … on delete set null). Em
-- "delete from empresas where id in (A, B)", a cascata de B pode zerar o vínculo na obra de A depois que a linha de A já
-- saiu: é um UPDATE, o gatilho obras_auditar chama auditar(), e a 0003 só deixava passar o DELETE. A auditoria tentava
-- gravar uma linha apontando a empresa A, que não existe mais (chave estrangeira). O mesmo vale para
-- projetos.obra_id e item_precos.fornecedor_id (0008), que também são "set null".
-- Aqui: (1) auditar() não grava nada quando a empresa da linha já não existe, em qualquer operação; (2) os gatilhos
-- "só insert" deixam passar o UPDATE que a cascata faz quando a empresa já saiu. Só reescreve funções; não apaga dados.

begin;

create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare linha jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
        emp uuid := case when tg_table_name = 'empresas' then (linha ->> 'id')::uuid else (linha ->> 'empresa_id')::uuid end;
begin
  -- a empresa está sendo excluída (cascata, inclusive o "set null" vindo de outra empresa): a auditoria dela vai junto
  if emp is not null and not exists (select 1 from public.empresas where id = emp) then return null; end if;
  insert into public.auditoria (quem, tabela, registro, acao, antes, depois, empresa_id, motivo)
  values (auth.uid(), tg_table_name, (linha ->> 'id')::uuid, lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end,
          emp,
          nullif(current_setting('kb.motivo', true), ''));
  return null;
end $f$;

-- Crew (0006): batidas, conferências, localizações, aprovações, orçamentos
create or replace function public.guarda_so_insert() returns trigger
language plpgsql as $f$
begin
  if not exists (select 1 from public.empresas where id = old.empresa_id) then return case when tg_op = 'DELETE' then old else new end; end if;
  raise exception 'Este registro não pode ser alterado nem apagado: corrigir é registrar de novo.';
end $f$;

-- Cronograma (0007): avanços, linhas de base, publicações
create or replace function public.guarda_so_insert_cron() returns trigger
language plpgsql as $f$
declare emp uuid := coalesce(to_jsonb(old) ->> 'empresa_id', to_jsonb(old) ->> 'de_empresa_id')::uuid;   -- a publicação tem de_empresa_id
begin
  if not exists (select 1 from public.empresas where id = emp) then return case when tg_op = 'DELETE' then old else new end; end if;
  raise exception 'Este registro não pode ser alterado nem apagado.';
end $f$;

-- Measure (0008): preços, margens, propostas emitidas
create or replace function public.guarda_so_insert_measure() returns trigger
language plpgsql as $f$
begin
  if not exists (select 1 from public.empresas where id = old.empresa_id) then return case when tg_op = 'DELETE' then old else new end; end if;
  -- o item que sai (sem assembly) leva os preços dele (a auditoria guarda o histórico)
  if tg_op = 'DELETE' and tg_table_name = 'item_precos' and not exists (select 1 from public.itens where id = old.item_id) then return old; end if;
  raise exception 'Este registro não pode ser alterado nem apagado.';
end $f$;

commit;
