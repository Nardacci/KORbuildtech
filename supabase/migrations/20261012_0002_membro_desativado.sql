-- KORbuild · fatia 1, ajustes encontrados ao ligar o app ao banco (js/conta.js):
-- 1. quem foi desativado lê a própria linha de membros, para o app mostrar "seu acesso foi desativado"
--    (antes, sem enxergar o próprio cadastro, o app achava que a pessoa não tinha empresa);
-- 2. excluir a empresa inteira (cascata para membros) não esbarra na regra "manter alguém que cuide dos acessos".
-- Só cria/reescreve; não apaga dados.

begin;

create policy membros_ler_proprio on public.membros for select to authenticated using (user_id = auth.uid());

create or replace function public.guarda_membro() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare restantes int;
begin
  -- a empresa está sendo excluída (cascata): nada a guardar
  if tg_op = 'DELETE' and not exists (select 1 from public.empresas where id = old.empresa_id) then
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.empresa_id <> old.empresa_id or new.user_id <> old.user_id then
      raise exception 'Não é possível trocar a empresa ou o login de um membro.';
    end if;
    if (select empresa_id from public.perfis_acesso where id = new.perfil_id) <> new.empresa_id then
      raise exception 'Perfil de outra empresa.';
    end if;
    if old.user_id = auth.uid() and (new.ativo is distinct from old.ativo or new.perfil_id <> old.perfil_id) then
      raise exception 'Ninguém altera o próprio acesso.';
    end if;
  end if;
  select count(*) into restantes
    from public.membros m join public.perfis_acesso pa on pa.id = m.perfil_id
   where m.empresa_id = old.empresa_id and m.id <> old.id and m.ativo and 'settings.acesso' = any (pa.permissoes);
  if tg_op = 'UPDATE' and new.ativo and exists (select 1 from public.perfis_acesso where id = new.perfil_id and 'settings.acesso' = any (permissoes)) then
    restantes := restantes + 1;
  end if;
  if restantes = 0 then
    raise exception 'A empresa precisa manter alguém ativo que cuide dos acessos.';
  end if;
  return coalesce(new, old);
end $f$;

commit;
