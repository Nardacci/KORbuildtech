-- KORbuild · fatia 1: excluir a empresa inteira (cascata) funciona sem desligar gatilhos.
-- 1. guarda_perfil_acesso(): a cascata não esbarra na trava do perfil Administrador (o mesmo ajuste da 0002 em guarda_membro());
-- 2. auditar(): na cascata, não grava auditoria apontando para a empresa que acabou de sumir (quebraria a chave estrangeira;
--    a auditoria da empresa vai junto, pela própria cascata).
-- Só reescreve funções; não apaga dados.

begin;

create or replace function public.guarda_perfil_acesso() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin
  if tg_op = 'DELETE' then
    -- a empresa está sendo excluída (cascata): nada a guardar
    if not exists (select 1 from public.empresas where id = old.empresa_id) then return old; end if;
    if old.sistema then raise exception 'O perfil Administrador não pode ser excluído.'; end if;
    return old;
  end if;
  if old.sistema and (new.permissoes is distinct from old.permissoes or new.sistema is distinct from old.sistema) then
    raise exception 'O perfil Administrador é travado.';
  end if;
  if new.chave is distinct from old.chave or new.empresa_id <> old.empresa_id then
    raise exception 'Não é possível trocar a empresa ou a chave de um perfil.';
  end if;
  return new;
end $f$;

create or replace function public.auditar() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare linha jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
        emp uuid := case when tg_table_name = 'empresas' then (linha ->> 'id')::uuid else (linha ->> 'empresa_id')::uuid end;
begin
  -- a empresa está sendo excluída (cascata): a auditoria dela vai junto
  if tg_op = 'DELETE' and emp is not null and not exists (select 1 from public.empresas where id = emp) then return null; end if;
  insert into public.auditoria (quem, tabela, registro, acao, antes, depois, empresa_id, motivo)
  values (auth.uid(), tg_table_name, (linha ->> 'id')::uuid, lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end,
          emp,
          nullif(current_setting('kb.motivo', true), ''));
  return null;
end $f$;

commit;
