-- KORbuild · migração 0026: o administrador cadastra a pessoa direto, com senha provisória, sem convite (docs/telas-de-cadastro.md).
-- O login (Auth) só pode ser criado com a chave de serviço, então quem faz é a função de borda `criar-usuario` (supabase/functions/criar-usuario).
-- O banco decide quem pode: três funções, nenhuma dá poder novo a quem já não o tem.
--   preparar_usuario_direto(email, perfil)  → chamada COM O LOGIN de quem cadastra: confere a permissão (settings.acesso), o perfil da empresa e que o e-mail ainda não tem conta.
--   finalizar_usuario_direto(...)           → só service_role (a função de borda): confere de novo, cria o membro e a auditoria atribui o cadastro ao administrador.
--   preparar_nova_senha(membro)             → chamada com o login do administrador: confere que a pessoa é da empresa dele (e não é ele) e registra na auditoria.
-- Não apaga nem altera dado existente.

begin;

create or replace function public.preparar_usuario_direto(p_email text, p_perfil uuid) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_empresa uuid := public.minha_empresa();
begin
  if auth.uid() is null or not public.tenho_permissao('settings.acesso') then raise exception 'Sem permissão para cadastrar usuários.'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido.'; end if;
  if not exists (select 1 from public.perfis_acesso where id = p_perfil and empresa_id = v_empresa) then raise exception 'Perfil inválido.'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Este e-mail já tem conta no KORbuild. Use "Convidar por link" para trazê-lo para a sua empresa.';
  end if;
  return v_empresa;
end $f$;

create or replace function public.finalizar_usuario_direto(p_admin uuid, p_user uuid, p_perfil uuid, p_nome text, p_cargo text, p_telefone text) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare v_empresa uuid; v_id uuid; v_nome text := left(btrim(coalesce(p_nome, '')), 120);
begin
  select m.empresa_id into v_empresa
    from public.membros m join public.perfis_acesso pa on pa.id = m.perfil_id
   where m.user_id = p_admin and m.ativo and 'settings.acesso' = any (pa.permissoes);
  if v_empresa is null then raise exception 'Sem permissão para cadastrar usuários.'; end if;
  if not exists (select 1 from public.perfis_acesso where id = p_perfil and empresa_id = v_empresa) then raise exception 'Perfil inválido.'; end if;
  if exists (select 1 from public.membros where user_id = p_user) then raise exception 'Esta conta já pertence a uma empresa.'; end if;
  if char_length(v_nome) < 2 then v_nome := split_part((select email from auth.users where id = p_user), '@', 1); end if;
  if char_length(v_nome) < 2 then v_nome := rpad(v_nome, 2, '_'); end if;
  -- a auditoria (gatilho de membros) atribui o cadastro a quem o fez, não à chave de serviço
  perform set_config('request.jwt.claims', json_build_object('sub', p_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_admin::text, true);
  perform set_config('kb.motivo', 'Cadastro direto pelo administrador', true);
  insert into public.membros (empresa_id, user_id, perfil_id, nome, cargo, telefone)
  values (v_empresa, p_user, p_perfil, v_nome, left(btrim(coalesce(p_cargo, '')), 120), left(btrim(coalesce(p_telefone, '')), 40))
  returning id into v_id;
  return v_id;
end $f$;

create or replace function public.preparar_nova_senha(p_membro uuid) returns uuid
language plpgsql security definer set search_path to 'public' as $f$
declare v_alvo public.membros;
begin
  if auth.uid() is null or not public.tenho_permissao('settings.acesso') then raise exception 'Sem permissão para gerar senha provisória.'; end if;
  select * into v_alvo from public.membros where id = p_membro and empresa_id = public.minha_empresa();
  if v_alvo.id is null then raise exception 'Pessoa não encontrada na sua empresa.'; end if;
  if v_alvo.user_id = auth.uid() then raise exception 'Para trocar a sua própria senha, use Meu perfil.'; end if;
  insert into public.auditoria (quem, tabela, registro, acao, depois, empresa_id, motivo)
  values (auth.uid(), 'membros', v_alvo.id, 'senha_provisoria', jsonb_build_object('nome', v_alvo.nome), v_alvo.empresa_id, 'Senha provisória gerada pelo administrador');
  return v_alvo.user_id;
end $f$;

revoke all on function public.preparar_usuario_direto(text, uuid), public.finalizar_usuario_direto(uuid, uuid, uuid, text, text, text), public.preparar_nova_senha(uuid) from public, anon, authenticated;
grant execute on function public.preparar_usuario_direto(text, uuid), public.preparar_nova_senha(uuid) to authenticated;
grant execute on function public.finalizar_usuario_direto(uuid, uuid, uuid, text, text, text) to service_role;

commit;
