# Prompt para a sessão local: aplicar a migração 0022 no Supabase real

Só rodar depois que o dono escrever "pode aplicar 0022". Arquivo: `supabase/migrations/20261029_0022_liberar_para_obra.sql`.
O que ela faz: colunas `projetos.liberado_em` e `liberado_por`; reescreve a função do gatilho `projetos_obra` (`obra_do_projeto`) para criar a obra 1:1 quando o projeto é **liberado para obra** (não mais quando fica "ganha"), zerar a liberação de projeto perdido e aplicar o vínculo da concorrência vencida na obra que já existe. Um `update` marca como liberados os projetos que já tinham obra automática, para continuarem no Daily. Não apaga nada.

1. `git pull origin main`. Leia o arquivo e confirme que é só isso.
2. Aplique no banco real pelo mesmo caminho das anteriores (0016–0021).
3. Confira: `select count(*) from information_schema.columns where table_name = 'projetos' and column_name in ('liberado_em', 'liberado_por');` → 2; `select count(*) from pg_proc where proname = 'obra_do_projeto' and prosrc like '%liberado_em%';` → 1.
4. Só depois publique o app (`PERSISTE_LIBERADO = true` já no código; service worker `korbuild-v145`). Publicar antes faz o cadastro de projeto falhar por coluna inexistente.
5. Relate o que foi aplicado e os resultados. Se algo falhar, não corrija às cegas.
