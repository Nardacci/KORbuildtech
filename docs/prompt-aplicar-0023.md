# Prompt para a sessão local: aplicar a migração 0023 no Supabase real

Só rodar depois que o dono escrever "pode aplicar 0023". Arquivo: `supabase/migrations/20261029_0023_funcoes.sql`.
O que ela faz: tabelas `funcoes` (nome único por empresa, ativa) e `funcao_valores` (valor hora com vigência, motivo, autor), coluna `itens.funcao_id` (o item de mão de obra aponta a função), RLS e grants, auditoria, e as dez funções padrão em cada empresa existente e em toda empresa nova (gatilho em `empresas`). Não apaga nem altera dado existente.

1. `git pull origin main`. Leia o arquivo e confirme que é só isso.
2. Aplique no banco real pelo mesmo caminho das anteriores (0016–0022).
3. Confira: `select count(*) from information_schema.tables where table_name in ('funcoes', 'funcao_valores');` → 2; `select count(*) from information_schema.columns where table_name = 'itens' and column_name = 'funcao_id';` → 1; `select count(*) from public.funcoes;` → 10 × número de empresas.
4. Só depois publique o app (`PERSISTE_FUNCAO = true` já no código; service worker `korbuild-v147`). Publicar antes faz salvar item falhar por coluna inexistente.
5. Relate o que foi aplicado e os resultados. Se algo falhar, não corrija às cegas.
