-- KORbuild · migração 14 — limite de tentativas compartilhado (links públicos).
-- O contador em memória das funções de borda não vale: cada chamada pode cair numa instância diferente e cada uma começa do zero
-- (provado no teste supabase real: 40 códigos inexistentes seguidos, nenhum 429). Aqui o contador fica no banco, o mesmo para todas as instâncias.
-- A chave já chega com hash (a função de borda manda o SHA-256 do endereço ou do token): o banco nunca guarda o endereço de ninguém.
-- Janela de 1 minuto, em linhas que se apagam sozinhas. Só o service_role (a função de borda) executa.

create table if not exists public.limite_tentativas (
  chave   text        not null check (char_length(chave) between 3 and 200),
  janela  timestamptz not null,
  n       integer     not null default 0,
  primary key (chave, janela)
);
alter table public.limite_tentativas enable row level security;   -- sem política nenhuma: ninguém de fora lê nem escreve
revoke all on public.limite_tentativas from public, anon, authenticated;
grant all on public.limite_tentativas to service_role;

-- p_registrar = true: conta esta tentativa e diz se ainda está dentro do limite; false: só olha o contador (sem contar).
create or replace function public.contar_tentativa(p_chave text, p_max integer, p_registrar boolean default true) returns boolean
language plpgsql security definer set search_path to 'public' as $f$
declare v_janela timestamptz := date_trunc('minute', now()); v_n integer;
begin
  if p_chave is null or char_length(p_chave) not between 3 and 200 then raise exception 'Chave inválida.'; end if;
  if p_registrar then
    insert into public.limite_tentativas as t (chave, janela, n) values (p_chave, v_janela, 1)
      on conflict (chave, janela) do update set n = t.n + 1
      returning t.n into v_n;
  else
    select t.n into v_n from public.limite_tentativas t where t.chave = p_chave and t.janela = v_janela;
    v_n := coalesce(v_n, 0);
  end if;
  if random() < 0.02 then delete from public.limite_tentativas where janela < now() - interval '15 minutes'; end if;   -- limpeza sem agendador
  return v_n <= p_max;
end $f$;
revoke all on function public.contar_tentativa(text, integer, boolean) from public, anon, authenticated;
grant execute on function public.contar_tentativa(text, integer, boolean) to service_role;
