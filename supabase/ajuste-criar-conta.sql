-- KORbuild · ajuste da criar_conta() (cadastro de usuário), depois da remoção do Match (supabase/remocao-match.sql).
-- O problema: com raw_user_meta_data sem 'tipo', `v_tipo not in (...)` dá NULL (não true), o if não desvia e o
-- insert em perfis vai com tipo nulo, que perfis.tipo (not null + check) recusa. A exceção derruba o cadastro
-- inteiro ("Database error saving new user"). Agora, sem tipo válido, o usuário é criado sem perfil, como antes.
-- O mesmo cuidado com o nome: perfis_nome_check exige de 2 a 120 caracteres.

create or replace function public.criar_conta() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare
  v_tipo text := new.raw_user_meta_data ->> 'tipo';
  v_nome text := left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1), ''), 120);
begin
  if v_tipo is null or v_tipo not in ('empresa', 'profissional') then
    return new;
  end if;
  if char_length(v_nome) < 2 then
    v_nome := rpad(v_nome, 2, '_');
  end if;
  insert into public.perfis (id, tipo, nome) values (new.id, v_tipo, v_nome);
  insert into public.contatos (user_id, email) values (new.id, new.email);
  return new;
end $f$;
