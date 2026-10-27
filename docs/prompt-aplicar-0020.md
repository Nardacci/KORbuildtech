# Prompt para a sessão local: aplicar a migração 0020 no Supabase real

Só rodar depois que o dono escrever "pode aplicar 0020". Arquivo: `supabase/pendentes/20261028_0020_obra_do_projeto.sql` (mover para `supabase/migrations/` junto).
O que ela faz: coluna `projetos.execucao` (local no mapa e dias de trabalho); `obras.lat/lon` opcionais e responsável pelo diário opcional; a chave estrangeira projetos→obras passa a limpar só `obra_id` ao apagar a obra (a antiga zerava `empresa_id` e falhava); gatilho que cria a obra 1:1 quando o projeto fica "ganha" (e mantém a obra em dia com o cadastro do projeto); `criar_obra_da_concorrencia` só completa a obra que já existe. Não apaga nem muda dado existente. Precisa de PostgreSQL 15 ou mais (`on delete set null (obra_id)`).

1. `git pull origin main`. Leia o arquivo e confirme que é só isso.
2. Aplique no banco real pelo mesmo caminho das anteriores (0016–0019).
3. Confira: `select count(*) from pg_trigger where tgname = 'projetos_obra';` → 1; `select column_name from information_schema.columns where table_name = 'projetos' and column_name = 'execucao';` → 1 linha.
4. Só depois publique o app (`PERSISTE_EXECUCAO = true` já no código; service worker `korbuild-v142`). Publicar antes faz o cadastro de projeto falhar por coluna inexistente.
5. Teste de fumaça na conta real: Takeoff › Editar um projeto › situação Ganha › salvar → o Daily mostra o projeto em "Seus projetos"; abrir e preencher um diário.
6. Relate o que foi aplicado e os resultados. Se algo falhar, não corrija às cegas.
