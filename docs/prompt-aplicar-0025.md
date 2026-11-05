# Prompt para a sessão local: aplicar a migração 0025 no Supabase (projeto novo, qudyyewfrtfimbytahkv)

Só rodar depois que o dono escrever "pode aplicar 0025". Arquivo: `supabase/migrations/20261103_0025_inicio_da_obra.sql`.
O que ela faz: cria `projetos.inicio_obra` (data, com limite de 2020 a 2100) e troca o gatilho `projetos_obra`: o início da obra passa a ser a data escolhida ao liberar para obra (padrão: hoje), e não a da primeira tarefa do cronograma; a obra acompanha quando a data muda. Não apaga nem altera dado existente: os projetos já liberados mantêm o início da obra que têm.

1. `git pull origin main`. Leia o arquivo e confirme que é só isso.
2. Aplique no banco do projeto novo pelo mesmo caminho das anteriores. Pelo PowerShell do dono, com o endereço do banco já definido na janela e **`$env:PGCLIENTENCODING = "UTF8"`** (senão os acentos ficam quebrados): `psql $env:KOR_DESTINO_URL -f supabase\migrations\20261103_0025_inicio_da_obra.sql` (tem que responder BEGIN, ALTER TABLE, CREATE FUNCTION e COMMIT).
3. Confira: `select count(*) from information_schema.columns where table_name = 'projetos' and column_name = 'inicio_obra';` → 1. Depois `notify pgrst, 'reload schema';`.
4. Só depois publique o app (service worker `korbuild-v152`). Publicar antes faz "Liberar para obra" e a edição do início falharem por coluna inexistente.
5. Relate o que foi aplicado e os resultados. Se algo falhar, não corrija às cegas.
