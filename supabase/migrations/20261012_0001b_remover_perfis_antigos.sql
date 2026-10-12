-- KORbuild · fatia 1, passo b (docs/banco.md §7): sai o resto do cadastro do sistema antigo.
-- Aprovado pelo usuário em outubro de 2026. Executar SÓ depois de 20261012_0001_contas_empresas.sql.
--
-- O que sai:
--   - o gatilho ao_criar_usuario (em auth.users) e a função criar_conta(), que gravavam perfis/contatos a cada cadastro;
--   - as tabelas perfis e contatos (uma linha cada: a conta antiga do usuário; o login em auth.users fica).
-- Nada mais depende delas: avisos_pendentes_email() lê o nome em membros desde a fatia 1, e a função de borda
-- enviar-avisos só chama avisos_pendentes_email() e marcar_avisos_enviados().
-- Sem CASCADE: se algo ainda depender, o comando falha e nada sai.

begin;

drop trigger ao_criar_usuario on auth.users;
drop function public.criar_conta();
drop table public.perfis, public.contatos;

commit;
